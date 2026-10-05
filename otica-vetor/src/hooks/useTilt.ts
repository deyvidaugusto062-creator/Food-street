import { useEffect, type RefObject } from 'react';
import { getFxTier } from '../utils/perf';

/**
 * Inclinação 3D que segue o cursor (somente desktop com mouse e efeitos completos).
 * Escreve variáveis CSS (--rx, --ry, --mx, --my) — o visual fica todo no CSS.
 */
export function useTilt<T extends HTMLElement>(ref: RefObject<T | null>, max = 7) {
  useEffect(() => {
    const el = ref.current;
    if (!el || getFxTier() !== 'full') return;

    let raf = 0;
    let rect: DOMRect | null = null;

    const set = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--rx', `${(-(y - 0.5) * max).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
    };
    const onEnter = () => {
      rect = el.getBoundingClientRect();
      el.dataset.tilting = '';
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      rect ??= el.getBoundingClientRect();
      set((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    };
    const onLeave = () => {
      rect = null;
      delete el.dataset.tilting;
      set(0.5, 0.5);
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, max]);
}
