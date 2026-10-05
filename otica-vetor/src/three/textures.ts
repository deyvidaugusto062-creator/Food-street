import * as THREE from 'three';

/** Textura procedural de "tartaruga" (acetato mesclado), gerada em canvas — sem download. */
export function makeTortoiseTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6e3814';
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blobs = [
    ['rgba(150,78,25,0.6)', 90],
    ['rgba(205,130,55,0.55)', 55],
    ['rgba(250,196,110,0.55)', 30],
    ['rgba(30,12,4,0.5)', 40],
  ] as const;
  g.filter = 'blur(6px)';
  for (const [color, r] of blobs) {
    for (let i = 0; i < 46; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const rx = r * (0.4 + rnd());
      const ry = rx * (0.3 + rnd() * 0.5);
      g.fillStyle = color;
      g.beginPath();
      // desenha também nas bordas opostas para a textura repetir sem emenda
      for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        g.ellipse(x + ox, y + oy, rx, ry, rnd() * Math.PI, 0, Math.PI * 2);
      }
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Textura 1×1 branca: mantém o mesmo shader quando a armação não usa estampa. */
export function makeBlankTexture() {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

/** Sombra suave de contato (gradiente radial) */
export function makeShadowTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(4,16,12,0.55)');
  grad.addColorStop(0.5, 'rgba(4,16,12,0.2)');
  grad.addColorStop(1, 'rgba(4,16,12,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
