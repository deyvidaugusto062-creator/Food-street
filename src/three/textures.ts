import * as THREE from 'three';
import { rng } from './noise';

/**
 * Texturas geradas em canvas — nada é baixado da rede.
 * Cache por chave para que cada textura seja criada uma única vez.
 */

const cache = new Map<string, THREE.Texture>();

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, color = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  s: number,
  seed: number,
  count: number,
  colors: string[],
  rMin: number,
  rMax: number,
  alpha: [number, number],
) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha[0] + r() * (alpha[1] - alpha[0]);
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const x = r() * s, y = r() * s, rad = rMin + r() * (rMax - rMin);
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.7), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // repete nas bordas para a textura não ter emenda
    if (x < rMax) { ctx.beginPath(); ctx.ellipse(x + s, y, rad, rad, 0, 0, Math.PI * 2); ctx.fill(); }
    if (y < rMax) { ctx.beginPath(); ctx.ellipse(x, y + s, rad, rad, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

/** Crosta da carne: marrom profundo com pontos tostados e gordura caramelizada */
export function pattyTexture() {
  return make('patty', 512, (ctx, s) => {
    ctx.fillStyle = '#5a2c18';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 10, 160, ['#6e3219', '#7b3a1c', '#4a200f'], 14, 40, [0.3, 0.55]);
    speckle(ctx, s, 11, 900, ['#2a120a', '#1c0b05', '#3a1a0e'], 2, 9, [0.35, 0.8]);
    speckle(ctx, s, 12, 800, ['#8a4a2a', '#a05a36', '#7b3d22'], 1, 5, [0.3, 0.7]);
    speckle(ctx, s, 13, 260, ['#c4844f', '#d39461'], 0.6, 2, [0.4, 0.85]);
  });
}

export function pattyBump() {
  return make('patty-bump', 256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 21, 900, ['#000000', '#303030'], 1, 5, [0.3, 0.6]);
    speckle(ctx, s, 22, 700, ['#ffffff', '#d0d0d0'], 1, 4, [0.25, 0.55]);
  }, false);
}

/** Crosta do pão — tom varia por tipo */
export function crustTexture(kind: 'brioche' | 'preto') {
  return make(`crust-${kind}`, 512, (ctx, s) => {
    const base = kind === 'brioche' ? '#ffffff' : '#ffffff';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // variação sutil multiplicada sobre a cor do vértice
    speckle(ctx, s, kind === 'brioche' ? 31 : 32, 380, ['#ecdfcf', '#f6eee2', '#e2d2bd'], 6, 22, [0.12, 0.28]);
    speckle(ctx, s, 33, 1400, ['#cdb79c', '#fff8ee'], 0.6, 2.2, [0.25, 0.6]);
  });
}

export function crumbTexture(kind: 'brioche' | 'preto') {
  return make(`crumb-${kind}`, 256, (ctx, s) => {
    ctx.fillStyle = kind === 'brioche' ? '#efcf98' : '#5a3524';
    ctx.fillRect(0, 0, s, s);
    const holes = kind === 'brioche' ? ['#d9ad6c', '#c99a5a', '#f8e0b2'] : ['#3e2216', '#6d4430', '#4b2a1b'];
    speckle(ctx, s, 41, 1300, holes, 0.8, 3.2, [0.35, 0.8]);
  });
}

/** Bacon: faixas de carne e gordura no sentido do comprimento */
export function baconTexture() {
  return make('bacon', 512, (ctx, s) => {
    const r = rng(51);
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    const bands: [number, string][] = [
      [0, '#6e1a0c'], [0.12, '#9a3219'], [0.2, '#e3ad8a'], [0.3, '#b54a28'],
      [0.46, '#7c200f'], [0.55, '#e8b894'], [0.62, '#f0c9a4'], [0.7, '#a33c1e'],
      [0.86, '#6b190b'], [0.93, '#d9987a'], [1, '#6e1a0c'],
    ];
    bands.forEach(([stop, color]) => grad.addColorStop(stop, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    // tostado nas bordas e irregularidade
    for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = 0.12 + r() * 0.25;
      ctx.fillStyle = r() > 0.5 ? '#3a0c04' : '#f2c7a5';
      ctx.fillRect(r() * s, r() * s, 2 + r() * 40, 1 + r() * 3);
    }
    ctx.globalAlpha = 1;
  });
}

/** Face do picles: verde com anel de sementes */
export function pickleTexture() {
  return make('pickle', 256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#c3c56e');
    g.addColorStop(0.55, '#a7ad4f');
    g.addColorStop(0.8, '#8a9438');
    g.addColorStop(0.92, '#56621f');
    g.addColorStop(1, '#3b4614');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const r = rng(61);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r() * 0.2;
      const d = s * 0.22 + r() * s * 0.05;
      ctx.fillStyle = '#e5dca0';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 7, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/** Face do tomate: polpa com lóculos */
export function tomatoTexture() {
  return make('tomato', 256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#c42a17';
    ctx.fillRect(0, 0, s, s);
    const r = rng(71);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const g = ctx.createRadialGradient(c + Math.cos(a) * s * 0.24, c + Math.sin(a) * s * 0.24, 2, c + Math.cos(a) * s * 0.24, c + Math.sin(a) * s * 0.24, s * 0.15);
      g.addColorStop(0, '#f1795a');
      g.addColorStop(0.7, '#e2502f');
      g.addColorStop(1, 'rgba(196,42,23,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * s * 0.24, c + Math.sin(a) * s * 0.24, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = '#f4d58a';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(c + Math.cos(a) * s * (0.2 + r() * 0.1), c + Math.sin(a) * s * (0.2 + r() * 0.1), 3.5, 2.2, r() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    const rim = ctx.createRadialGradient(c, c, s * 0.4, c, c, s * 0.5);
    rim.addColorStop(0, 'rgba(160,20,10,0)');
    rim.addColorStop(1, '#8e160a');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Empanado (onion rings, frango) */
export function breadingTexture() {
  return make('breading', 256, (ctx, s) => {
    ctx.fillStyle = '#c0802f';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 81, 1600, ['#8f561c', '#e2a655', '#a86a26', '#f0c077'], 0.8, 3.6, [0.4, 0.9]);
  });
}

/** Queijo: leve variação para não parecer plástico */
export function cheeseTexture() {
  return make('cheese', 256, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 91, 200, ['#f4ead8', '#fffaf0'], 6, 20, [0.3, 0.6]);
  });
}
