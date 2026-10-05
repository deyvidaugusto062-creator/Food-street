import { useRef, useState } from 'react';

/**
 * Giro 360° a partir de uma sequência de fotos (product.spin360).
 * Arraste para os lados ou use as setas do teclado.
 */
export function Spin360({ frames, label }: { frames: string[]; label: string }) {
  const [i, setI] = useState(0);
  const drag = useRef<{ x: number; i: number } | null>(null);
  const step = (n: number) => setI((v) => (((v + n) % frames.length) + frames.length) % frames.length);

  return (
    <div
      className="spin360"
      role="slider"
      tabIndex={0}
      aria-label={`Giro 360° — ${label}`}
      aria-valuemin={1}
      aria-valuemax={frames.length}
      aria-valuenow={i + 1}
      aria-valuetext={`Ângulo ${i + 1} de ${frames.length}`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, i };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const delta = Math.round((e.clientX - drag.current.x) / 12);
        setI((((drag.current.i - delta) % frames.length) + frames.length) % frames.length);
      }}
      onPointerUp={() => (drag.current = null)}
    >
      {frames.map((src, n) => (
        <img key={src} src={src} alt="" draggable={false} hidden={n !== i} loading={n === 0 ? 'eager' : 'lazy'} />
      ))}
      <span className="spin360__hint">Arraste para girar</span>
    </div>
  );
}
