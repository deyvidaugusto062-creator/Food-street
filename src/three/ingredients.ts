import * as THREE from 'three';
import type { Bun, LayerKind } from '../data/stacks';
import { edgeNoise, rng, valueNoise3 } from './noise';
import {
  baconTexture,
  breadingTexture,
  cheeseTexture,
  crustTexture,
  pattyBump,
  pattyTexture,
  pickleTexture,
  tomatoTexture,
} from './textures';

/**
 * Construtores de cada ingrediente. Cada camada nasce com a base em y = 0
 * e informa a própria altura, para o burger ser empilhado de baixo para cima.
 */

export interface BuiltLayer {
  object: THREE.Object3D;
  height: number;
}

export interface BuildOptions {
  quality: 'high' | 'low';
}

type Profile = [number, number][];

const TAU = Math.PI * 2;

function lathe(
  profile: Profile,
  segments: number,
  radial: (angle: number, y: number, index: number) => number,
  colorAt?: (index: number, y: number, angle: number) => THREE.Color,
) {
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(points, segments);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = profile.length;
  const colors = colorAt ? new Float32Array(pos.count * 3) : null;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const j = i % count;
    const angle = Math.atan2(z, x);
    const s = radial(angle, y, j);
    pos.setXYZ(i, x * s, y, z * s);
    if (colors && colorAt) {
      const c = colorAt(j, y, angle);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  fixLatheSeam(geo, count, segments);
  return geo;
}

/** A costura do torno duplica vértices: média das normais para não aparecer uma linha. */
function fixLatheSeam(geo: THREE.BufferGeometry, count: number, segments: number) {
  const n = geo.attributes.normal as THREE.BufferAttribute;
  for (let j = 0; j < count; j++) {
    const a = j, b = segments * count + j;
    const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
    const len = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / len, y / len, z / len);
    n.setXYZ(b, x / len, y / len, z / len);
  }
}

function mixColor(a: string, b: string, t: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)));
}

function markShadows(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

/* ─────────────────────────── PÃES ─────────────────────────── */

const BUN = {
  brioche: {
    crustLow: '#d99a4e', crustMid: '#a9581c', crustTop: '#76320e', crumb: '#f1d39d',
    roughness: 0.38, clearcoat: 0.35,
  },
  preto: {
    crustLow: '#5a3322', crustMid: '#3c2014', crustTop: '#28140b', crumb: '#6a4230',
    roughness: 0.62, clearcoat: 0.08,
  },
} as const;

function bunMaterial(kind: Bun) {
  const c = BUN[kind];
  const map = crustTexture(kind).clone();
  map.repeat.set(4, 1);
  map.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map,
    roughness: c.roughness,
    clearcoat: c.clearcoat,
    clearcoatRoughness: 0.5,
    sheen: kind === 'preto' ? 0.4 : 0,
    sheenColor: new THREE.Color('#8a5a40'),
    sheenRoughness: 0.6,
  });
}

export function buildBunBottom(kind: Bun, seed: number, opts: BuildOptions): BuiltLayer {
  const c = BUN[kind];
  const H = 0.36;
  const profile: Profile = [
    [0, 0], [0.84, 0], [0.94, 0.015], [0.995, 0.06], [1.02, 0.14], [1.02, 0.22],
    [1.0, 0.29], [0.975, 0.33], [0.93, 0.352], [0.6, H], [0, H],
  ];
  const noise = edgeNoise(seed, [[2, 0.012], [3, 0.01], [5, 0.006]]);
  const geo = lathe(
    profile,
    opts.quality === 'high' ? 72 : 40,
    (a) => 1 + noise(a),
    (j, y) => (j >= 8 ? new THREE.Color(c.crumb) : mixColor(c.crustLow, c.crustMid, y / 0.3)),
  );
  const mesh = new THREE.Mesh(geo, bunMaterial(kind));
  return { object: markShadows(mesh), height: H };
}

