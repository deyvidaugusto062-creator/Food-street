import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Glasses, type Quality } from './Glasses';
import { StudioLights } from './StudioLights';
import { makeShadowTexture } from './textures';
import type { FinishKey } from './finishes';

export interface HeroSceneProps {
  finish: FinishKey;
  quality: Quality;
  /** false = fora da tela: a cena para de renderizar */
  active: boolean;
  /** Chamado quando o primeiro quadro foi desenhado (troca a imagem estática pelo 3D) */
  onReady?: () => void;
  /** Pose fixa, sem animação (usada para gerar a imagem estática) */
  still?: boolean;
}

const BASE_ROT_Y = -0.5;
const BASE_ROT_X = 0.16;
const easeOut = (t: number) => 1 - (1 - t) ** 4;

/** Ponteiro global normalizado (-1…1), só para mouse */
const pointer = { x: 0, y: 0 };

function Rig({ finish, quality, onReady, still }: Omit<HeroSceneProps, 'active'>) {
  const rig = useRef<THREE.Group>(null);
  const floater = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const unfold = useRef(still ? 1 : 0);
  const intro = useRef(still ? 10 : 0);
  const frames = useRef(0);
  const drag = useRef({ active: false, x: 0, offset: 0, vel: 0 });
  const spin = useRef({ value: 0, target: 0 });
  const firstFinish = useRef(true);
  const { gl, size } = useThree();
  const shadowTex = useMemo(() => makeShadowTexture(), []);

  // giro de "apresentação" ao trocar o acabamento
  useEffect(() => {
    if (firstFinish.current) {
      firstFinish.current = false;
      return;
    }
    spin.current.target += Math.PI * 2;
  }, [finish]);

  // arrastar para girar (com inércia)
  useEffect(() => {
    if (still) return;
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.vel = 0;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = (e.clientX - drag.current.x) * 0.012;
      drag.current.x = e.clientX;
      drag.current.offset += dx;
      drag.current.vel = dx * 60;
    };
    const up = () => (drag.current.active = false);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, still]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const g = rig.current;
    const f = floater.current;
    if (!g || !f) return;

    if (frames.current < 3 && ++frames.current === 3) onReady?.();

    // entrada: hastes abrem e a armação gira até a pose
    intro.current += dt;
    const p = easeOut(Math.min(1, intro.current / 2.1));
    unfold.current = still ? 1 : easeOut(Math.min(1, Math.max(0, (intro.current - 0.35) / 1.6)));

    // rolagem do hero: a armação inclina e sobe levemente
    const heroH = Math.max(1, innerHeight);
    const s = still ? 0 : Math.min(1, scrollY / heroH);

    // inércia do arraste
    const d = drag.current;
    if (!d.active) {
      d.offset += (d.vel * dt);
      d.vel *= Math.exp(-dt * 4);
      d.offset *= Math.exp(-dt * 0.5);
    }

    spin.current.value = THREE.MathUtils.damp(spin.current.value, spin.current.target, 3.2, dt);

    const t = state.clock.elapsedTime;
    const idleY = still ? 0 : Math.sin(t * 0.35) * 0.18;
    const targetY = BASE_ROT_Y + idleY + pointer.x * 0.3 + d.offset + spin.current.value + (1 - p) * -2.6;
    const targetX = BASE_ROT_X + pointer.y * 0.16 + s * 0.45;

    g.rotation.y = still ? targetY : THREE.MathUtils.damp(g.rotation.y, targetY, 5, dt);
    g.rotation.x = still ? targetX : THREE.MathUtils.damp(g.rotation.x, targetX, 5, dt);
    g.rotation.z = Math.sin(t * 0.5) * 0.025 * (still ? 0 : 1);

    const scale = (0.86 + 0.14 * p) * (1 - s * 0.12);
    g.scale.setScalar(scale);

    const floatY = still ? 0 : Math.sin(t * 0.9) * 0.07;
    f.position.y = floatY + s * 0.5;

    if (shadow.current) {
      const k = 1 - floatY * 2.5;
      shadow.current.scale.set(4.2 * k * scale, 1.5 * k * scale, 1);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - s) * (0.85 + 0.15 * k);
    }
  });

  // no celular (tela estreita) a armação fica um pouco menor
  const fit = size.width < 520 ? 0.82 : 1;

  return (
    <group scale={fit}>
      <group ref={floater}>
        <group ref={rig} position={[0, 0, 0]}>
          <group position={[0, 0, 0.9]}>
            <Glasses finish={finish} quality={quality} unfold={unfold} />
          </group>
        </group>
      </group>
      <mesh ref={shadow} position={[0, -1.35, 0]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.5} />
      </mesh>
    </group>
  );
}

export default function HeroScene({ finish, quality, active, onReady, still }: HeroSceneProps) {
  const [dpr, setDpr] = useState(quality === 'full' ? 1.75 : 1.25);

  useEffect(() => {
    if (still) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, [still]);

  return (
    <Canvas
      className="hero3d__canvas"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, dpr]}
      camera={{ position: [0, 0.15, 6.4], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: Boolean(still) }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <StudioLights resolution={quality === 'full' ? 256 : 128} />
      <Rig finish={finish} quality={quality} onReady={onReady} still={still} />
    </Canvas>
  );
}
