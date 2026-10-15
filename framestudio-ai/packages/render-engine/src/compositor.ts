/**
 * Compositor único do FrameStudio. Preview e exportação chamam exatamente esta função com o mesmo
 * projeto e frame; apenas a origem dos quadros de vídeo muda (elemento <video> × decodificador).
 */
import type { AdjustmentClip, BlendMode, Clip, Project, VideoClip, VisualClip } from '@framestudio/shared';
import { GLProcessor, GL_EFFECTS, isColorNeutral } from './gl/processor.ts';
import { planFrame, type TransitionPlan } from './plan.ts';
import { resolveColor, resolveEffectParams, resolveVisual } from './resolve.ts';
import { renderText } from './text.ts';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface FrameSources {
  /** Quadro de vídeo já posicionado no tempo correto para o clipe. */
  video(clip: VideoClip): CanvasImageSource | null;
  image(assetId: string): CanvasImageSource | null;
}

export interface RenderOptions {
  /** Inclui legendas (faixas de legenda). */
  captions?: boolean;
  /** Clipes a omitir (ex.: o texto em edição direta no preview). */
  hideClipIds?: ReadonlySet<string>;
}

export function sourceSize(src: CanvasImageSource): [number, number] {
  if (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight];
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) return [src.naturalWidth, src.naturalHeight];
  if (typeof VideoFrame !== 'undefined' && src instanceof VideoFrame) return [src.displayWidth, src.displayHeight];
  const s = src as { width: number | SVGAnimatedLength; height: number | SVGAnimatedLength };
  return [Number(s.width) || 0, Number(s.height) || 0];
}

const BLEND: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Bounding box de uma camada no quadro do projeto (para seleção e manipulação no preview). */
export interface LayerBox {
  clipId: string;
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
}

export class Compositor {
  private gl: GLProcessor | null = null;
  private glFailed = false;
  private scratch: AnyCanvas[] = [];
  /** Avisos coletados (ex.: WebGL indisponível). */
  readonly warnings = new Set<string>();
  /** Caixas das camadas desenhadas no último frame. */
  lastBoxes: LayerBox[] = [];

  private getGL(): GLProcessor | null {
    if (this.gl && !this.gl.lost) return this.gl;
    if (this.glFailed) return null;
    try {
      this.gl = new GLProcessor();
    } catch {
      this.glFailed = true;
      this.warnings.add('WebGL2 indisponível: cor, efeitos e máscaras não serão aplicados.');
    }
    return this.gl;
  }

  private scratchCanvas(i: number, w: number, h: number): AnyCanvas {
    let c = this.scratch[i];
    if (!c) {
      c = makeCanvas(w, h);
      this.scratch[i] = c;
    }
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    return c;
  }