export function buildBunTop(kind: Bun, seed: number, opts: BuildOptions): BuiltLayer {
  const c = BUN[kind];
  const R = 1.05;
  const base = 0.08;
  const dome = 0.66;
  const n = 2.35;
  const profile: Profile = [[0, 0], [0.9, 0], [0.99, 0.018], [1.035, 0.06]];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    const x = R * Math.pow(Math.cos(t), 2 / n);
    const y = base + dome * Math.pow(Math.sin(t), 2 / n);
    profile.push([i === steps ? 0 : x, y]);
  }
  const noise = edgeNoise(seed, [[2, 0.014], [3, 0.012], [4, 0.008]]);
  const lumps = valueNoise3(seed + 7);
  const geo = lathe(
    profile,
    opts.quality === 'high' ? 80 : 44,
    (a, y) => 1 + noise(a) + (lumps(Math.cos(a) * 1.6, y * 2.2, Math.sin(a) * 1.6) - 0.5) * 0.035,
    (j, y) => {
      if (j <= 1) return new THREE.Color(c.crumb);
      const t = (y - base) / dome;
      return t < 0.35 ? mixColor(c.crustLow, c.crustMid, t / 0.35) : mixColor(c.crustMid, c.crustTop, (t - 0.35) / 0.65);
    },
  );
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, bunMaterial(kind)));

  // pão preto leva fubá por cima; o brioche fica liso e brilhante
  if (kind === 'preto') {
    const r = rng(seed + 3);
    const count = opts.quality === 'high' ? 220 : 90;
    const speck = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.014, 6, 4),
      new THREE.MeshStandardMaterial({ color: '#d8b56a', roughness: 0.9 }),
      count,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const a = r() * TAU;
      const t = 0.25 + Math.pow(r(), 0.7) * 1.2; // mais no topo
      const tt = Math.min(t, Math.PI / 2 - 0.02);
      const rad = R * Math.pow(Math.cos(tt), 2 / n) * (1 + noise(a));
      const y = base + dome * Math.pow(Math.sin(tt), 2 / n);
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      const s = 0.6 + r() * 0.9;
      m.compose(new THREE.Vector3(Math.cos(a) * rad * 0.995, y + 0.004, Math.sin(a) * rad * 0.995), q, new THREE.Vector3(s, s * 0.45, s));
      speck.setMatrixAt(i, m);
    }
    group.add(speck);
  }
  return { object: markShadows(group), height: base + dome };
}

/* ─────────────────────────── CARNES ─────────────────────────── */

export function buildPatty(kind: 'patty' | 'smash', seed: number, opts: BuildOptions): BuiltLayer {
  const smash = kind === 'smash';
  const R = smash ? 1.14 : 1.09;
  const H = smash ? 0.14 : 0.27;
  const profile: Profile = [
    [0, 0.004], [R * 0.9, 0], [R * 0.965, H * 0.1], [R, H * 0.38], [R * 0.995, H * 0.68],
    [R * 0.955, H * 0.92], [R * 0.88, H], [R * 0.5, H * 1.015], [0, H * 1.02],
  ];
  const noise = smash
    ? edgeNoise(seed, [[3, 0.032], [5, 0.026], [8, 0.018], [13, 0.01], [21, 0.005]])
    : edgeNoise(seed, [[3, 0.022], [5, 0.018], [8, 0.012], [15, 0.007]]);
  const map = pattyTexture().clone();
  map.repeat.set(4, 0.6);
  map.needsUpdate = true;
  const geo = lathe(
    profile,
    opts.quality === 'high' ? 96 : 48,
    (a, _y, j) => 1 + noise(a) * (j === 0 || j === profile.length - 1 ? 0 : 1),
    (j) => (j === 4 ? new THREE.Color(smash ? '#b08a78' : '#c2a08c') : j >= 3 && j <= 5 ? new THREE.Color('#e2c8b8') : new THREE.Color('#ffffff')),
  );
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map,
    bumpMap: pattyBump(),
    bumpScale: 1.6,
    roughness: 0.62,
    color: '#ffffff',
  });
  return { object: markShadows(new THREE.Mesh(geo, mat)), height: H };
}

