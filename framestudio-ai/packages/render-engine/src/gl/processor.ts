import type { ColorAdjust, Lut, Mask, Point } from '@framestudio/shared';
import { COLOR_FRAG, COPY_FRAG, EFFECT_FRAGS, OUTPUT_FRAG, VERT } from './shaders.ts';

export interface ResolvedEffect {
  type: string;
  params: Record<string, number | string>;
}

export interface ProcessParams {
  /** Recorte da fonte em frações (0..1) — left, top, right, bottom. */
  crop: { left: number; top: number; right: number; bottom: number };
  color?: ColorAdjust;
  effects: ResolvedEffect[];
  mask?: Mask;
  lut?: Lut;
  /** Escala de px do projeto → px de processamento (para raios em px). */
  pxScale: number;
  time: number;
  frame: number;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

const NEUTRAL: Record<string, number> = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  shadows: 0,
  highlights: 0,
  blacks: 0,
  whites: 0,
  gamma: 1,
};

/** Efeitos executados no GPU (os demais — sombra, zoom, tremor — são transformações 2D). */
export const GL_EFFECTS = new Set([
  'blur',
  'sharpen',
  'vignette',
  'grayscale',
  'sepia',
  'grain',
  'glow',
  'distort',
  'glitch',
  'flash',
  'motion-blur',
  'directional-blur',
  'chromatic-aberration',
  'chroma-key',
  'invert',
  'pixelate',
]);

export function isColorNeutral(c: ColorAdjust | undefined): boolean {
  if (!c) return true;
  for (const k in NEUTRAL) if (Math.abs(((c as unknown as Record<string, number>)[k] ?? NEUTRAL[k]!) - NEUTRAL[k]!) > 1e-4) return false;
  if (c.curves && hasCurves(c.curves)) return false;
  if (c.hsl && c.hsl.some((b) => b.hueShift || b.saturation || b.luminance)) return false;
  if (c.lutId && (c.lutIntensity ?? 1) > 0) return false;
  return true;
}

function hasCurves(c: NonNullable<ColorAdjust['curves']>): boolean {
  return [c.master, c.r, c.g, c.b].some((pts) => pts.length > 0 && pts.some((p) => Math.abs(p.x - p.y) > 1e-4));
}

