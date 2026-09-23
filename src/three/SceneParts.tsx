import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { rng } from './noise';
import { breadingTexture, pickleTexture, cheeseTexture } from './textures';

/** Converte hex para vetor sRGB cru — o shader escreve a cor exatamente como no CSS. */
export function srgb(hex: string) {
  const c = new THREE.Color();
  c.setStyle(hex, THREE.SRGBColorSpace);
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out, THREE.SRGBColorSpace);
  return new THREE.Vector3(out.r, out.g, out.b);
}

export type { PointerState } from './pointer';
import type { PointerState } from './pointer';

/* ───────────── Ambiente de reflexo (procedural, sem HDR externo) ───────────── */

export function StudioEnvironment({ intensity = 0.4 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

/* ───────────── Luz cinematográfica ───────────── */

export function CinemaLights({ pointer, shadows }: { pointer?: PointerState; shadows: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    if (!pointer || !key.current) return;
    const tx = -3.2 + pointer.x * 1.4;
    const ty = 5 + pointer.y * 0.8;
    key.current.position.x += (tx - key.current.position.x) * 0.05;
    key.current.position.y += (ty - key.current.position.y) * 0.05;
  });
  return (
    <>
      <hemisphereLight args={['#ffe3c4', '#1a0d07', 0.5]} />
      <directionalLight
        ref={key}
        position={[-3.2, 5, 4.2]}
        intensity={2.9}
        color="#ffcf9e"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={1}
        shadow-camera-far={14}
      />
      {/* contraluz laranja — recorta o pão escuro contra o fundo */}
      <directionalLight position={[4.4, 2.2, -3.2]} intensity={6} color="#ed7936" />
      <directionalLight position={[-4.6, 1.2, -2.8]} intensity={2.4} color="#ebc9a5" />
      <pointLight position={[2.4, -0.4, 3.4]} intensity={5} distance={9} color="#ffd9b0" />
    </>
  );
}

/* ───────────── Fundo: luz quente com fumaça muito discreta ───────────── */

const noiseGLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
`;

export function Backdrop({ pointer, animated }: { pointer?: PointerState; animated: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2() },
          uRes: { value: new THREE.Vector2(1, 1) },
          uOrange: { value: srgb('#ed7936') },
          uCream: { value: srgb('#ebc9a5') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform vec2 uMouse;
          uniform vec2 uRes;
          uniform vec3 uOrange, uCream;
          ${noiseGLSL}
          void main() {
            vec2 c = vec2(0.5 + uMouse.x * 0.035, 0.52 + uMouse.y * 0.025);
            vec2 d = (vUv - c) * vec2(1.25, 1.0);
            float r = length(d);
            float glow = smoothstep(0.62, 0.0, r);
            float smoke = fbm(vUv * vec2(3.2, 2.2) + vec2(uTime * 0.012, -uTime * 0.035));
            smoke = smoothstep(0.42, 0.95, smoke) * smoothstep(0.7, 0.1, r);
            // o brilho de fundo fica no CSS (atrás do número 1005); aqui só a fumaça
            vec3 col = mix(uCream, uOrange, 0.35 + 0.3 * glow);
            // some nas bordas do canvas para não desenhar um retângulo
            vec2 sp = gl_FragCoord.xy / uRes;
            float edge = smoothstep(0.0, 0.22, sp.x) * smoothstep(1.0, 0.78, sp.x) * smoothstep(0.0, 0.2, sp.y) * smoothstep(1.0, 0.8, sp.y);
            float alpha = smoke * (0.05 + 0.1 * glow) * edge;
            gl_FragColor = vec4(col * alpha, alpha);
          }
        `,
      }),
    [],
  );
  useEffect(() => {
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    return () => mat.dispose();
  }, [mat]);
  useFrame((state, delta) => {
    if (animated) mat.uniforms.uTime.value += delta;
    state.gl.getDrawingBufferSize(mat.uniforms.uRes.value as THREE.Vector2);
    if (pointer) {
      const m = mat.uniforms.uMouse.value as THREE.Vector2;
      m.x += (pointer.x - m.x) * 0.04;
      m.y += (pointer.y - m.y) * 0.04;
    }
  });
  return (
    <mesh position={[0, 0.2, -4]} material={mat} renderOrder={-2}>
      <planeGeometry args={[16, 10]} />
    </mesh>
  );
}

