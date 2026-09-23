import { Suspense, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { stacks } from '../data/stacks';
import {
  DRACO_DECODER_PATH,
  HERO_MODEL_OFFSET_Y,
  HERO_MODEL_SCALE,
  HERO_MODEL_URL,
  HERO_STACK_ID,
} from '../config/scene';
import { Burger, useBuiltBurger } from './Burger';
import {
  Backdrop,
  CinemaLights,
  Embers,
  FloatingIngredients,
  LightPool,
  Steam,
  StudioEnvironment,
  type PointerState,
} from './SceneParts';

export interface HeroSceneProps {
  pointer: PointerState;
  quality: 'high' | 'low';
  motion: boolean;
  layout: 'wide' | 'compact';
  onAssembled?: () => void;
}

function GltfBurger() {
  const gltf = useGLTF(HERO_MODEL_URL, DRACO_DECODER_PATH);
  return <primitive object={gltf.scene} scale={HERO_MODEL_SCALE} position-y={HERO_MODEL_OFFSET_Y} />;
}

function ProceduralBurger({ quality, motion, onAssembled }: Pick<HeroSceneProps, 'quality' | 'motion' | 'onAssembled'>) {
  const built = useBuiltBurger(stacks[HERO_STACK_ID], quality);
  return <Burger built={built} assemble={motion} onAssembled={onAssembled} />;
}

export function HeroScene({ pointer, quality, motion, layout, onAssembled }: HeroSceneProps) {
  const pivot = useRef<THREE.Group>(null);
  const tilt = useRef({ x: 0, y: 0 });
  const { camera } = useThree();
  const high = quality === 'high';

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const g = pivot.current;
    if (!g) return;

    // arraste com momento: segue o dedo 1:1 e depois desliza até parar
    if (!pointer.dragging && Math.abs(pointer.velocity) > 0.0001) {
      pointer.spin += pointer.velocity * dt;
      pointer.velocity *= Math.exp(-dt * 3.2);
    }

    const sway = motion ? Math.sin(t * 0.45) * 0.1 : 0;
    // 1°–3° de resposta ao mouse
    const targetY = pointer.x * 0.05 + sway;
    const targetX = -pointer.y * 0.035;
    const k = 1 - Math.exp(-dt * 4);
    tilt.current.x += (targetX - tilt.current.x) * k;
    tilt.current.y += (targetY - tilt.current.y) * k;

    g.rotation.set(0.06 + tilt.current.x, -0.5 + pointer.spin + tilt.current.y, 0);
    g.position.y = motion ? Math.sin(t * 0.8) * 0.045 : 0;

    // câmera acompanha de leve: cria a paralaxe entre fundo, burger e ingredientes
    camera.position.x += (pointer.x * 0.28 - camera.position.x) * k;
    camera.position.y += (1.25 + pointer.y * 0.14 - camera.position.y) * k;
    camera.lookAt(0, 0.02, 0);

    // sob demanda: continua pedindo quadros até o giro e a inclinação assentarem
    if (!motion) {
      const moving =
        pointer.dragging ||
        Math.abs(pointer.velocity) > 0.001 ||
        Math.abs(targetY - tilt.current.y) > 0.0005 ||
        Math.abs(targetX - tilt.current.x) > 0.0005;
      if (moving) state.invalidate();
    }
  });

  return (
    <>
      <StudioEnvironment intensity={0.42} />
      <CinemaLights pointer={pointer} shadows={high} />
      <Backdrop pointer={pointer} animated={motion} />
      {/* no desktop o burger sobe e vai para a esquerda, abrindo espaço para o card */}
      <group position={layout === 'wide' ? [-0.28, 0.3, 0] : [0, 0.22, 0]}>
        <LightPool y={-1.02} pointer={pointer} />
        <group ref={pivot}>
          {HERO_MODEL_URL ? (
            <Suspense fallback={<ProceduralBurger quality={quality} motion={false} />}>
              <GltfBurger />
            </Suspense>
          ) : (
            <ProceduralBurger quality={quality} motion={motion} onAssembled={onAssembled} />
          )}
        </group>
        {high && motion ? <Steam y={0.9} animated={motion} /> : null}
      </group>
      <FloatingIngredients pointer={pointer} animated={motion} layout={layout} />
      <Embers count={high ? 140 : 48} animated={motion} />
    </>
  );
}
