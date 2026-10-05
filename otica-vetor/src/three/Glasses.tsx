import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  bridgeGeometry,
  endpieceGeometry,
  hingeGeometry,
  hingePosition,
  lensGeometry,
  rimGeometry,
  templeGeometry,
  templeTipGeometry,
} from './glassesGeometry';
import { makeBlankTexture, makeTortoiseTexture } from './textures';
import type { FinishKey } from './finishes';

export type Quality = 'full' | 'lite';

interface Props {
  finish: FinishKey;
  quality: Quality;
  /** 0 = hastes fechadas, 1 = abertas */
  unfold: { current: number };
}

const SPLAY = 0.07; // abertura natural das hastes
const FOLD = Math.PI / 2 - 0.06;

export function Glasses({ finish, quality, unfold }: Props) {
  const geo = useMemo(
    () => ({
      rimL: rimGeometry(-1),
      rimR: rimGeometry(1),
      lensL: lensGeometry(-1),
      lensR: lensGeometry(1),
      bridge: bridgeGeometry(),
      endL: endpieceGeometry(-1),
      endR: endpieceGeometry(1),
      temple: templeGeometry(),
      tip: templeTipGeometry(),
      hinge: hingeGeometry(),
    }),
    [],
  );

  const tex = useMemo(() => ({ blank: makeBlankTexture(), tortoise: makeTortoiseTexture() }), []);

  const mats = useMemo(() => {
    const frame = new THREE.MeshPhysicalMaterial({
      color: '#2a6656',
      roughness: 0.22,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      map: tex.blank,
      envMapIntensity: 1.25,
    });
    const lens = new THREE.MeshPhysicalMaterial({
      color: '#e8f5ee',
      transparent: true,
      opacity: 0.1,
      roughness: 0.02,
      metalness: 0,
      clearcoat: 1,
      // reflexo colorido de lente com antirreflexo (só no modo completo: shader mais pesado)
      iridescence: quality === 'full' ? 0.6 : 0,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [160, 420],
      envMapIntensity: 1.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const metal = new THREE.MeshStandardMaterial({ color: '#cfd8d3', metalness: 1, roughness: 0.22, envMapIntensity: 1.4 });
    return { frame, lens, metal };
  }, [tex]);

  const targetColor = useRef(new THREE.Color('#2a6656'));

  // aplica o acabamento escolhido
  useEffect(() => {
    const m = mats.frame;
    const before = { map: m.map, transmission: m.transmission > 0, transparent: m.transparent };
    m.map = tex.blank;
    m.transmission = 0;
    m.transparent = false;
    m.opacity = 1;
    m.roughness = 0.22;
    m.clearcoat = 1;
    switch (finish) {
      case 'verde':
        targetColor.current.set('#2a6656');
        break;
      case 'tartaruga':
        targetColor.current.set('#ffffff');
        m.map = tex.tortoise;
        m.roughness = 0.18;
        break;
      case 'cristal':
        targetColor.current.set('#eef8f2');
        m.roughness = 0.06;
        if (quality === 'full') {
          m.transmission = 0.94;
          m.thickness = 0.35;
          m.ior = 1.49;
        } else {
          m.transparent = true;
          m.opacity = 0.5;
        }
        break;
      case 'preto':
        targetColor.current.set('#121614');
        m.roughness = 0.4;
        m.clearcoat = 0.3;
        break;
    }
    if (before.map !== m.map || before.transmission !== m.transmission > 0 || before.transparent !== m.transparent) m.needsUpdate = true;
  }, [finish, quality, mats, tex]);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      tex.blank.dispose();
      tex.tortoise.dispose();
    },
    [geo, mats, tex],
  );

  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    mats.frame.color.lerp(targetColor.current, 1 - Math.exp(-dt * 7));
    const u = unfold.current;
    if (left.current) left.current.rotation.y = THREE.MathUtils.lerp(-FOLD, SPLAY, u);
    if (right.current) right.current.rotation.y = THREE.MathUtils.lerp(FOLD, -SPLAY, u);
  });

  const hl = hingePosition(-1);
  const hr = hingePosition(1);

  return (
    <group>
      <mesh geometry={geo.rimL} material={mats.frame} />
      <mesh geometry={geo.rimR} material={mats.frame} />
      <mesh geometry={geo.bridge} material={mats.frame} />
      <mesh geometry={geo.endL} material={mats.frame} />
      <mesh geometry={geo.endR} material={mats.frame} />
      <mesh geometry={geo.lensL} material={mats.lens} renderOrder={2} />
      <mesh geometry={geo.lensR} material={mats.lens} renderOrder={2} />

      <group ref={left} position={hl}>
        <mesh geometry={geo.hinge} material={mats.metal} />
        <mesh geometry={geo.temple} material={mats.frame} />
        <mesh geometry={geo.tip} material={mats.frame} />
      </group>
      <group ref={right} position={hr}>
        <mesh geometry={geo.hinge} material={mats.metal} />
        <mesh geometry={geo.temple} material={mats.frame} />
        <mesh geometry={geo.tip} material={mats.frame} />
      </group>
    </group>
  );
}
