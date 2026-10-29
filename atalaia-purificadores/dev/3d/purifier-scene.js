/*
 * Cena 3D do purificador (Three.js). Fonte do arquivo js/scene3d.js.
 * Para gerar de novo: cd dev && npm install && npm run build:3d
 *
 * API global:  window.AtalaiaScene.mount(canvas, options) → { dispose, setVariant }
 *              window.AtalaiaScene.renderStill(variant, size) → dataURL (usado para gerar as imagens)
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  MeshBasicMaterial, PlaneGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, TorusGeometry,
  CanvasTexture, Vector2, Color, DirectionalLight, PMREMGenerator, SRGBColorSpace, NeutralToneMapping,
  InstancedMesh, Object3D, MathUtils, DoubleSide, Clock, AdditiveBlending, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const VARIANTS = {
  branco: { body: '#f7f9fc', metal: 0.0, rough: 0.32, panelA: '#3d9bf2', panelB: '#0a3f86', accent: '#5b6878' },
  prata: { body: '#c9d2dc', metal: 0.55, rough: 0.28, panelA: '#4a5f7a', panelB: '#121c2b', accent: '#2f3a48' },
  grafite: { body: '#3b444f', metal: 0.25, rough: 0.35, panelA: '#5fb0ff', panelB: '#0a4fb0', accent: '#1a2028' },
  azul: { body: '#dcecff', metal: 0.0, rough: 0.3, panelA: '#ffffff', panelB: '#cfe3fa', accent: '#3a6ea8', darkIcon: true },
};

/* ---------- Texturas desenhadas em canvas ---------- */
function panelTexture(v) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 600;
  const g = c.getContext('2d');
  const r = 70;
  g.beginPath();
  g.roundRect(0, 0, 512, 600, r);
  const grad = g.createLinearGradient(0, 0, 300, 600);
  grad.addColorStop(0, v.panelA);
  grad.addColorStop(1, v.panelB);
  g.fillStyle = grad;
  g.fill();
  // reflexo diagonal
  g.save();
  g.clip();
  const shine = g.createLinearGradient(0, 0, 512, 600);
  shine.addColorStop(0, 'rgba(255,255,255,0.35)');
  shine.addColorStop(0.42, 'rgba(255,255,255,0.06)');
  shine.addColorStop(0.43, 'rgba(255,255,255,0)');
  g.fillStyle = shine;
  g.fillRect(0, 0, 512, 600);
  g.restore();
  const ink = v.darkIcon ? '#1f7ae0' : '#ffffff';
  // gota
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(256, 110);
  g.bezierCurveTo(205, 175, 180, 215, 180, 255);
  g.arc(256, 255, 76, Math.PI, 0, true);
  g.bezierCurveTo(332, 215, 307, 175, 256, 110);
  g.fill();
  g.strokeStyle = v.darkIcon ? 'rgba(255,255,255,.7)' : 'rgba(10,63,134,.45)';
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(256, 262, 40, Math.PI * 0.55, Math.PI * 0.95);
  g.stroke();
  // barra e botões
  g.globalAlpha = 0.5;
  g.fillStyle = ink;
  g.beginPath();
  g.roundRect(150, 395, 212, 12, 6);
  g.fill();
  [176, 256, 336].forEach((x, i) => {
    g.globalAlpha = i === 0 ? 0.95 : 0.6;
    g.beginPath();
    g.arc(x, 470, 22, 0, Math.PI * 2);
    g.fill();
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,10,25,0.55)');
  grad.addColorStop(0.45, 'rgba(0,10,25,0.25)');
  grad.addColorStop(1, 'rgba(0,10,25,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

function grilleTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#7b8796';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#3d4753';
  for (let x = 14; x < 256; x += 18) g.fillRect(x, 10, 8, 44);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/* ---------- Modelo ---------- */
function buildPurifier(v, opts) {
  const { quality } = opts;
  const outer = new Group();
  const root = new Group();
  root.position.z = -0.45; // centraliza corpo + bandeja sobre o pedestal
  outer.add(root);
  const hq = quality === 'high';

  const bodyMat = new MeshPhysicalMaterial({
    color: v.body, metalness: v.metal, roughness: v.rough, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const body = new Mesh(new RoundedBoxGeometry(2.3, 3.7, 1.7, 8, 0.36), bodyMat);
  body.position.y = 1.85;
  root.add(body);

  // tampa superior levemente destacada
  const cap = new Mesh(new RoundedBoxGeometry(2.36, 0.22, 1.76, 6, 0.1), new MeshPhysicalMaterial({
    color: new Color(v.body).multiplyScalar(0.92), metalness: v.metal, roughness: 0.22, clearcoat: 1,
  }));
  cap.position.y = 3.62;
  root.add(cap);
  const chrome = new MeshPhysicalMaterial({ color: '#e9eef4', metalness: 1, roughness: 0.12 });
  const band = new Mesh(new RoundedBoxGeometry(2.34, 0.05, 1.74, 4, 0.02), chrome);
  band.position.y = 3.49;
  root.add(band);
  // faixa de luz de status
  const led = new Mesh(new RoundedBoxGeometry(0.9, 0.05, 0.04, 2, 0.02), new MeshBasicMaterial({ color: '#7fdcff' }));
  led.position.set(0, 1.47, 0.86);
  root.add(led);

  // moldura escura do painel + painel com ícone
  const bezel = new Mesh(new RoundedBoxGeometry(1.86, 2.12, 0.12, 6, 0.2), new MeshPhysicalMaterial({
    color: '#0b1726', roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03,
  }));
  bezel.position.set(0, 2.45, 0.83);
  root.add(bezel);
  const panelTex = panelTexture(v);
  const panel = new Mesh(new PlaneGeometry(1.72, 2.0), new MeshPhysicalMaterial({
    map: panelTex, emissiveMap: panelTex, emissive: '#ffffff', emissiveIntensity: 0.35,
    roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true,
  }));
  panel.position.set(0, 2.45, 0.895);
  root.add(panel);

  // saída de água
  const accentMat = new MeshPhysicalMaterial({ color: v.accent, metalness: 0.6, roughness: 0.3, clearcoat: 0.6 });
  const spout = new Mesh(new RoundedBoxGeometry(0.52, 0.26, 0.62, 4, 0.08), accentMat);
  spout.position.set(0, 1.2, 1.05);
  root.add(spout);
  const nozzle = new Mesh(new CylinderGeometry(0.07, 0.09, 0.16, 24), chrome);
  nozzle.position.set(0, 1.0, 1.2);
  root.add(nozzle);

  // bandeja
  const tray = new Mesh(new RoundedBoxGeometry(1.5, 0.12, 0.85, 4, 0.05), new MeshStandardMaterial({
    map: grilleTexture(), roughness: 0.5, metalness: 0.4,
  }));
  tray.position.set(0, 0.08, 1.1);
  root.add(tray);

  // copo (vidro) e água
  const glassProfile = [
    new Vector2(0.0, 0.0), new Vector2(0.27, 0.0), new Vector2(0.31, 0.62), new Vector2(0.29, 0.62),
    new Vector2(0.25, 0.04), new Vector2(0.0, 0.04),
  ];
  // Vidro sem transmissão de propósito: um material transmissivo esconderia a água dentro dele.
  const glassMat = new MeshPhysicalMaterial({
    color: '#eef8ff', transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0, clearcoat: 1,
    clearcoatRoughness: 0, side: DoubleSide, depthWrite: false,
  });
  const glass = new Mesh(new LatheGeometry(glassProfile, 48), glassMat);
  glass.position.set(0, 0.14, 1.12);
  glass.renderOrder = 2;
  root.add(glass);

  const waterMat = new MeshPhysicalMaterial({
    color: '#2f8fe6', transparent: true, opacity: hq ? 0.82 : 0.78, roughness: 0.03, clearcoat: 1,
    emissive: '#1f7ae0', emissiveIntensity: 0.35,
  });
  // Base da água em y=0 para o nível poder subir (scale.y = quanto o copo está cheio).
  const WATER_H = 0.36;
  const WATER_BASE = 0.19;
  const waterGeo = new CylinderGeometry(0.278, 0.252, WATER_H, 48);
  waterGeo.translate(0, WATER_H / 2, 0);
  const water = new Mesh(waterGeo, waterMat);
  water.position.set(0, WATER_BASE, 1.12);
  root.add(water);

  // jato de água
  const streamMat = new MeshPhysicalMaterial({
    color: '#bfe6ff', transparent: true, opacity: 0.85, roughness: 0, clearcoat: 1, emissive: '#4aa8ff', emissiveIntensity: 0.25,
  });
  const NOZZLE_Y = 0.92;
  const streamGeo = new CylinderGeometry(0.036, 0.042, 1, 16, 1, true);
  streamGeo.translate(0, -0.5, 0);
  const stream = new Mesh(streamGeo, streamMat);
  stream.position.set(0, NOZZLE_Y, 1.2);
  root.add(stream);

  // ondulação na superfície da água
  const ripple = new Mesh(new TorusGeometry(0.08, 0.008, 8, 48), new MeshBasicMaterial({ color: '#d9f0ff', transparent: true, opacity: 0.8 }));
  ripple.rotation.x = Math.PI / 2;
  ripple.position.set(0, 0.555, 1.2);
  root.add(ripple);

  // pedestal de exposição: disco escuro e brilhante com anel de luz
  if (opts.pedestal) {
    const ped = new Mesh(new CylinderGeometry(2.25, 2.35, 0.24, 96), new MeshPhysicalMaterial({
      color: opts.pedestalColor || '#0d2a4a', metalness: 0.4, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05,
    }));
    ped.position.y = -0.12;
    outer.add(ped);
    const ring = new Mesh(new TorusGeometry(2.3, 0.022, 12, 160), new MeshBasicMaterial({ color: '#6fd6ff' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0;
    outer.add(ring);
  }

  // sombra de contato
  const shadow = new Mesh(new PlaneGeometry(4.6, 3.2), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.002, 0.25);
  root.add(shadow);

  // Nível do copo (0 a 1) e jato ligado/desligado.
  function setWater(level, flowing) {
    const l = Math.max(0.02, Math.min(1, level));
    water.scale.y = l;
    const surface = WATER_BASE + WATER_H * l;
    ripple.position.y = surface + 0.003;
    stream.visible = flowing;
    ripple.visible = flowing;
    stream.scale.y = Math.max(0.01, NOZZLE_Y - surface);
  }
  setWater(1, true);

  return { root: outer, stream, ripple, setWater, bodyMat, capMat: cap.material, panelMat: panel.material, dispose() {
    outer.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  } };
}

// Partículas de luz subindo, como bolhas finas na água.
function buildBubbles(count) {
  const mat = new MeshBasicMaterial({
    color: '#8fe3ff', transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false,
  });
  const mesh = new InstancedMesh(new SphereGeometry(1, 20, 14), mat, count);
  const data = Array.from({ length: count }, () => ({
    x: MathUtils.randFloatSpread(6.5),
    y: MathUtils.randFloat(-0.5, 5),
    z: MathUtils.randFloat(-2.5, 1.2),
    s: MathUtils.randFloat(0.018, 0.06),
    v: MathUtils.randFloat(0.12, 0.35),
    p: Math.random() * Math.PI * 2,
  })).filter((b) => Math.abs(b.x) > 1.4 || b.z < -1.2); // não atravessa o purificador
  mesh.count = data.length;
  const dummy = new Object3D();
  return {
    mesh,
    update(t, dt) {
      data.forEach((b, i) => {
        b.y += b.v * dt;
        if (b.y > 5.2) b.y = -0.4;
        dummy.position.set(b.x + Math.sin(t * 0.8 + b.p) * 0.08, b.y, b.z);
        dummy.scale.setScalar(b.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function createRenderer(canvas, { alpha = true, pixelRatio }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

function lights(scene, renderer, rim = '#5cc8ff') {
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = env;
  const key = new DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rimLight = new DirectionalLight(rim, 2.2);
  rimLight.position.set(-5, 3, -4);
  scene.add(rimLight);
  const fill = new DirectionalLight('#9cc9ff', 0.6);
  fill.position.set(-4, 1, 4);
  scene.add(fill);
  pmrem.dispose();
  return env;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const smooth = (t) => t * t * (3 - 2 * t);

/*
 * Roteiro da rolagem (p = 0 no topo da história, 1 no fim):
 * 0 apresentação · 0.25 escolha (acabamento muda) · 0.5 instalação (vista lateral)
 * 0.75 cuidado (close no copo enchendo) · 1 "Beba água limpa" (copo cheio)
 */
const STORY = [
  { p: 0, ry: -0.45, cam: [0, 2.6, 13], look: [0, 1.6, 0], fill: 0.12, mix: 0 },
  { p: 0.25, ry: 0.05, cam: [0, 2.3, 11.6], look: [0, 1.7, 0], fill: 0.12, mix: 1 },
  { p: 0.5, ry: -1.2, cam: [0.4, 1.9, 11.2], look: [0, 1.6, 0], fill: 0.12, mix: 0 },
  { p: 0.75, ry: -0.3, cam: [1.1, 1.5, 5.6], look: [0, 0.95, 0.55], fill: 0.7, mix: 0 },
  { p: 1, ry: -0.55, cam: [0, 2.5, 12.4], look: [0, 1.6, 0], fill: 1, mix: 0 },
];
const lerp = (a, b, t) => a + (b - a) * t;
function storyAt(p) {
  let i = 0;
  while (i < STORY.length - 2 && p > STORY[i + 1].p) i++;
  const a = STORY[i];
  const b = STORY[i + 1];
  const t = smooth(Math.max(0, Math.min(1, (p - a.p) / (b.p - a.p))));
  return {
    ry: lerp(a.ry, b.ry, t),
    cam: a.cam.map((v, k) => lerp(v, b.cam[k], t)),
    look: a.look.map((v, k) => lerp(v, b.look[k], t)),
    fill: lerp(a.fill, b.fill, t),
    mix: lerp(a.mix, b.mix, t),
  };
}

/* ---------- Cena interativa (hero) ---------- */
export function mount(canvas, opts = {}) {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  let quality = opts.quality || (mobile ? 'medium' : 'high');
  // A cena da história ocupa a tela inteira: resolução limitada para não pesar em GPUs integradas.
  const maxDpr = opts.story ? (mobile ? 1.25 : 1.5) : (mobile ? 1.5 : 2);
  const renderer = createRenderer(canvas, { pixelRatio: Math.min(window.devicePixelRatio || 1, maxDpr) });
  const scene = new Scene();
  const env = lights(scene, renderer);
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);

  const stage = new Group();
  scene.add(stage);
  let model = buildPurifier(VARIANTS[opts.variant] || VARIANTS.branco, { quality, pedestal: true });
  stage.add(model.root);
  stage.rotation.y = -0.45;
  const bubbles = buildBubbles(mobile ? 14 : 26);
  scene.add(bubbles.mesh);

  const target = { rx: 0, ry: 0 };
  const current = { rx: 0, ry: 0 };
  // modo história: a rolagem controla câmera, giro e água
  const story = { target: 0, p: 0 };
  const colA = new Color(VARIANTS.branco.body);
  const colB = new Color(VARIANTS.prata.body);
  const capA = colA.clone().multiplyScalar(0.92);
  const capB = colB.clone().multiplyScalar(0.92);
  const camPos = new Vector3();
  const camLook = new Vector3();
  let lastFill = -1;
  const onPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    target.ry = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
    target.rx = ((e.clientY - r.top) / r.height - 0.5) * 0.18;
  };
  const onLeave = () => { target.rx = 0; target.ry = 0; };
  if (opts.interactive !== false) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerleave', onLeave);
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (opts.story) {
      // Desloca o enquadramento: purificador à direita no desktop, mais abaixo no celular.
      const dx = camera.aspect >= 1 ? (opts.offsetX ?? 0.2) : 0;
      const dy = camera.aspect < 1 ? (opts.offsetY ?? 0.2) : 0;
      camera.setViewOffset(w, h, -dx * w, -dy * h, w, h);
      camera.fov = camera.aspect < 0.7 ? 38 : 30;
    } else {
      const fit = camera.aspect < 0.85 ? 14.6 : 13;
      camera.position.set(0, 2.6, fit);
      camera.lookAt(0, 1.6, 0);
    }
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const clock = new Clock();
  let raf = 0;
  let visible = true;
  let start = performance.now();
  let frames = 0;
  let slowFrames = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const intro = easeOut(Math.min((performance.now() - start) / 1800, 1));

    current.rx += (target.rx - current.rx) * 0.05;
    current.ry += (target.ry - current.ry) * 0.05;
    if (opts.story) {
      // inércia: a cena acompanha a rolagem com suavidade
      story.p += (story.target - story.p) * Math.min(1, dt * 6);
      const k = storyAt(story.p);
      stage.rotation.y = k.ry + (1 - intro) * -0.8 + current.ry * 0.5 + Math.sin(t * 0.4) * 0.05;
      stage.rotation.x = current.rx * 0.5;
      stage.position.y = (1 - intro) * -1.2 + Math.sin(t * 0.9) * 0.035;
      camPos.set(k.cam[0], k.cam[1], k.cam[2] * (camera.aspect < 0.7 ? 1.45 : 1));
      camLook.set(k.look[0], k.look[1], k.look[2]);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      model.bodyMat.color.lerpColors(colA, colB, k.mix);
      model.bodyMat.metalness = lerp(VARIANTS.branco.metal, VARIANTS.prata.metal, k.mix);
      model.capMat.color.lerpColors(capA, capB, k.mix);
      const filling = k.fill > lastFill + 0.0005 && k.fill < 0.999;
      model.setWater(k.fill, filling || (k.fill > 0.15 && k.fill < 0.999 && story.p > 0.52));
      lastFill = k.fill;
    } else {
      const scroll = Math.min(window.scrollY / (window.innerHeight || 1), 1.2);
      stage.rotation.y = -0.45 + (1 - intro) * -0.9 + current.ry + Math.sin(t * 0.4) * 0.08 + scroll * 0.5;
      stage.rotation.x = current.rx;
      stage.position.y = (1 - intro) * -1.2 + Math.sin(t * 0.9) * 0.04 - scroll * 0.4;
    }

    model.stream.scale.x = model.stream.scale.z = 1 + Math.sin(t * 22) * 0.08;
    const rp = (t * 1.4) % 1;
    model.ripple.scale.setScalar(1 + rp * 2.4);
    model.ripple.material.opacity = 0.8 * (1 - rp);
    bubbles.update(t, dt);

    renderer.render(scene, camera);

    // qualidade adaptativa: se os primeiros quadros forem lentos, reduz a resolução
    frames++;
    if (frames > 20 && frames < 140 && dt > 0.034) slowFrames++;
    if (frames === 140 && slowFrames > 50) {
      renderer.setPixelRatio(1);
      resize();
    }
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { visible = !document.hidden; if (visible) clock.getDelta(); };
  document.addEventListener('visibilitychange', onVis);

  if (opts.static) {
    start = 0;
    frame();
    cancelAnimationFrame(raf);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    setProgress(p) {
      story.target = Math.max(0, Math.min(1, p));
    },
    setVariant(name) {
      stage.remove(model.root);
      model.dispose();
      model = buildPurifier(VARIANTS[name] || VARIANTS.branco, { quality, pedestal: true });
      stage.add(model.root);
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      model.dispose();
      env.dispose();
      renderer.dispose();
    },
  };
}

function buildRefil() {
  const g = new Group();
  const pleat = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 512, 0);
    for (let i = 0; i <= 32; i++) grad.addColorStop(i / 32, i % 2 ? '#dfe7ef' : '#ffffff');
    x.fillStyle = grad;
    x.fillRect(0, 0, 512, 64);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  })();
  const core = new Mesh(new CylinderGeometry(0.62, 0.62, 2.6, 64, 1, false), new MeshStandardMaterial({ map: pleat, roughness: 0.7 }));
  core.position.y = 1.55;
  g.add(core);
  const shell = new Mesh(new CylinderGeometry(0.7, 0.7, 2.62, 64, 1, true), new MeshPhysicalMaterial({
    color: '#ffffff', transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false,
  }));
  shell.position.y = 1.55;
  g.add(shell);
  const capMat = new MeshPhysicalMaterial({ color: '#1f6fd0', roughness: 0.25, clearcoat: 1 });
  [0.12, 2.98].forEach((y) => {
    const cap = new Mesh(new CylinderGeometry(0.76, 0.76, 0.26, 64), capMat);
    cap.position.y = y;
    g.add(cap);
  });
  const neck = new Mesh(new CylinderGeometry(0.22, 0.26, 0.3, 32), new MeshPhysicalMaterial({ color: '#0b4f96', roughness: 0.3, clearcoat: 1 }));
  neck.position.y = 3.25;
  g.add(neck);
  const shadow = new Mesh(new PlaneGeometry(2.6, 2.6), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  g.add(shadow);
  return g;
}

/* ---------- Imagem estática (geração dos renders do site) ---------- */
export function renderStill(variantName, size = 1200, { angle = -0.5, withBubbles = false, pedestal = false, shot = 'full' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const renderer = createRenderer(canvas, { pixelRatio: 1 });
  renderer.setSize(size, size, false);
  const scene = new Scene();
  lights(scene, renderer);
  const camera = new PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 3.1, pedestal ? 13.2 : 11.6);
  camera.lookAt(0, pedestal ? 1.55 : 1.75, 0);
  if (shot === 'detail') {
    camera.position.set(1.9, 2.6, 6.6);
    camera.lookAt(0, 1.95, 0.4);
  }
  if (variantName === 'refil') {
    const refil = buildRefil();
    refil.rotation.y = angle;
    scene.add(refil);
    camera.position.set(0, 2.4, 9.4);
    camera.lookAt(0, 1.6, 0);
    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/webp', 0.9);
    renderer.dispose();
    return url;
  }
  const model = buildPurifier(VARIANTS[variantName] || VARIANTS.branco, { quality: 'high', pedestal });
  model.root.rotation.y = angle;
  scene.add(model.root);
  if (withBubbles) {
    const b = buildBubbles(26);
    b.update(3, 0);
    scene.add(b.mesh);
  }
  model.ripple.visible = false;
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/webp', 0.9);
  model.dispose();
  renderer.dispose();
  return url;
}

window.AtalaiaScene = { mount, renderStill, VARIANTS };
