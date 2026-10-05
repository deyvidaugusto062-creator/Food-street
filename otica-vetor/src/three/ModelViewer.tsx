import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';
import { StudioLights } from './StudioLights';

/**
 * Visualizador de modelo 3D (.glb/.gltf) de uma armação — preparado para quando a ótica
 * tiver modelos reais (fotogrametria/modelagem). Ative preenchendo `model3d` no produto.
 * Arraste para girar, pinça/rolagem para aproximar.
 */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function ModelViewer({ url, label }: { url: string; label: string }) {
  return (
    <div className="model-viewer" role="img" aria-label={label}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.4, 4], fov: 32 }} gl={{ antialias: true, alpha: true }}>
        <StudioLights />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.15}>
            <Center>
              <Model url={url} />
            </Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} minDistance={1.5} maxDistance={8} />
      </Canvas>
    </div>
  );
}
