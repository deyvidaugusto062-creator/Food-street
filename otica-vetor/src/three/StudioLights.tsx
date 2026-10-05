import { Environment, Lightformer } from '@react-three/drei';

/**
 * Iluminação de estúdio sem arquivos externos: um "softbox" no alto e faixas laterais
 * geram os reflexos alongados nas lentes e no acetato. Renderizado uma única vez (frames=1).
 */
export function StudioLights({ intensity = 1, resolution = 256 }: { intensity?: number; resolution?: number }) {
  return (
    <>
      <ambientLight intensity={0.35 * intensity} />
      <directionalLight position={[3, 5, 4]} intensity={1.6 * intensity} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6 * intensity} color="#b8dec8" />
      <Environment resolution={resolution} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={3.2} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 0.6, 1]} />
        <Lightformer form="rect" intensity={2.4} position={[5, 0.5, 2]} rotation-y={-Math.PI / 2} scale={[6, 0.5, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ff8a33" position={[0, -2, 5]} scale={[8, 1, 1]} />
        <Lightformer form="ring" intensity={4} position={[2, 2.5, 5]} scale={1.2} />
      </Environment>
    </>
  );
}