export function buildChicken(seed: number, opts: BuildOptions): BuiltLayer {
  const R = 1.05;
  const H = 0.32;
  const profile: Profile = [
    [0, 0], [R * 0.88, 0], [R * 0.97, H * 0.14], [R, H * 0.45], [R * 0.97, H * 0.8], [R * 0.86, H], [0, H * 1.03],
  ];
  const noise = edgeNoise(seed, [[2, 0.06], [3, 0.04], [7, 0.02], [13, 0.012]]);
  const lumps = valueNoise3(seed + 11);
  const geo = lathe(profile, opts.quality === 'high' ? 96 : 48, (a) => 1 + noise(a));
  // relevo do empanado ao longo da normal
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = (lumps(x * 7, y * 7, z * 7) - 0.5) * 0.05 + (lumps(x * 18, y * 18, z * 18) - 0.5) * 0.02;
    pos.setXYZ(i, x + nor.getX(i) * d, y + nor.getY(i) * d, z + nor.getZ(i) * d);
  }
  geo.scale(1.16, 1, 0.94);
  geo.computeVertexNormals();
  const map = breadingTexture().clone();
  map.repeat.set(4, 2);
  map.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 2, roughness: 0.9 }));
  mesh.rotation.y = rng(seed)() * TAU;
  return { object: markShadows(mesh), height: H };
}

/* ─────────────────────────── QUEIJOS ─────────────────────────── */

export function buildCheese(kind: 'cheddar' | 'mozzarella', seed: number, opts: BuildOptions, drapeRadius = 1.02): BuiltLayer {
  const r = rng(seed);
  const size = kind === 'cheddar' ? 1.98 : 2.06;
  const seg = opts.quality === 'high' ? 44 : 26;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const drips = Array.from({ length: kind === 'mozzarella' ? 4 : 3 }, () => ({ a: r() * TAU, len: 0.12 + r() * 0.22, w: 0.12 + r() * 0.1 }));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    // mussarela derretida: cantos arredondados
    if (kind === 'mozzarella') {
      const d0 = Math.hypot(x, z);
      const maxR = 1.24;
      if (d0 > maxR) { x *= maxR / d0; z *= maxR / d0; }
    }
    const d = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    let y = 0;
    if (d > drapeRadius) {
      const over = d - drapeRadius;
      // escorre: converte excesso horizontal em queda, abraçando a lateral
      y -= Math.pow(over, 1.1) * (kind === 'mozzarella' ? 1.25 : 1.1);
      const hug = drapeRadius + over * 0.16;
      x *= hug / d;
      z *= hug / d;
      for (const drip of drips) {
        const da = Math.atan2(Math.sin(a - drip.a), Math.cos(a - drip.a));
        const wgt = Math.exp(-(da * da) / (drip.w * drip.w * 0.25));
        y -= wgt * drip.len * Math.min(1, over * 6);
      }
    }
    y += Math.sin(x * 3.1 + z * 2.3) * 0.006;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: kind === 'cheddar' ? '#ea8418' : '#ecd4a0',
    emissive: kind === 'cheddar' ? '#7a2400' : '#3a2810',
    emissiveIntensity: kind === 'cheddar' ? 0.3 : 0.12,
    map: cheeseTexture(),
    roughness: kind === 'cheddar' ? 0.28 : 0.36,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.018;
  mesh.rotation.y = r() * TAU;
  return { object: markShadows(mesh), height: 0.034 };
}

/* ─────────────────────────── BACON ─────────────────────────── */

