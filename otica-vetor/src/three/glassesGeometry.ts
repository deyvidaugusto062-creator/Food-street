import * as THREE from 'three';

/**
 * Geometria procedural de uma armação estilo "panto" (redonda com topo levemente reto),
 * montada por código: aros extrudados com chanfro, ponte em arco, terminais, dobradiças e hastes.
 * Unidades arbitrárias (~1 = 40 mm).
 */

export const DIM = {
  lensA: 0.6, // meia largura da lente
  lensB: 0.51, // meia altura da lente
  rim: 0.075, // espessura frontal do aro
  depth: 0.06, // profundidade do acetato
  bevel: 0.022,
  centerX: 0.77, // centro de cada lente
  hingeY: 0.22,
};

/** Contorno da lente: superelipse com topo mais reto e base levemente afunilada */
function outline(a: number, b: number, segments = 96) {
  const pts: THREE.Vector2[] = [];
  const n = 2.35;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let x = Math.sign(c) * Math.abs(c) ** (2 / n) * a;
    let y = Math.sign(s) * Math.abs(s) ** (2 / n) * b;
    if (y > 0) y *= 0.94; // topo mais reto
    else x *= 1 - 0.07 * (-y / b); // base mais estreita
    // leve inclinação para fora (desenho "panto")
    x += y * 0.04;
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

const extrude = (shape: THREE.Shape, depth = DIM.depth, bevel = DIM.bevel) =>
  new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 5,
    curveSegments: 48,
  });

/** Aro (anel) de uma lente, já posicionado; side = -1 esquerda, 1 direita */
export function rimGeometry(side: -1 | 1) {
  const { lensA, lensB, rim, centerX } = DIM;
  const outer = outline(lensA + rim, lensB + rim);
  const inner = outline(lensA, lensB);
  const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x * side, p.y)));
  shape.holes.push(new THREE.Path(inner.map((p) => new THREE.Vector2(p.x * side, p.y)).reverse()));
  const g = extrude(shape);
  g.translate(centerX * side, 0, -DIM.depth / 2);
  return g;
}

/** Lente: placa fina com o contorno interno */
export function lensGeometry(side: -1 | 1) {
  const pts = outline(DIM.lensA + 0.01, DIM.lensB + 0.01).map((p) => new THREE.Vector2(p.x * side, p.y));
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.012, bevelEnabled: false, curveSegments: 48 });
  g.translate(DIM.centerX * side, 0, -0.006);
  // UV planar simples
  g.computeVertexNormals();
  return g;
}

/** Ponte em arco ("buraco de fechadura") */
export function bridgeGeometry() {
  const shape = new THREE.Shape();
  const w = 0.2;
  const steps = 24;
  const top = (u: number) => 0.36 + 0.03 * Math.sin(Math.PI * u);
  const bottom = (u: number) => 0.24 + 0.05 * Math.sin(Math.PI * u);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = -w + 2 * w * u;
    if (i === 0) shape.moveTo(x, top(u));
    else shape.lineTo(x, top(u));
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    shape.lineTo(-w + 2 * w * u, bottom(u));
  }
  shape.closePath();
  const g = extrude(shape, DIM.depth * 0.9, DIM.bevel * 0.9);
  g.translate(0, -0.02, -DIM.depth * 0.45);
  return g;
}

/** Terminal: bloco que leva o aro até a dobradiça */
export function endpieceGeometry(side: -1 | 1) {
  const pts: [number, number][] = [
    [0, -0.07],
    [0.2, -0.05],
    [0.25, -0.03],
    [0.27, 0.02],
    [0.27, 0.06],
    [0.24, 0.095],
    [0.2, 0.1],
    [0, 0.1],
  ];
  // espelha os pontos (e não a geometria) para manter as faces voltadas para fora
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * side, y)));
  const g = extrude(shape, DIM.depth, DIM.bevel);
  // começa dentro da faixa do aro (sem invadir a lente)
  g.translate(side * (DIM.centerX + DIM.lensA), DIM.hingeY - 0.02, -DIM.depth / 2);
  return g;
}

/** Ponto da dobradiça (pivô da haste) */
export const hingePosition = (side: -1 | 1) =>
  new THREE.Vector3(side * (DIM.centerX + DIM.lensA + 0.225), DIM.hingeY, -DIM.depth / 2 - DIM.bevel - 0.03);

/** Haste: tubo achatado que vai para trás e curva na ponta (atrás da orelha) */
export function templeGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.005, -0.9),
    new THREE.Vector3(0, -0.01, -2.0),
    new THREE.Vector3(0, -0.08, -2.6),
    new THREE.Vector3(0, -0.28, -2.98),
    new THREE.Vector3(0, -0.42, -3.1),
  ]);
  const g = new THREE.TubeGeometry(curve, 96, 0.05, 14, false);
  g.scale(0.42, 1, 1); // achata na lateral: haste fina e alta
  return g;
}

/** Ponteira arredondada que fecha o tubo da haste */
export function templeTipGeometry() {
  const g = new THREE.SphereGeometry(0.05, 16, 12);
  g.scale(0.42, 1, 1);
  g.translate(0, -0.42, -3.1);
  return g;
}

/** Núcleo metálico aparente perto da dobradiça */
export function hingeGeometry() {
  return new THREE.CylinderGeometry(0.028, 0.028, 0.16, 16);
}
