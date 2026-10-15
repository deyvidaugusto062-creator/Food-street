import { memo, useEffect, useRef } from 'react';

/** Desenha os picos (min/max intercalados) do trecho [from, to) em segundos da mídia. */
export const Waveform = memo(function Waveform({
  peaks,
  duration,
  from,
  to,
  width,
  height,
  color = 'rgba(255,255,255,0.75)',
  reverse = false,
}: {
  peaks: Float32Array;
  duration: number;
  from: number;
  to: number;
  width: number;
  height: number;
  color?: string;
  reverse?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cssW = Math.max(1, Math.min(width, 8000));
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = color;
    const buckets = peaks.length / 2;
    const mid = c.height / 2;
    for (let x = 0; x < c.width; x++) {
      const p0 = x / c.width;
      const p1 = (x + 1) / c.width;
      const t0 = reverse ? to - p1 * (to - from) : from + p0 * (to - from);
      const t1 = reverse ? to - p0 * (to - from) : from + p1 * (to - from);
      const b0 = Math.max(0, Math.floor((t0 / duration) * buckets));
      const b1 = Math.min(buckets, Math.max(b0 + 1, Math.ceil((t1 / duration) * buckets)));
      let mn = 0;
      let mx = 0;
      for (let b = b0; b < b1; b++) {
        mn = Math.min(mn, peaks[b * 2]!);
        mx = Math.max(mx, peaks[b * 2 + 1]!);
      }
      const y0 = mid - mx * mid * 0.95;
      const y1 = mid - mn * mid * 0.95;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
  }, [peaks, duration, from, to, cssW, height, color, reverse]);
  return <canvas ref={ref} style={{ width: width > 8000 ? '100%' : cssW, height }} className="pointer-events-none block" aria-hidden />;
});
