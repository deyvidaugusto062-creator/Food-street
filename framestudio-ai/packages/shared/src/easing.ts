import type { Easing } from './model.ts';

/** Avalia uma curva Bézier cúbica (0,0)-(x1,y1)-(x2,y2)-(1,1) em x, resolvendo t por Newton + bisseção. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-6) return sampleY(t);
    const d = sampleDX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 40; i++) {
    const v = sampleX(t);
    if (Math.abs(v - x) < 1e-7) break;
    if (v < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/** Aplica a curva de interpolação a um progresso p ∈ [0,1]. */
export function applyEasing(easing: Easing, p: number): number {
  const x = p < 0 ? 0 : p > 1 ? 1 : p;
  if (typeof easing === 'object') return cubicBezier(easing.x1, easing.y1, easing.x2, easing.y2, x);
  switch (easing) {
    case 'linear':
      return x;
    case 'ease-in':
      return cubicBezier(0.42, 0, 1, 1, x);
    case 'ease-out':
      return cubicBezier(0, 0, 0.58, 1, x);
    case 'ease-in-out':
      return cubicBezier(0.42, 0, 0.58, 1, x);
    case 'hold':
      return x >= 1 ? 1 : 0;
  }
}
