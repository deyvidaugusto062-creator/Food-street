import { useCallback, useRef, type ReactNode } from 'react';
import { cx } from './primitives.tsx';

/**
 * Alça de redimensionamento de painéis. O tamanho é controlado pelo chamador (persistido no layout).
 */
export function ResizeHandle({
  direction,
  onResize,
  onEnd,
  className,
}: {
  direction: 'horizontal' | 'vertical';
  /** Delta em px desde o início do arraste. */
  onResize: (delta: number) => void;
  onEnd?: () => void;
  className?: string;
}) {
  const start = useRef(0);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      start.current = direction === 'horizontal' ? e.clientX : e.clientY;
      const move = (ev: PointerEvent) => onResize((direction === 'horizontal' ? ev.clientX : ev.clientY) - start.current);
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        onEnd?.();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    },
    [direction, onResize, onEnd],
  );
  return (
    <div
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      onPointerDown={onPointerDown}
      className={cx(
        'group relative z-10 shrink-0 touch-none bg-transparent',
        direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        className,
      )}
    >
      <div className={cx('absolute bg-line transition-colors group-hover:bg-accent group-active:bg-accent', direction === 'horizontal' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2')} />
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex min-h-0 min-w-0 flex-col overflow-hidden bg-panel', className)}>{children}</div>;
}