/** Interpolação monotônica (Fritsch–Carlson) dos pontos da curva → tabela de 256 valores. */
export function curveTable(points: Point[]): Uint8Array {
  const out = new Uint8Array(256);
  const pts = [...points].sort((a, b) => a.x - b.x);
  if (pts.length === 0 || pts[0]!.x > 0) pts.unshift({ x: 0, y: pts.length ? Math.min(pts[0]!.y, 0) : 0 });
  if (pts[pts.length - 1]!.x < 1) pts.push({ x: 1, y: pts.length > 1 ? Math.max(pts[pts.length - 1]!.y, 1) : 1 });
  const n = pts.length;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / Math.max(1e-6, xs[i + 1]! - xs[i]!));
  const m: number[] = [d[0] ?? 0];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  m.push(d[n - 2] ?? 0);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  let seg = 0;
  for (let k = 0; k < 256; k++) {
    const x = k / 255;
    while (seg < n - 2 && x > xs[seg + 1]!) seg++;
    const h = xs[seg + 1]! - xs[seg]!;
    const t = h > 0 ? (x - xs[seg]!) / h : 0;
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[seg]! + (t3 - 2 * t2 + t) * h * m[seg]! + (-2 * t3 + 3 * t2) * ys[seg + 1]! + (t3 - t2) * h * m[seg + 1]!;
    out[k] = Math.round(Math.max(0, Math.min(1, y)) * 255);
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 1, 0];
  const v = parseInt(m[1]!, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/**
 * Processador WebGL2 de camadas: recorte → cor → efeitos (ping-pong) → máscara → canvas.
 * O resultado fica no canvas do processador e deve ser desenhado imediatamente pelo chamador.
 */
export class GLProcessor {
  readonly canvas: AnyCanvas;
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, { prog: WebGLProgram; uni: Map<string, WebGLUniformLocation | null> }>();
  private srcTex: WebGLTexture;
  private curvesTex: WebGLTexture;
  private lutTex: WebGLTexture;
  private lutId: string | null = null;
  private pool: Target[] = [];
  private vao: WebGLVertexArrayObject;
  lost = false;

  constructor() {
    this.canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(16, 16) : Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 indisponível');
    this.gl = gl;
    (this.canvas as HTMLCanvasElement).addEventListener?.('webglcontextlost', () => (this.lost = true));
    this.vao = gl.createVertexArray()!;
    this.srcTex = this.makeTex();
    this.curvesTex = this.makeTex();
    this.lutTex = gl.createTexture()!;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  static isSupported(): boolean {
    try {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  private makeTex(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private program(name: string, frag: string) {
    let p = this.programs.get(name);
    if (p) return p;
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Shader ${name}: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Programa ${name}: ${gl.getProgramInfoLog(prog)}`);
    p = { prog, uni: new Map() };
    this.programs.set(name, p);
    return p;
  }

  private use(name: string, frag: string, w: number, h: number, time: number, frame: number) {
    const gl = this.gl;
    const p = this.program(name, frag);
    gl.useProgram(p.prog);
    const loc = (u: string) => {
      if (!p.uni.has(u)) p.uni.set(u, gl.getUniformLocation(p.prog, u));
      return p.uni.get(u)!;
    };
    gl.uniform1i(loc('uTex'), 0);
    gl.uniform2f(loc('uRes'), w, h);
    gl.uniform1f(loc('uTime'), time);
    gl.uniform1f(loc('uFrame'), frame);
    return {
      f: (u: string, ...v: number[]) => {
        const l = loc(u);
        if (v.length === 1) gl.uniform1f(l, v[0]!);
        else if (v.length === 2) gl.uniform2f(l, v[0]!, v[1]!);
        else if (v.length === 3) gl.uniform3f(l, v[0]!, v[1]!, v[2]!);
        else gl.uniform4f(l, v[0]!, v[1]!, v[2]!, v[3]!);
      },
      i: (u: string, v: number) => gl.uniform1i(loc(u), v),
      f4v: (u: string, v: Float32Array) => gl.uniform4fv(loc(u), v),
    };
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const i = this.pool.findIndex((t) => t.w === w && t.h === h);
    if (i >= 0) return this.pool.splice(i, 1)[0]!;
    const tex = this.makeTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  private release(t: Target): void {
    this.pool.push(t);
    // Limita o pool para não acumular memória de GPU com tamanhos variados.
    while (this.pool.length > 8) {
      const old = this.pool.shift()!;
      this.gl.deleteTexture(old.tex);
      this.gl.deleteFramebuffer(old.fbo);
    }
  }

  private draw(target: Target | null, w: number, h: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bindTex(unit: number, tex: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private uploadLut(lut: Lut): void {
    if (this.lutId === lut.id) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, lut.size, lut.size, lut.size, 0, gl.RGB, gl.FLOAT, new Float32Array(lut.data));
    this.lutId = lut.id;
  }

  /**
   * Processa `src` e devolve o canvas do processador com `outW × outH` px.
   * `src` deve ter tamanho natural `srcW × srcH`.
   */
  process(src: TexImageSource, outW: number, outH: number, p: ProcessParams): AnyCanvas {
    const gl = this.gl;
    const w = Math.max(1, Math.round(outW));
    const h = Math.max(1, Math.round(outH));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;

    // Upload da fonte (invertendo Y para que a textura fique na orientação da tela).
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // Passada 1: recorte + cor.
    let cur = this.target(w, h);
    {
      const u = this.use('color', COLOR_FRAG, w, h, p.time, p.frame);
      const k = p.crop;
      u.f('uSrcRect', k.left, k.bottom, 1 - k.left - k.right, 1 - k.top - k.bottom);
      const c = p.color;
      const val = (key: string) => (c ? ((c as unknown as Record<string, number>)[key] ?? NEUTRAL[key]!) : NEUTRAL[key]!);
      u.f('uExposure', val('exposure'));
      u.f('uBrightness', val('brightness'));
      u.f('uContrast', val('contrast'));
      u.f('uSaturation', val('saturation'));
      u.f('uVibrance', val('vibrance'));
      u.f('uTemperature', val('temperature'));
      u.f('uTint', val('tint'));
      u.f('uHue', val('hue'));
      u.f('uShadows', val('shadows'));
      u.f('uHighlights', val('highlights'));
      u.f('uBlacks', val('blacks'));
      u.f('uWhites', val('whites'));
      u.f('uGamma', Math.max(0.2, val('gamma')));
      const curves = c?.curves && hasCurves(c.curves) ? c.curves : null;
      u.i('uUseCurves', curves ? 1 : 0);
      if (curves) {
        const r = curveTable(curves.r);
        const g = curveTable(curves.g);
        const b = curveTable(curves.b);
        const m = curveTable(curves.master);
        const data = new Uint8Array(256 * 4);
        for (let i = 0; i < 256; i++) data.set([r[i]!, g[i]!, b[i]!, m[i]!], i * 4);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.curvesTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        u.i('uCurves', 1);
      }
      const hsl = c?.hsl?.some((b) => b.hueShift || b.saturation || b.luminance) ? c.hsl : null;
      u.i('uUseHsl', hsl ? 1 : 0);
      if (hsl) {
        const arr = new Float32Array(32);
        hsl.slice(0, 8).forEach((b, i) => arr.set([b.hue / 360, b.hueShift, b.saturation, b.luminance], i * 4));
        u.f4v('uHsl', arr);
      }
      const useLut = !!(p.lut && c?.lutId && (c.lutIntensity ?? 1) > 0);
      u.i('uUseLut', useLut ? 1 : 0);
      if (useLut) {
        this.uploadLut(p.lut!);
        u.i('uLut', 2);
        u.f('uLutSize', p.lut!.size);
        u.f('uLutIntensity', c!.lutIntensity ?? 1);
      }
      this.bindTex(0, this.srcTex);
      this.draw(cur, w, h);
    }

    // Passadas de efeitos.
    const pass = (name: string, setup: (u: ReturnType<GLProcessor['use']>) => void, extraTex?: WebGLTexture) => {
      const next = this.target(w, h);
      const u = this.use(name, EFFECT_FRAGS[name]!, w, h, p.time, p.frame);
      setup(u);
      this.bindTex(0, cur.tex);
      if (extraTex) {
        this.bindTex(3, extraTex);
        u.i('uBase', 3);
      }
      this.draw(next, w, h);
      this.release(cur);
      cur = next;
    };
    const num = (e: ResolvedEffect, k: string, d = 0) => (typeof e.params[k] === 'number' ? (e.params[k] as number) : d);
    for (const e of p.effects) {
      switch (e.type) {
        case 'blur': {
          const r = num(e, 'radius') * p.pxScale;
          pass('gauss', (u) => (u.f('uDir', 1, 0), u.f('uRadius', r)));
          pass('gauss', (u) => (u.f('uDir', 0, 1), u.f('uRadius', r)));
          break;
        }
        case 'directional-blur':
        case 'motion-blur': {
          const ang = (num(e, 'angle') * Math.PI) / 180;
          const len = num(e, 'length') * p.pxScale;
          pass('directional', (u) => (u.f('uDir', Math.cos(ang), -Math.sin(ang)), u.f('uLength', len)));
          break;
        }
        case 'sharpen':
          pass('sharpen', (u) => u.f('uAmount', num(e, 'amount')));
          break;
        case 'vignette':
          pass('vignette', (u) => (u.f('uAmount', num(e, 'amount')), u.f('uSize', num(e, 'size', 0.55)), u.f('uSoftness', num(e, 'softness', 0.45))));
          break;
        case 'grayscale':
        case 'sepia':
        case 'invert':
          pass(e.type, (u) => u.f('uAmount', num(e, 'amount', 1)));
          break;
        case 'grain':
          pass('grain', (u) => (u.f('uAmount', num(e, 'amount')), u.f('uSize', Math.max(1, num(e, 'size', 1.5) * Math.max(0.5, p.pxScale)))));
          break;
        case 'glow': {
          const base = cur;
          // Mantém a base fora do pool durante o glow.
          const thr = this.target(w, h);
          {
            const u = this.use('threshold', EFFECT_FRAGS.threshold!, w, h, p.time, p.frame);
            u.f('uThreshold', num(e, 'threshold', 0.6));
            this.bindTex(0, base.tex);
            this.draw(thr, w, h);
          }
          cur = thr;
          const r = num(e, 'radius', 12) * p.pxScale;
          pass('gauss', (u) => (u.f('uDir', 1, 0), u.f('uRadius', r)));
          pass('gauss', (u) => (u.f('uDir', 0, 1), u.f('uRadius', r)));
          pass('add', (u) => u.f('uAmount', num(e, 'amount', 0.7)), base.tex);
          this.release(base);
          break;
        }
        case 'distort':
          pass('distort', (u) => (u.f('uAmount', num(e, 'amount')), u.f('uFrequency', num(e, 'frequency', 10)), u.f('uSpeed', num(e, 'speed', 2))));
          break;
        case 'glitch':
          pass('glitch', (u) => (u.f('uAmount', num(e, 'amount')), u.f('uSpeed', num(e, 'speed', 10))));
          break;
        case 'chromatic-aberration': {
          const ang = (num(e, 'angle') * Math.PI) / 180;
          const a = num(e, 'amount') * p.pxScale;
          pass('chromatic', (u) => u.f('uOffset', Math.cos(ang) * a, -Math.sin(ang) * a));
          break;
        }
        case 'pixelate':
          pass('pixelate', (u) => u.f('uSize', num(e, 'size', 12) * p.pxScale));
          break;
        case 'flash':
          pass('flash', (u) => (u.f('uAmount', num(e, 'amount')), u.f('uFrequency', num(e, 'frequency', 1))));
          break;
        case 'chroma-key': {
          const [r, g, b] = hexToRgb(String(e.params.color ?? '#00ff00'));
          pass('chromakey', (u) => (u.f('uKey', r, g, b), u.f('uSimilarity', num(e, 'similarity', 0.35)), u.f('uSmoothness', num(e, 'smoothness', 0.08)), u.f('uSpill', num(e, 'spill', 0.5))));
          break;
        }
      }
    }

    // Saída: máscara + pré-multiplicação, direto no canvas.
    {
      const u = this.use('output', OUTPUT_FRAG, w, h, p.time, p.frame);
      const m = p.mask;
      const shape = !m || m.shape === 'none' ? 0 : m.shape === 'rectangle' ? 1 : m.shape === 'ellipse' ? 2 : 3;
      u.i('uMaskShape', shape);
      if (m && shape) {
        u.f('uMaskCenter', m.cx, m.cy);
        u.f('uMaskSize', m.width, m.height);
        u.f('uMaskFeather', m.feather);
        u.f('uMaskAngle', m.angle);
        u.i('uMaskInvert', m.invert ? 1 : 0);
      }
      this.bindTex(0, cur.tex);
      gl.clearColor(0, 0, 0, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.draw(null, w, h);
      this.release(cur);
    }
    return this.canvas;
  }

  /** Desfoque simples de uma imagem inteira (usado pela transição "blur"). */
  blur(src: TexImageSource, w: number, h: number, radius: number): AnyCanvas {
    return this.process(src, w, h, { crop: { left: 0, top: 0, right: 0, bottom: 0 }, effects: [{ type: 'blur', params: { radius } }], pxScale: 1, time: 0, frame: 0 });
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of this.pool) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    this.pool = [];
    for (const p of this.programs.values()) gl.deleteProgram(p.prog);
    this.programs.clear();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export { COPY_FRAG };
