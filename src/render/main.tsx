/**
 * Página interna usada por `npm run render:burgers` para gerar as ilustrações
 * 3D dos cards. Não faz parte do build de produção.
 */
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { stacks } from '../data/stacks';
import { Burger, useBuiltBurger } from '../three/Burger';
import { CinemaLights, SoftShadow, StudioEnvironment } from '../three/SceneParts';

declare global {
  interface Window {
    __RENDER_READY__?: boolean;
  }
}

const params = new URLSearchParams(window.location.search);
const id = params.get('id') ?? 'the-king-brooklyn';
const size = Number(params.get('size') ?? 1000);
const angle = Number(params.get('angle') ?? -0.5);

function Scene() {
  const built = useBuiltBurger(stacks[id], 'high');
  const { camera } = useThree();
  const frames = useRef(0);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const half = built.height / 2 + 0.55;
    const dist = half / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) + 1.1;
    cam.position.set(0, dist * 0.11, dist);
    cam.lookAt(0, -0.02, 0);
    cam.updateProjectionMatrix();
  }, [built, camera]);

  useFrame(() => {
    frames.current += 1;
    if (frames.current === 6) window.__RENDER_READY__ = true;
  });

  return (
    <>
      <StudioEnvironment intensity={0.5} />
      <CinemaLights shadows />
      <group rotation={[0.06, angle, 0]}>
        <Burger built={built} />
      </group>
      <SoftShadow y={-built.height / 2 - 0.01} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <Canvas
    shadows
    dpr={1}
    gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
    camera={{ fov: 24, position: [0, 1.3, 8] }}
    style={{ width: size, height: size }}
  >
    <Scene />
  </Canvas>,
);
