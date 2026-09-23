import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { HeroScene } from '../../three/HeroScene';
import type { PointerState } from '../../three/pointer';
import { useInView } from '../../hooks/useInView';
import { isLowPowerDevice } from '../../utils/webgl';
import './Hero3D.css';

export interface Hero3DProps {
  pointer: PointerState;
  reducedMotion: boolean;
  layout: 'wide' | 'compact';
  onReady?: () => void;
  onFail?: () => void;
}

class CanvasBoundary extends Component<{ onFail?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Liga o "invalidate" do R3F ao estado do ponteiro (modo sob demanda). */
function InvalidateBridge({ pointer }: { pointer: PointerState }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    pointer.invalidate = invalidate;
    return () => {
      pointer.invalidate = undefined;
    };
  }, [pointer, invalidate]);
  return null;
}

export default function Hero3D({ pointer, reducedMotion, layout, onReady, onFail }: Hero3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, '120px');
  const [maxDpr, setMaxDpr] = useState(1.5);
  const [ready, setReady] = useState(false);
  const quality = layout === 'wide' && !isLowPowerDevice() ? 'high' : 'low';

  const frameloop = !inView ? 'never' : reducedMotion ? 'demand' : 'always';

  return (
    <div ref={wrapRef} className="hero3d" data-ready={ready || undefined}>
      <CanvasBoundary onFail={onFail}>
        <Canvas
          dpr={[1, maxDpr]}
          shadows={quality === 'high'}
          frameloop={frameloop}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 28, position: [0, 1.25, 7.6], near: 0.1, far: 50 }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            setReady(true);
            onReady?.();
          }}
        >
          <PerformanceMonitor onDecline={() => setMaxDpr(1)} />
          <InvalidateBridge pointer={pointer} />
          <HeroScene pointer={pointer} quality={quality} motion={!reducedMotion} layout={layout} />
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
