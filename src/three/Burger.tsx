import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Stack } from '../data/stacks';
import { buildBunBottom, buildBunTop, buildLayer, disposeObject, type BuildOptions } from './ingredients';
import { rng } from './noise';

export type BuiltBurger = ReturnType<typeof useBuiltBurger>;

interface BurgerProps {
  built: BuiltBurger;
  /** Anima a montagem camada por camada (desligado com movimento reduzido) */
  assemble?: boolean;
  onAssembled?: () => void;
}

const DROP = 3.4;
const STAGGER = 0.085;
// mola levemente subamortecida: cai, assenta, quase sem quique
const OMEGA = 12;
const ZETA = 0.78;
const OMEGA_D = OMEGA * Math.sqrt(1 - ZETA * ZETA);

function springOffset(t: number) {
  if (t <= 0) return 1;
  const decay = Math.exp(-ZETA * OMEGA * t);
  return decay * (Math.cos(OMEGA_D * t) + ((ZETA * OMEGA) / OMEGA_D) * Math.sin(OMEGA_D * t));
}

export function useBuiltBurger(stack: Stack, quality: BuildOptions['quality'], seed = 7) {
  const built = useMemo(() => {
    const opts = { quality };
    const items: { object: THREE.Object3D; y: number; spin: number }[] = [];
    const r = rng(seed + 1000);
    let y = 0;
    const push = (layer: { object: THREE.Object3D; height: number }) => {
      items.push({ object: layer.object, y, spin: (r() - 0.5) * 0.9 });
      y += layer.height;
    };
    push(buildBunBottom(stack.bun, seed, opts));
    stack.layers.forEach((kind, i) => push(buildLayer(kind, seed + i * 17 + 3, opts)));
    push(buildBunTop(stack.bun, seed + 99, opts));
    return { items, height: y };
  }, [stack, quality, seed]);

  useEffect(() => () => built.items.forEach((item) => disposeObject(item.object)), [built]);
  return built;
}

export function Burger({ built, assemble = false, onAssembled }: BurgerProps) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const start = useRef<number | null>(null);
  const finished = useRef(!assemble);

  useFrame((state) => {
    if (finished.current) return;
    if (start.current === null) start.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;
    let settled = true;
    built.items.forEach((item, i) => {
      const group = refs.current[i];
      if (!group) return;
      const local = t - i * STAGGER;
      const k = springOffset(local);
      group.visible = local > -0.02;
      group.position.y = item.y + DROP * k;
      group.rotation.y = item.spin * k;
      if (local < 1.1) settled = false;
    });
    if (settled) {
      built.items.forEach((item, i) => {
        const group = refs.current[i];
        if (!group) return;
        group.position.y = item.y;
        group.rotation.y = 0;
        group.visible = true;
      });
      finished.current = true;
      onAssembled?.();
    }
  });

  return (
    <group position-y={-built.height / 2}>
      {built.items.map((item, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position-y={assemble ? item.y + DROP : item.y}
          visible={!assemble}
        >
          <primitive object={item.object} />
        </group>
      ))}
    </group>
  );
}