export function buildBacon(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const group = new THREE.Group();
  const map = baconTexture();
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.48, side: THREE.DoubleSide });
  const strips = [
    { rot: 0.35 + r() * 0.3, z: -0.24, y: 0.035 },
    { rot: -0.55 - r() * 0.3, z: 0.22, y: 0.07 },
  ];
  strips.forEach((s, idx) => {
    const geo = new THREE.PlaneGeometry(2.3, 0.4, opts.quality === 'high' ? 72 : 36, 6);
    geo.rotateX(-Math.PI / 2);
    const phase = r() * TAU;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      const z = pos.getZ(i);
      let y = Math.sin(x * 4.4 + phase) * 0.045 + Math.sin(x * 11 + phase * 2) * 0.01 + z * Math.sin(x * 2.2 + idx) * 0.14;
      const ax = Math.abs(x);
      if (ax > 0.98) {
        const over = ax - 0.98;
        y -= Math.pow(over, 1.2) * 0.9;
        x = Math.sign(x) * (0.98 + over * 0.45);
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = s.rot;
    mesh.position.set(0, s.y, s.z);
    group.add(mesh);
  });
  return { object: markShadows(group), height: 0.1 };
}

/* ─────────────────────────── VEGETAIS ─────────────────────────── */

export function buildPickles(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const group = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ map: pickleTexture(), roughness: 0.22 });
  const side = new THREE.MeshStandardMaterial({ color: '#46561a', roughness: 0.35 });
  const geo = new THREE.CylinderGeometry(0.21, 0.21, 0.03, opts.quality === 'high' ? 32 : 18);
  const spots = [
    [0.62, 0.2], [0.66, 1.5], [0.6, 2.75], [0.64, 3.9], [0.66, 5.1], [0.12, 0.8],
  ];
  spots.forEach(([rad, ang], i) => {
    const mesh = new THREE.Mesh(geo, [side, face, face]);
    const a = ang + (r() - 0.5) * 0.3;
    const d = rad + (r() - 0.5) * 0.08 + (i === 0 ? 0.22 : 0);
    mesh.position.set(Math.cos(a) * d, 0.02 + r() * 0.02, Math.sin(a) * d);
    mesh.rotation.set((r() - 0.5) * 0.18, r() * TAU, (r() - 0.5) * 0.18);
    group.add(mesh);
  });
  return { object: markShadows(group), height: 0.05 };
}

export function buildTomato(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const group = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ map: tomatoTexture(), roughness: 0.2 });
  const side = new THREE.MeshStandardMaterial({ color: '#b01d10', roughness: 0.28 });
  const geo = new THREE.CylinderGeometry(0.54, 0.53, 0.075, opts.quality === 'high' ? 40 : 22);
  [[-0.4, 0.1], [0.42, -0.12]].forEach(([x, z], i) => {
    const mesh = new THREE.Mesh(geo, [side, face, face]);
    mesh.position.set(x, 0.04 + i * 0.012, z);
    mesh.rotation.set((r() - 0.5) * 0.08, r() * TAU, (r() - 0.5) * 0.08);
    group.add(mesh);
  });
  return { object: markShadows(group), height: 0.085 };
}

export function buildRedOnion(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const group = new THREE.Group();
  const outer = new THREE.MeshStandardMaterial({ color: '#8e3a6c', roughness: 0.3, emissive: '#2a0718', emissiveIntensity: 0.3 });
  const inner = new THREE.MeshStandardMaterial({ color: '#ead3e0', roughness: 0.3 });
  const tubular = opts.quality === 'high' ? 56 : 30;
  [[-0.32, -0.2], [0.34, 0.24], [0.05, -0.5]].forEach(([cx, cz], k) => {
    [0.3, 0.22, 0.14].forEach((rad, i) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.022, 8, tubular), i === 0 ? outer : inner);
      t.rotation.x = Math.PI / 2;
      t.position.set(cx + (r() - 0.5) * 0.04, 0.025 + k * 0.006, cz + (r() - 0.5) * 0.04);
      group.add(t);
    });
  });
  return { object: markShadows(group), height: 0.05 };
}

