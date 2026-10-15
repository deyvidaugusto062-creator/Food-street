import { clamp, type Clip } from '@framestudio/shared';
import { EFFECT_DEFS } from './effects.ts';

const COLOR_RANGES: Record<string, [number, number]> = {
  exposure: [-3, 3],
  brightness: [-1, 1],
  contrast: [-1, 1],
  saturation: [-1, 1],
  temperature: [-1, 1],
  tint: [-1, 1],
  hue: [-180, 180],
  shadows: [-1, 1],
  highlights: [-1, 1],
  blacks: [-1, 1],
  whites: [-1, 1],
  gamma: [0.2, 3],
  vibrance: [-1, 1],
  lutIntensity: [0, 1],
};

const isHexOrCss = (s: unknown) => typeof s === 'string' && s.length < 64 && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(s);

/** Limita todos os valores numéricos do clipe aos intervalos válidos (mutação). */
export function sanitizeClip<C extends Clip>(c: C): C {
  c.start = Math.max(0, Math.round(c.start));
  c.duration = Math.max(1, Math.round(c.duration));
  if ('opacity' in c) c.opacity = clamp(c.opacity, 0, 1);
  if ('transform' in c) {
    const t = c.transform;
    t.scale = clamp(t.scale, 0.01, 20);
    t.rotation = clamp(t.rotation, -3600, 3600);
    t.x = clamp(t.x, -20000, 20000);
    t.y = clamp(t.y, -20000, 20000);
    if (!['contain', 'cover', 'stretch'].includes(t.fit)) t.fit = 'contain';
  }
  if ('crop' in c) {
    const k = c.crop;
    k.left = clamp(k.left, 0, 0.95);
    k.right = clamp(k.right, 0, 0.95 - k.left);
    k.top = clamp(k.top, 0, 0.95);
    k.bottom = clamp(k.bottom, 0, 0.95 - k.top);
  }
  if ('mask' in c) {
    const m = c.mask;
    m.width = clamp(m.width, 0.01, 2);
    m.height = clamp(m.height, 0.01, 2);
    m.feather = clamp(m.feather, 0, 0.5);
    m.cx = clamp(m.cx, -1, 1);
    m.cy = clamp(m.cy, -1, 1);
  }
  if ('color' in c) {
    for (const [k, [lo, hi]] of Object.entries(COLOR_RANGES)) {
      const rec = c.color as unknown as Record<string, number | undefined>;
      if (typeof rec[k] === 'number') rec[k] = clamp(rec[k]!, lo, hi);
    }
  }
  if ('effects' in c) {
    for (const fx of c.effects) {
      const def = EFFECT_DEFS[fx.type];
      if (!def) continue;
      for (const prm of def.params) {
        const v = fx.params[prm.key];
        if (prm.color) {
          if (!isHexOrCss(v)) fx.params[prm.key] = prm.color;
        } else if (typeof v !== 'number' || !Number.isFinite(v)) fx.params[prm.key] = prm.default;
        else fx.params[prm.key] = clamp(v, prm.min, prm.max);
      }
    }
  }
  if ('audio' in c) {
    const a = c.audio;
    a.volume = clamp(a.volume, 0, 4);
    a.pan = clamp(a.pan, -1, 1);
    const maxFade = 600;
    a.fadeIn = clamp(a.fadeIn, 0, maxFade);
    a.fadeOut = clamp(a.fadeOut, 0, maxFade);
  }
  if ('text' in c) {
    const s = c.text;
    s.fontSize = clamp(s.fontSize, 4, 1000);
    s.fontWeight = clamp(Math.round(s.fontWeight / 100) * 100, 100, 900);
    s.lineHeight = clamp(s.lineHeight, 0.5, 4);
    s.letterSpacing = clamp(s.letterSpacing, -50, 200);
    s.boxWidth = clamp(s.boxWidth, 0, 20000);
    s.animationDuration = clamp(Math.round(s.animationDuration), 1, 600);
    s.stroke.width = clamp(s.stroke.width, 0, 100);
    s.shadow.blur = clamp(s.shadow.blur, 0, 200);
    s.background.padding = clamp(s.background.padding, 0, 400);
    s.background.radius = clamp(s.background.radius, 0, 400);
    if (s.content.length > 5000) s.content = s.content.slice(0, 5000);
  }
  if ('speed' in c) c.speed = clamp(c.speed, 0.1, 16);
  if ('sourceIn' in c) c.sourceIn = Math.max(0, c.sourceIn);
  return c;
}
