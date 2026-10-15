/**
 * Resolve o estado visual de um clipe num frame: keyframes, efeitos dinâmicos de transformação
 * (zoom, tremor) e animações de entrada/saída de texto. Função pura e determinística — o mesmo
 * frame produz sempre o mesmo resultado no preview e na exportação.
 */
import type { AnimatableProp, ColorAdjust, Effect, Project, TextAnimation, VisualClip } from '@framestudio/shared';
import { evaluateKeyframes } from '@framestudio/timeline';
import type { ResolvedEffect } from './gl/processor.ts';

export interface VisualState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  /** Escala extra apenas visual (zoom/pop), multiplicada a `scale`. */
  extraScale: number;
  color: ColorAdjust;
  effects: ResolvedEffect[];
  /** Sombra projetada (efeito "shadow"). */
  shadow: { blur: number; x: number; y: number; opacity: number } | null;
  /** Para animação de máquina de escrever. */
  visibleChars?: number;
  /** Desfoque extra (animação blur-in), em px do projeto. */
  extraBlur: number;
}

/** Ruído suave determinístico (value noise 1D). */
function smoothNoise(t: number, seed: number): number {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
}

function anim(clip: VisualClip, prop: AnimatableProp, localFrame: number, base: number): number {
  return evaluateKeyframes(clip.keyframes[prop], localFrame, base);
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

function applyTextAnimation(kind: TextAnimation, p: number, s: VisualState, entering: boolean, textLength: number): void {
  const q = easeOut(Math.max(0, Math.min(1, p)));
  switch (kind) {
    case 'none':
      return;
    case 'fade':
      s.opacity *= q;
      return;
    case 'slide-up':
      s.opacity *= q;
      s.y += (1 - q) * 80 * (entering ? 1 : -1);
      return;
    case 'slide-down':
      s.opacity *= q;
      s.y -= (1 - q) * 80 * (entering ? 1 : -1);
      return;
    case 'slide-left':
      s.opacity *= q;
      s.x += (1 - q) * 160 * (entering ? 1 : -1);
      return;
    case 'pop': {
      // Escala com leve "overshoot" na entrada.
      const over = entering ? 1 + Math.sin(q * Math.PI) * 0.12 : 1;
      s.extraScale *= (0.4 + 0.6 * q) * over;
      s.opacity *= Math.min(1, q * 1.5);
      return;
    }
    case 'typewriter':
      s.visibleChars = Math.min(s.visibleChars ?? textLength, Math.ceil(textLength * p));
      return;
    case 'blur-in':
      s.opacity *= q;
      s.extraBlur += (1 - q) * 24;
      return;
  }
}

export function resolveVisual(project: Project, clip: VisualClip, frame: number): VisualState {
  const fps = project.settings.fps;
  const local = frame - clip.start;
  const t = clip.transform;
  const s: VisualState = {
    x: anim(clip, 'x', local, t.x),
    y: anim(clip, 'y', local, t.y),
    scale: anim(clip, 'scale', local, t.scale),
    rotation: anim(clip, 'rotation', local, t.rotation),
    opacity: Math.max(0, Math.min(1, anim(clip, 'opacity', local, clip.opacity))),
    extraScale: 1,
    color: resolveColor(clip, local),
    effects: [],
    shadow: null,
    extraBlur: 0,
  };
  const progress = clip.duration > 1 ? local / (clip.duration - 1) : 0;
  const timeSec = local / fps;
  for (const e of clip.effects) {
    if (!e.enabled) continue;
    const params = resolveEffectParams(clip, e, local);
    const n = (k: string, d = 0) => (typeof params[k] === 'number' ? (params[k] as number) : d);
    switch (e.type) {
      case 'zoom':
        s.extraScale *= n('from', 1) + (n('to', 1.2) - n('from', 1)) * Math.max(0, Math.min(1, progress));
        break;
      case 'shake': {
        const f = n('frequency', 12);
        const amt = n('amount', 12);
        s.x += smoothNoise(timeSec * f, 1) * amt;
        s.y += smoothNoise(timeSec * f, 2) * amt;
        s.rotation += smoothNoise(timeSec * f, 3) * n('rotation', 1);
        break;
      }
      case 'shadow':
        s.shadow = { blur: n('blur', 24), x: n('x', 0), y: n('y', 16), opacity: n('opacity', 0.6) };
        break;
      case 'motion-blur': {
        // Direção e intensidade derivadas da velocidade animada de x/y.
        const dx = s.x - anim(clip, 'x', local - 1, t.x);
        const dy = s.y - anim(clip, 'y', local - 1, t.y);
        const len = Math.hypot(dx, dy) * n('amount', 0.5) * 2;
        if (len > 0.5) s.effects.push({ type: 'motion-blur', params: { length: len, angle: (Math.atan2(-dy, dx) * 180) / Math.PI } });
        break;
      }
      default:
        s.effects.push({ type: e.type, params });
    }
  }
  if (clip.type === 'text' || clip.type === 'caption') {
    const d = Math.min(clip.text.animationDuration, Math.floor(clip.duration / 2));
    const len = [...clip.text.content].length;
    if (d > 0 && clip.text.animationIn !== 'none' && local < d) applyTextAnimation(clip.text.animationIn, local / d, s, true, len);
    const fromEnd = clip.duration - 1 - local;
    if (d > 0 && clip.text.animationOut !== 'none' && fromEnd < d) applyTextAnimation(clip.text.animationOut, fromEnd / d, s, false, len);
  }
  if (s.extraBlur > 0.3) s.effects.unshift({ type: 'blur', params: { radius: s.extraBlur } });
  return s;
}

export function resolveColor(clip: { color: ColorAdjust; keyframes: VisualClip['keyframes'] }, local: number): ColorAdjust {
  let out: ColorAdjust | null = null;
  for (const k in clip.keyframes) {
    if (!k.startsWith('color:')) continue;
    const field = k.slice(6) as keyof ColorAdjust;
    out ??= { ...clip.color };
    (out as unknown as Record<string, number>)[field] = evaluateKeyframes(clip.keyframes[k as AnimatableProp], local, clip.color[field] as number);
  }
  return out ?? clip.color;
}

export function resolveEffectParams(clip: { keyframes: VisualClip['keyframes'] }, e: Effect, local: number): Record<string, number | string> {
  let out: Record<string, number | string> | null = null;
  const prefix = `effect:${e.id}:`;
  for (const k in clip.keyframes) {
    if (!k.startsWith(prefix)) continue;
    const param = k.slice(prefix.length);
    out ??= { ...e.params };
    out[param] = evaluateKeyframes(clip.keyframes[k as AnimatableProp], local, Number(e.params[param]) || 0);
  }
  return out ?? e.params;
}