  /** Desenha o frame inteiro em `target`. */
  render(target: AnyCanvas, project: Project, frame: number, sources: FrameSources, opts: RenderOptions = {}): void {
    const ctx = target.getContext('2d') as Ctx;
    const W = target.width;
    const H = target.height;
    const sx = W / project.settings.width;
    const sy = H / project.settings.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = project.settings.background;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    this.lastBoxes = [];
    for (const p of planFrame(project, frame, { captions: opts.captions })) {
      if (p.transition) {
        this.renderTransition(ctx, project, frame, sources, p.transition, W, H, sx, sy, opts);
      } else if (p.clip) {
        if (opts.hideClipIds?.has(p.clip.id)) continue;
        if (p.clip.type === 'adjustment') this.renderAdjustment(ctx, project, p.clip, frame, sx);
        else if (p.clip.type !== 'audio') this.drawClip(ctx, project, p.clip, frame, sources, sx, sy);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Desenha um clipe visual no contexto (que pode ser o principal ou um canvas de transição). */
  drawClip(ctx: Ctx, project: Project, clip: VisualClip, frame: number, sources: FrameSources, sx: number, sy: number, record = true): void {
    const st = resolveVisual(project, clip, frame);
    if (st.opacity <= 0.001) return;
    const PW = project.settings.width;
    const PH = project.settings.height;
    const outScale = Math.min(sx, sy);
    let src: CanvasImageSource | null;
    let baseW: number;
    let baseH: number;
    let srcW: number;
    let srcH: number;
    const crop = clip.crop;
    if (clip.type === 'text' || clip.type === 'caption') {
      const fps = project.settings.fps;
      const r = renderText(clip.text, {
        scale: outScale * Math.max(0.05, st.scale * st.extraScale),
        visibleChars: st.visibleChars,
        words: clip.type === 'caption' ? clip.words : undefined,
        localTime: (frame - clip.start) / fps,
        highlightWords: clip.type === 'caption' ? clip.caption.highlightWords : false,
        highlightColor: clip.type === 'caption' ? clip.caption.highlightColor : undefined,
        wordByWord: clip.type === 'caption' ? clip.caption.wordByWord : false,
      });
      src = r.canvas;
      [srcW, srcH] = [r.canvas.width, r.canvas.height];
      // r.width/height estão em px do projeto (escala 1); o canvas já tem a resolução final.
      baseW = r.width * (1 - crop.left - crop.right);
      baseH = r.height * (1 - crop.top - crop.bottom);
    } else {
      src = clip.type === 'video' ? sources.video(clip) : sources.image(clip.assetId);
      if (!src) return;
      [srcW, srcH] = sourceSize(src);
      if (!srcW || !srcH) return;
      const cw = srcW * (1 - crop.left - crop.right);
      const ch = srcH * (1 - crop.top - crop.bottom);
      const fit = clip.transform.fit;
      if (fit === 'stretch') {
        baseW = PW;
        baseH = PH;
      } else {
        const k = fit === 'cover' ? Math.max(PW / cw, PH / ch) : Math.min(PW / cw, PH / ch);
        baseW = cw * k;
        baseH = ch * k;
      }
    }
    const drawW = baseW * st.scale * st.extraScale;
    const drawH = baseH * st.scale * st.extraScale;
    if (Math.abs(drawW) < 0.5 || Math.abs(drawH) < 0.5) return;

    let layer: CanvasImageSource = src;
    let rect: [number, number, number, number] = [crop.left * srcW, crop.top * srcH, srcW * (1 - crop.left - crop.right), srcH * (1 - crop.top - crop.bottom)];
    const glEffects = st.effects.filter((e) => GL_EFFECTS.has(e.type));
    const needGL = !isColorNeutral(st.color) || glEffects.length > 0 || clip.mask.shape !== 'none';
    if (needGL) {
      const gl = this.getGL();
      if (gl) {
        const maxW = Math.max(2, Math.min(rect[2], 4096));
        const procW = Math.max(2, Math.min(Math.round(Math.abs(drawW) * outScale), maxW));
        const procH = Math.max(2, Math.round((procW * rect[3]) / rect[2]));
        const lut = st.color.lutId ? project.luts[st.color.lutId] : undefined;
        layer = gl.process(src as TexImageSource, procW, procH, {
          crop,
          color: st.color,
          effects: glEffects,
          mask: clip.mask,
          lut,
          pxScale: procW / Math.abs(drawW),
          time: (frame - clip.start) / project.settings.fps,
          frame,
        });
        rect = [0, 0, procW, procH];
      }
    }

    ctx.save();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalAlpha = st.opacity;
    ctx.globalCompositeOperation = BLEND[clip.blendMode] ?? 'source-over';
    if (st.shadow) {
      ctx.shadowColor = `rgba(0,0,0,${st.shadow.opacity})`;
      ctx.shadowBlur = st.shadow.blur * outScale;
      ctx.shadowOffsetX = st.shadow.x * sx;
      ctx.shadowOffsetY = st.shadow.y * sy;
    }
    const cx = PW / 2 + st.x;
    const cy = PH / 2 + st.y;
    ctx.translate(cx, cy);
    ctx.rotate((st.rotation * Math.PI) / 180);
    ctx.scale(clip.transform.flipH ? -1 : 1, clip.transform.flipV ? -1 : 1);
    ctx.drawImage(layer, rect[0], rect[1], rect[2], rect[3], -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    if (record) this.lastBoxes.push({ clipId: clip.id, cx, cy, width: drawW, height: drawH, rotation: st.rotation });
  }

  private renderAdjustment(ctx: Ctx, project: Project, clip: AdjustmentClip, frame: number, sx: number): void {
    const gl = this.getGL();
    if (!gl) return;
    const local = frame - clip.start;
    const color = resolveColor(clip, local);
    const effects = clip.effects.filter((e) => e.enabled && GL_EFFECTS.has(e.type)).map((e) => ({ type: e.type, params: resolveEffectParams(clip, e, local) }));
    if (isColorNeutral(color) && effects.length === 0) return;
    const canvas = ctx.canvas as AnyCanvas;
    const out = gl.process(canvas as TexImageSource, canvas.width, canvas.height, {
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      color,
      effects,
      lut: color.lutId ? project.luts[color.lutId] : undefined,
      pxScale: sx,
      time: local / project.settings.fps,
      frame,
    });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, clip.opacity));
    ctx.drawImage(out, 0, 0);
    ctx.restore();
  }

  private renderTransition(ctx: Ctx, project: Project, frame: number, sources: FrameSources, tp: TransitionPlan, W: number, H: number, sx: number, sy: number, opts: RenderOptions): void {
    const draw = (c: Ctx, clip: Clip) => {
      if (clip.type === 'audio' || opts.hideClipIds?.has(clip.id)) return;
      if (clip.type === 'adjustment') return;
      this.drawClip(c, project, clip, frame, sources, sx, sy, false);
    };
    const A = this.scratchCanvas(0, W, H);
    const B = this.scratchCanvas(1, W, H);
    const C = this.scratchCanvas(2, W, H);
    const actx = A.getContext('2d') as Ctx;
    const bctx = B.getContext('2d') as Ctx;
    const cctx = C.getContext('2d') as Ctx;
    for (const c of [actx, bctx, cctx]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, W, H);
    }
    draw(actx, tp.a);
    draw(bctx, tp.b);
    const p = Math.max(0, Math.min(1, tp.progress));
    const t = tp.transition;
    const dir = t.direction;
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const crossfade = (a: AnyCanvas, b: AnyCanvas, q: number) => {
      cctx.globalCompositeOperation = 'lighter';
      cctx.globalAlpha = 1 - q;
      cctx.drawImage(a, 0, 0);
      cctx.globalAlpha = q;
      cctx.drawImage(b, 0, 0);
      cctx.globalAlpha = 1;
      cctx.globalCompositeOperation = 'source-over';
    };
    const clipped = (shape: (c: Ctx) => void) => {
      cctx.drawImage(A, 0, 0);
      cctx.save();
      cctx.beginPath();
      shape(cctx);
      cctx.clip();
      cctx.clearRect(0, 0, W, H);
      cctx.drawImage(B, 0, 0);
      cctx.restore();
    };
    switch (t.type) {
      case 'dissolve':
        crossfade(A, B, p);
        break;
      case 'fade-black':
      case 'fade-white': {
        const color = t.type === 'fade-black' ? '#000' : '#fff';
        const first = p < 0.5;
        cctx.drawImage(first ? A : B, 0, 0);
        cctx.globalCompositeOperation = 'source-atop';
        cctx.globalAlpha = first ? p * 2 : (1 - p) * 2;
        cctx.fillStyle = color;
        cctx.fillRect(0, 0, W, H);
        cctx.globalAlpha = 1;
        cctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'wipe':
        clipped((c) => {
          if (dx < 0) c.rect(W * (1 - p), 0, W * p, H);
          else if (dx > 0) c.rect(0, 0, W * p, H);
          else if (dy < 0) c.rect(0, H * (1 - p), W, H * p);
          else c.rect(0, 0, W, H * p);
        });
        break;
      case 'slide':
        cctx.drawImage(A, 0, 0);
        cctx.drawImage(B, -dx * W * (1 - p), -dy * H * (1 - p));
        break;
      case 'push':
        cctx.drawImage(A, dx * W * p, dy * H * p);
        cctx.drawImage(B, -dx * W * (1 - p), -dy * H * (1 - p));
        break;
      case 'zoom': {
        const za = 1 + p * 0.6;
        const zb = 0.6 + 0.4 * p;
        cctx.globalCompositeOperation = 'lighter';
        cctx.globalAlpha = 1 - p;
        cctx.drawImage(A, (W - W * za) / 2, (H - H * za) / 2, W * za, H * za);
        cctx.globalAlpha = p;
        cctx.drawImage(B, (W - W * zb) / 2, (H - H * zb) / 2, W * zb, H * zb);
        cctx.globalAlpha = 1;
        cctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'blur': {
        const gl = this.getGL();
        const radius = Math.sin(Math.PI * p) * 28 * t.intensity * Math.min(sx, sy) * 2;
        const q = Math.max(0, Math.min(1, (p - 0.35) / 0.3));
        if (gl && radius > 0.5) {
          // O canvas do GL é reutilizado: copia cada resultado antes de processar o próximo.
          const ba = this.scratchCanvas(3, W, H);
          const bactx = ba.getContext('2d') as Ctx;
          bactx.clearRect(0, 0, W, H);
          bactx.drawImage(gl.blur(A as TexImageSource, W, H, radius), 0, 0);
          const bb = this.scratchCanvas(4, W, H);
          const bbctx = bb.getContext('2d') as Ctx;
          bbctx.clearRect(0, 0, W, H);
          bbctx.drawImage(gl.blur(B as TexImageSource, W, H, radius), 0, 0);
          crossfade(ba, bb, q);
        } else crossfade(A, B, q);
        break;
      }
      case 'flash': {
        crossfade(A, B, p < 0.5 ? 0 : 1);
        cctx.globalCompositeOperation = 'source-atop';
        cctx.globalAlpha = Math.sin(Math.PI * p) * t.intensity;
        cctx.fillStyle = '#fff';
        cctx.fillRect(0, 0, W, H);
        cctx.globalAlpha = 1;
        cctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'circle':
        clipped((c) => c.arc(W / 2, H / 2, (Math.hypot(W, H) / 2) * p, 0, Math.PI * 2));
        break;
      case 'diamond': {
        const r = (W + H) * 0.5 * p;
        clipped((c) => {
          c.moveTo(W / 2, H / 2 - r);
          c.lineTo(W / 2 + r, H / 2);
          c.lineTo(W / 2, H / 2 + r);
          c.lineTo(W / 2 - r, H / 2);
          c.closePath();
        });
        break;
      }
      case 'clock': {
        const R = Math.hypot(W, H);
        clipped((c) => {
          c.moveTo(W / 2, H / 2);
          c.arc(W / 2, H / 2, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
          c.closePath();
        });
        break;
      }
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(C, 0, 0);
    ctx.restore();
  }

  dispose(): void {
    this.gl?.dispose();
    this.gl = null;
    this.scratch = [];
  }
}
