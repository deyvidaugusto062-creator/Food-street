import { memo } from 'react';

/** Faixa de miniaturas reais ao longo do clipe. */
export const ThumbStrip = memo(function ThumbStrip({
  thumbs,
  aspect,
  width,
  height,
  from,
  to,
  duration,
}: {
  thumbs: string[];
  aspect: number;
  width: number;
  height: number;
  from: number;
  to: number;
  duration: number;
}) {
  if (thumbs.length === 0 || width < 4) return null;
  const tileW = Math.max(16, height * aspect);
  const count = Math.min(200, Math.ceil(width / tileW));
  const tiles = [];
  for (let i = 0; i < count; i++) {
    const t = from + ((i + 0.5) / count) * (to - from);
    const idx = thumbs.length === 1 || duration <= 0 ? 0 : Math.min(thumbs.length - 1, Math.max(0, Math.floor((t / duration) * thumbs.length)));
    tiles.push(<img key={i} src={thumbs[idx]} alt="" draggable={false} className="h-full shrink-0 object-cover" style={{ width: tileW }} />);
  }
  return <div className="pointer-events-none absolute inset-0 flex overflow-hidden opacity-80">{tiles}</div>;
});
