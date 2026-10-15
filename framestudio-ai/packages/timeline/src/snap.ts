import type { Project } from '@framestudio/shared';
import { clipEnd } from './queries.ts';

/** Pontos magnéticos: início/fim de clipes, marcadores, playhead e o zero. */
export function collectSnapPoints(p: Project, excludeIds: ReadonlySet<string>, playhead?: number): number[] {
  const pts = new Set<number>([0]);
  for (const id in p.clips) {
    if (excludeIds.has(id)) continue;
    const c = p.clips[id]!;
    pts.add(c.start);
    pts.add(clipEnd(c));
  }
  for (const m of p.markers) pts.add(m.frame);
  if (playhead !== undefined) pts.add(playhead);
  return [...pts].sort((a, b) => a - b);
}

/** Retorna o ponto magnético mais próximo dentro do limiar, ou null. */
export function snapFrame(frame: number, points: readonly number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDist = threshold + 1;
  for (const pt of points) {
    const d = Math.abs(pt - frame);
    if (d <= threshold && d < bestDist) {
      best = pt;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Para um item de [start, start+duration) sendo arrastado, calcula o deslocamento magnético
 * considerando tanto a borda inicial quanto a final.
 */
export function snapRange(start: number, duration: number, points: readonly number[], threshold: number): { start: number; snappedTo: number | null } {
  const s = snapFrame(start, points, threshold);
  const e = snapFrame(start + duration, points, threshold);
  if (s === null && e === null) return { start, snappedTo: null };
  if (e === null || (s !== null && Math.abs(s - start) <= Math.abs(e - (start + duration)))) return { start: s!, snappedTo: s };
  return { start: e - duration, snappedTo: e };
}