export function buildMincedOnion(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const count = opts.quality === 'high' ? 120 : 60;
  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 0.03, 0.05),
    new THREE.MeshStandardMaterial({ roughness: 0.35 }),
    count,
  );
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 0.9;
    m.compose(
      new THREE.Vector3(Math.cos(a) * d, 0.015 + r() * 0.02, Math.sin(a) * d),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 3, r())),
      new THREE.Vector3(0.7 + r() * 0.8, 1, 0.7 + r() * 0.8),
    );
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, color.set(r() > 0.45 ? '#94416f' : '#efdbe6'));
  }
  return { object: markShadows(inst), height: 0.04 };
}

export function buildCaramelizedOnion(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#8b4712', roughness: 0.28, emissive: '#2a0e00', emissiveIntensity: 0.3 });
  const count = opts.quality === 'high' ? 36 : 18;
  for (let i = 0; i < count; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.08 + r() * 0.1, 0.018, 6, 14, Math.PI * (0.6 + r() * 0.6)), mat);
    const a = r() * TAU, d = Math.sqrt(r()) * 0.85;
    t.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.4, 0, r() * TAU);
    t.position.set(Math.cos(a) * d, 0.02 + r() * 0.03, Math.sin(a) * d);
    group.add(t);
  }
  return { object: markShadows(group), height: 0.055 };
}

export function buildGreens(kind: 'lettuce' | 'arugula', seed: number, opts: BuildOptions): BuiltLayer {
  const lettuce = kind === 'lettuce';
  const geo = new THREE.RingGeometry(0.1, lettuce ? 1.16 : 1.1, opts.quality === 'high' ? 128 : 64, 5);
  geo.rotateX(-Math.PI / 2);
  const noise = edgeNoise(seed, lettuce ? [[3, 0.04], [7, 0.03]] : [[11, 0.07], [19, 0.05], [29, 0.03]]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const inner = new THREE.Color(lettuce ? '#b9cf74' : '#5f8a35');
  const outer = new THREE.Color(lettuce ? '#6d9a36' : '#34591c');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const edge = Math.max(0, (d - 0.6) / 0.5);
    const scale = 1 + noise(a) * edge;
    x *= scale; z *= scale;
    let y = Math.sin(a * (lettuce ? 13 : 21) + d * 6) * 0.05 * edge + 0.02;
    if (d > 0.98) {
      const over = d - 0.98;
      y -= over * 0.7;
      const hug = (0.98 + over * 0.5) / d;
      x *= hug; z *= hug;
    }
    pos.setXYZ(i, x, y, z);
    const c = inner.clone().lerp(outer, Math.min(1, d / 1.1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }));
  return { object: markShadows(mesh), height: 0.06 };
}

export function buildEgg(seed: number, opts: BuildOptions): BuiltLayer {
  const R = 0.98;
  const H = 0.05;
  const profile: Profile = [[0, 0], [R * 0.95, 0], [R, H * 0.5], [R * 0.92, H], [0, H]];
  const noise = edgeNoise(seed, [[2, 0.06], [3, 0.05], [5, 0.03], [9, 0.015]]);
  const white = new THREE.Mesh(
    lathe(profile, opts.quality === 'high' ? 72 : 36, (a) => 1 + noise(a)),
    new THREE.MeshStandardMaterial({ color: '#f6efe2', roughness: 0.3 }),
  );
  const yolk = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 16),
    new THREE.MeshStandardMaterial({ color: '#f39b12', roughness: 0.12, emissive: '#5a2a00', emissiveIntensity: 0.25 }),
  );
  yolk.scale.set(1, 0.5, 1);
  yolk.position.set(0.12, H, -0.08);
  const group = new THREE.Group();
  group.add(white, yolk);
  return { object: markShadows(group), height: 0.12 };
}