/* ───────────── Chão de luz + sombra de contato ───────────── */

export function LightPool({ y, pointer }: { y: number; pointer?: PointerState }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uShift: { value: new THREE.Vector2() },
          uOrange: { value: srgb('#ed7936') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec2 uShift;
          uniform vec3 uOrange;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float pool = smoothstep(1.0, 0.0, length(p * vec2(1.0, 1.0))) ;
            vec2 s = (p - uShift) * vec2(1.0, 1.0);
            float shadow = smoothstep(0.42, 0.05, length(s * vec2(1.0, 1.15)));
            float core = smoothstep(0.3, 0.0, length(s * vec2(1.0, 1.15)));
            vec3 light = uOrange * 0.55;
            float a = pool * 0.22;
            vec3 col = light * a;
            // sombra escurece a poça
            col *= 1.0 - shadow * 0.9;
            a = max(a, shadow * 0.55 + core * 0.3);
            gl_FragColor = vec4(col, a);
          }
        `,
      }),
    [],
  );
  useEffect(() => {
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.OneFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    return () => mat.dispose();
  }, [mat]);
  useFrame(() => {
    if (!pointer) return;
    const s = mat.uniforms.uShift.value as THREE.Vector2;
    // a sombra foge da luz, que acompanha o mouse
    s.x += (0.14 - pointer.x * 0.12 - s.x) * 0.05;
    s.y += (0.06 + pointer.y * 0.06 - s.y) * 0.05;
  });
  return (
    <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2} material={mat} renderOrder={-1}>
      <planeGeometry args={[4.4, 4.4]} />
    </mesh>
  );
}

/* ───────────── Partículas: migalhas e poeira de luz ───────────── */

export function Embers({ count, animated }: { count: number; animated: boolean }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(404);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * 8;
      pos[i * 3 + 1] = (r() - 0.5) * 5;
      pos[i * 3 + 2] = -3 + r() * 5;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: srgb('#ffb877') },
        uPixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.06 + aSeed * 0.1) + 2.5, 5.0) - 2.5;
          p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.12;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + aSeed * 5.0) * uPixelRatio * (6.0 / -mv.z);
          float edge = smoothstep(2.5, 1.6, abs(p.y));
          vAlpha = edge * (0.25 + 0.5 * fract(aSeed * 7.0)) * (0.6 + 0.4 * sin(uTime * (0.8 + aSeed) + aSeed * 30.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
    });
    return { geo: g, mat: m };
  }, [count]);
  const { gl } = useThree();
  useEffect(() => {
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat, gl]);
  useFrame((_, delta) => {
    if (animated) mat.uniforms.uTime.value += delta;
  });
  return <points geometry={geo} material={mat} />;
}

/* ───────────── Vapor sobre o burger ───────────── */

export function Steam({ y, animated }: { y: number; animated: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: srgb('#fff1dc') } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform vec3 uColor;
          ${noiseGLSL}
          void main() {
            vec2 p = vUv;
            p.x += (fbm(vec2(p.y * 2.0 - uTime * 0.2, uTime * 0.05)) - 0.5) * 0.35;
            float n = fbm(vec2(p.x * 3.0, p.y * 2.2 - uTime * 0.28));
            float column = smoothstep(0.42, 0.0, abs(p.x - 0.5));
            float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
            float a = smoothstep(0.48, 0.85, n) * column * fade * 0.16;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, delta) => {
    if (animated) mat.uniforms.uTime.value += delta;
  });
  return (
    <mesh position={[0, y + 0.9, -0.2]} material={mat}>
      <planeGeometry args={[1.8, 2.2]} />
    </mesh>
  );
}

/* ───────────── Ingredientes flutuando em profundidade (2.5D) ───────────── */

interface Floater {
  object: THREE.Object3D;
  base: THREE.Vector3;
  depth: number;
  speed: number;
  phase: number;
  spin: THREE.Vector3;
}

export function FloatingIngredients({
  pointer,
  animated,
  layout,
}: {
  pointer?: PointerState;
  animated: boolean;
  layout: 'wide' | 'compact';
}) {
  const floaters = useMemo<Floater[]>(() => {
    const r = rng(77);
    const make = (object: THREE.Object3D, pos: [number, number, number], scale: number): Floater => {
      object.scale.setScalar(scale);
      object.rotation.set(r() * 3, r() * 3, r() * 3);
      return {
        object,
        base: new THREE.Vector3(...pos),
        depth: pos[2],
        speed: 0.35 + r() * 0.35,
        phase: r() * Math.PI * 2,
        spin: new THREE.Vector3((r() - 0.5) * 0.3, (r() - 0.5) * 0.4, (r() - 0.5) * 0.2),
      };
    };
    const ringMat = new THREE.MeshStandardMaterial({ map: breadingTexture(), bumpMap: breadingTexture(), bumpScale: 2.5, roughness: 0.86 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.105, 16, 48), ringMat);
    const face = new THREE.MeshStandardMaterial({ map: pickleTexture(), roughness: 0.22 });
    const side = new THREE.MeshStandardMaterial({ color: '#46561a', roughness: 0.35 });
    const pickleGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.03, 28);
    const pickleA = new THREE.Mesh(pickleGeo, [side, face, face]);
    const pickleB = new THREE.Mesh(pickleGeo, [side, face, face]);
    const cheeseGeo = new THREE.PlaneGeometry(0.55, 0.55, 8, 8);
    const cp = cheeseGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 4) * 0.04 + cp.getY(i) * cp.getY(i) * 0.25);
    cheeseGeo.computeVertexNormals();
    const cheese = new THREE.Mesh(
      cheeseGeo,
      new THREE.MeshStandardMaterial({ color: '#f29a26', emissive: '#6a2200', emissiveIntensity: 0.22, roughness: 0.38, map: cheeseTexture(), side: THREE.DoubleSide }),
    );
    const wide = layout === 'wide';
    return [
      make(ring, wide ? [-1.75, 1.05, -1.2] : [-1.25, 1.15, -1.2], 0.85),
      make(pickleA, wide ? [1.55, 1.3, 0.5] : [1.2, 1.25, 0.2], 1),
      make(pickleB, wide ? [-1.45, -0.95, 1.2] : [-1.05, -1.0, 0.9], 0.75),
      make(cheese, wide ? [1.75, -0.2, -1.1] : [1.25, -0.55, -0.8], 0.9),
    ];
  }, [layout]);

  useEffect(
    () => () =>
      floaters.forEach((f) => {
        const mesh = f.object as THREE.Mesh;
        mesh.geometry.dispose();
      }),
    [floaters],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    floaters.forEach((f) => {
      // quanto mais perto da câmera, mais o elemento reage ao mouse
      const parallax = 0.18 + (f.depth + 2) * 0.12;
      const px = pointer ? pointer.x * parallax : 0;
      const py = pointer ? pointer.y * parallax * 0.6 : 0;
      const bob = animated ? Math.sin(t * f.speed + f.phase) * 0.08 : 0;
      f.object.position.x += (f.base.x + px - f.object.position.x) * 0.06;
      f.object.position.y += (f.base.y + bob + py - f.object.position.y) * 0.06;
      f.object.position.z = f.base.z;
      if (animated) {
        f.object.rotation.x += f.spin.x * delta;
        f.object.rotation.y += f.spin.y * delta;
        f.object.rotation.z += f.spin.z * delta;
      }
    });
  });

  return (
    <>
      {floaters.map((f, i) => (
        <primitive key={i} object={f.object} position={f.base.toArray()} />
      ))}
    </>
  );
}

/* ───────────── Sombra suave (renders em fundo claro) ───────────── */

export function SoftShadow({ y, opacity = 0.42 }: { y: number; opacity?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uOpacity: { value: opacity } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uOpacity;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0 - vec2(0.08, 0.0);
            float d = length(p * vec2(1.0, 1.2));
            float a = (smoothstep(1.0, 0.1, d) * 0.55 + smoothstep(0.55, 0.0, d) * 0.45) * uOpacity;
            gl_FragColor = vec4(vec3(0.08, 0.04, 0.02), a);
          }
        `,
      }),
    [opacity],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2} material={mat} renderOrder={-1}>
      <planeGeometry args={[3.4, 3.4]} />
    </mesh>
  );
}
