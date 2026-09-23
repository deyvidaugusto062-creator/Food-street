import { useEffect, useRef } from 'react';
import { hasWebGL, isLowPowerDevice } from '../../utils/webgl';

/**
 * Fundo em shader: luzes da Augusta fora de foco (bokeh) e rastros de farol,
 * com grão e vinheta. WebGL puro — sem Three.js — para ser leve.
 * Pausa fora da tela; com movimento reduzido, desenha um único quadro.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform float uWarmth;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float aspect = uRes.x / uRes.y;
  vec3 ink = vec3(0.051, 0.051, 0.043);
  vec3 ember = vec3(0.329, 0.157, 0.094);
  vec3 orange = vec3(0.929, 0.475, 0.212);
  vec3 sand = vec3(0.922, 0.788, 0.647);

  // céu noturno com calor vindo de baixo
  vec3 col = mix(ink, ember * 0.55, smoothstep(0.7, -0.6, p.y) * uWarmth);

  // bokeh — postes, letreiros e faróis desfocados
  for (int i = 0; i < 22; i++) {
    float fi = float(i);
    vec2 c = vec2((hash(fi * 3.17) - 0.5) * aspect * 1.1, (hash(fi * 7.73) - 0.5) * 1.1);
    c.x += sin(uTime * 0.05 + fi * 1.7) * 0.04;
    c.y += cos(uTime * 0.04 + fi * 1.3) * 0.025 + uScroll * (0.08 + hash(fi * 2.1) * 0.12);
    float r = mix(0.035, 0.15, pow(hash(fi * 1.91), 1.6));
    float d = length(p - c);
    float disc = smoothstep(r, r * 0.9, d);
    float rim = smoothstep(r * 0.55, r * 0.98, d) * disc;
    vec3 tint = mix(orange, sand, hash(fi * 5.31));
    float power = mix(0.04, 0.2, hash(fi * 2.71)) * (0.85 + 0.15 * sin(uTime * 0.6 + fi));
    col += tint * (disc * 0.65 + rim * 0.5) * power;
  }

  // rastros de luz na rua (longa exposição)
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = -0.26 - fi * 0.045 + sin(p.x * 1.4 + fi) * 0.012 + uScroll * 0.05;
    float w = 0.0025 + hash(fi * 9.1) * 0.004;
    float dy = (p.y - y) / w;
    float streak = exp(-dy * dy);
    float along = smoothstep(-aspect * 0.6, aspect * 0.1, p.x + sin(uTime * 0.12 + fi) * 0.25) * smoothstep(aspect * 0.6, 0.0, p.x);
    vec3 tint = mix(orange, vec3(0.95, 0.25, 0.12), hash(fi * 4.4));
    col += tint * streak * along * 0.35;
    float dh = dy / 14.0;
    col += tint * exp(-dh * dh) * along * 0.035;
  }

  // vinheta
  col *= smoothstep(1.35, 0.25, length(p * vec2(0.75, 1.0)));
  // grão
  col += (hash2(frag + fract(uTime) * 91.7) - 0.5) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}
`;

interface ShaderCanvasProps {
  className?: string;
  warmth?: number;
  reducedMotion: boolean;
}

export function ShaderCanvas({ className, warmth = 1, reducedMotion }: ShaderCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !hasWebGL()) return;
    // cada execução cria o próprio canvas: um contexto perdido nunca é reaproveitado
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    host.appendChild(canvas);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.remove();
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uScroll = gl.getUniformLocation(prog, 'uScroll');
    gl.uniform1f(gl.getUniformLocation(prog, 'uWarmth'), warmth);

    // bokeh é desfocado por natureza: resolução reduzida não aparece
    const scale = isLowPowerDevice() ? 0.5 : Math.min(window.devicePixelRatio, 1.5) * 0.75;
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };

    let raf = 0;
    let visible = false;
    let t0 = performance.now();
    let elapsed = 0;

    const scrollProgress = () => {
      const rect = canvas.getBoundingClientRect();
      const vh = window.innerHeight;
      return Math.min(1, Math.max(-1, (vh / 2 - (rect.top + rect.height / 2)) / vh));
    };

    const draw = () => {
      resize();
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uScroll, reducedMotion ? 0 : scrollProgress());
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      elapsed += (now - t0) / 1000;
      t0 = now;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reducedMotion) {
        elapsed = 12;
        draw();
        return;
      }
      cancelAnimationFrame(raf);
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else cancelAnimationFrame(raf);
      },
      { rootMargin: '100px' },
    );
    io.observe(canvas);

    const onResize = () => {
      if (!visible || reducedMotion) draw();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [reducedMotion, warmth]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