export function buildOnionRings(seed: number, opts: BuildOptions): BuiltLayer {
  const r = rng(seed);
  const lumps = valueNoise3(seed + 5);
  const group = new THREE.Group();
  const map = breadingTexture();
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 2.5, roughness: 0.86 });
  const rings = [
    { d: 0.46, a: 0.4, R: 0.34, lift: 0.0, tilt: 0.1 },
    { d: 0.5, a: 2.5, R: 0.3, lift: 0.05, tilt: -0.14 },
    { d: 0.78, a: 4.5, R: 0.32, lift: 0.02, tilt: 0.2 },
  ];
  rings.forEach((ring) => {
    const geo = new THREE.TorusGeometry(ring.R, 0.105, opts.quality === 'high' ? 18 : 10, opts.quality === 'high' ? 56 : 28);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    geo.computeVertexNormals();
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const d = (lumps(x * 8 + ring.a, y * 8, z * 8) - 0.5) * 0.05;
      pos.setXYZ(i, x + nor.getX(i) * d, y + nor.getY(i) * d, z + nor.getZ(i) * d);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(Math.PI / 2 + ring.tilt, 0, r() * TAU);
    mesh.position.set(Math.cos(ring.a) * ring.d, 0.1 + ring.lift, Math.sin(ring.a) * ring.d);
    group.add(mesh);
  });
  return { object: markShadows(group), height: 0.22 };
}

/* ─────────────────────────── MOLHOS ─────────────────────────── */

const SAUCE = {
  bbq: { color: '#62190a', roughness: 0.14 },
  mayo: { color: '#efdfb8', roughness: 0.22 },
  ketchup: { color: '#a3170c', roughness: 0.16 },
} as const;

export function buildSauce(kind: keyof typeof SAUCE, seed: number, opts: BuildOptions): BuiltLayer {
  const s = SAUCE[kind];
  const mat = new THREE.MeshStandardMaterial({
    color: s.color,
    roughness: s.roughness,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });
  // lâmina de molho que escorre pela borda em alguns pontos
  const noise = edgeNoise(seed, [[3, 0.06], [5, 0.05], [9, 0.035], [15, 0.015]]);
  const disc = new THREE.CircleGeometry(1, opts.quality === 'high' ? 96 : 48, 0, TAU);
  disc.rotateX(-Math.PI / 2);
  const pos = disc.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const k = 0.93 + noise(a) * 0.45;
    let y = 0.012;
    const rr = d * k;
    if (rr > 0.88) y -= Math.pow(rr - 0.88, 1.15) * 1.7;
    pos.setXYZ(i, x * k, y, z * k);
  }
  disc.computeVertexNormals();
  const mesh = new THREE.Mesh(disc, mat);
  mesh.rotation.y = rng(seed)() * TAU;
  return { object: markShadows(mesh), height: 0.02 };
}

/* ─────────────────────────── MONTAGEM ─────────────────────────── */

export function buildLayer(kind: LayerKind, seed: number, opts: BuildOptions): BuiltLayer {
  switch (kind) {
    case 'patty':
    case 'smash':
      return buildPatty(kind, seed, opts);
    case 'chicken':
      return buildChicken(seed, opts);
    case 'cheddar':
    case 'mozzarella':
      return buildCheese(kind, seed, opts);
    case 'bacon':
      return buildBacon(seed, opts);
    case 'pickles':
      return buildPickles(seed, opts);
    case 'onion-rings':
      return buildOnionRings(seed, opts);
    case 'red-onion':
      return buildRedOnion(seed, opts);
    case 'minced-onion':
      return buildMincedOnion(seed, opts);
    case 'caramelized-onion':
      return buildCaramelizedOnion(seed, opts);
    case 'lettuce':
    case 'arugula':
      return buildGreens(kind, seed, opts);
    case 'tomato':
      return buildTomato(seed, opts);
    case 'egg':
      return buildEgg(seed, opts);
    case 'bbq':
    case 'mayo':
    case 'ketchup':
      return buildSauce(kind, seed, opts);
  }
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => m?.dispose());
  });
}
