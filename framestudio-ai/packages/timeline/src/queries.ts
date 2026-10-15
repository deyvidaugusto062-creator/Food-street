import type { Clip, MediaAsset, MediaClip, Project, Track, TrackKind, Transition, VisualClip } from '@framestudio/shared';

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration;
}

export function getTrack(project: Project, trackId: string): Track | undefined {
  return project.tracks.find((t) => t.id === trackId);
}

/** Clipes de uma faixa, ordenados por início. */
export function getTrackClips(project: Project, trackId: string): Clip[] {
  const out: Clip[] = [];
  for (const id in project.clips) {
    const c = project.clips[id]!;
    if (c.trackId === trackId) out.push(c);
  }
  return out.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** Duração total do projeto em frames (fim do último clipe). */
export function projectDuration(project: Project): number {
  let end = 0;
  for (const id in project.clips) end = Math.max(end, clipEnd(project.clips[id]!));
  return end;
}

export function isMediaClip(c: Clip): c is MediaClip {
  return c.type === 'video' || c.type === 'audio' || c.type === 'image';
}

export function isVisualClip(c: Clip): c is VisualClip {
  return c.type === 'video' || c.type === 'image' || c.type === 'text' || c.type === 'caption';
}

export function hasAudio(c: Clip, project: Project): boolean {
  if (c.type === 'audio') return true;
  if (c.type === 'video') return project.assets[c.assetId]?.hasAudio ?? false;
  return false;
}

/** Quais tipos de clipe uma faixa aceita. */
export function trackAccepts(kind: TrackKind, clip: Pick<Clip, 'type'>): boolean {
  switch (kind) {
    case 'video':
      return clip.type === 'video' || clip.type === 'image' || clip.type === 'adjustment';
    case 'audio':
      return clip.type === 'audio';
    case 'text':
      return clip.type === 'text' || clip.type === 'image' || clip.type === 'adjustment';
    case 'caption':
      return clip.type === 'caption';
  }
}

/** Verifica se o intervalo [start, start+duration) está livre na faixa (ignorando `ignoreIds`). */
export function isRangeFree(
  project: Project,
  trackId: string,
  start: number,
  duration: number,
  ignoreIds: ReadonlySet<string> = new Set(),
): boolean {
  const end = start + duration;
  for (const id in project.clips) {
    const c = project.clips[id]!;
    if (c.trackId !== trackId || ignoreIds.has(c.id)) continue;
    if (c.start < end && clipEnd(c) > start) return false;
  }
  return true;
}

/** Clipes ativos num frame, em qualquer faixa. */
export function clipsAtFrame(project: Project, frame: number): Clip[] {
  const out: Clip[] = [];
  for (const id in project.clips) {
    const c = project.clips[id]!;
    if (frame >= c.start && frame < clipEnd(c)) out.push(c);
  }
  return out;
}

/**
 * Tempo de origem (segundos) correspondente a um frame da timeline.
 * `frame` pode estar fora do clipe (usado por transições); o resultado é limitado à mídia.
 */
export function sourceTimeAt(clip: MediaClip, frame: number, fps: number, asset?: MediaAsset): number {
  if (clip.type === 'image') return 0;
  const local = (frame - clip.start) / fps;
  let t: number;
  if (clip.freeze) t = clip.sourceIn;
  else if (clip.reverse) {
    const span = (clip.duration / fps) * clip.speed;
    t = clip.sourceIn + span - local * clip.speed;
  } else t = clip.sourceIn + local * clip.speed;
  const max = asset && asset.duration > 0 ? asset.duration : Infinity;
  // Garante um tempo estritamente menor que a duração para que o último frame seja decodificável.
  return Math.min(Math.max(0, t), Math.max(0, max - 1e-3));
}

/** Duração máxima (frames) que um clipe de mídia pode ter dado o sourceIn e a velocidade. */
export function maxClipDuration(clip: Clip, asset: MediaAsset | undefined, fps: number): number {
  if (!isMediaClip(clip) || clip.type === 'image') return Number.POSITIVE_INFINITY;
  if (clip.freeze) return Number.POSITIVE_INFINITY;
  if (!asset || asset.duration <= 0) return Number.POSITIVE_INFINITY;
  const remaining = asset.duration - clip.sourceIn;
  return Math.max(1, Math.floor((remaining / clip.speed) * fps + 1e-6));
}

/** Faixas visuais na ordem de composição: de baixo para cima. */
export function visualTracksBottomUp(project: Project): Track[] {
  return project.tracks.filter((t) => t.kind !== 'audio').reverse();
}

export function transitionsForTrack(project: Project, trackId: string): Transition[] {
  return Object.values(project.transitions).filter((t) => t.trackId === trackId);
}

/** Transição em que o clipe participa como saída (`from`) ou entrada (`to`). */
export function transitionOf(project: Project, clipId: string, side: 'from' | 'to'): Transition | undefined {
  for (const id in project.transitions) {
    const t = project.transitions[id]!;
    if (side === 'from' ? t.fromClipId === clipId : t.toClipId === clipId) return t;
  }
  return undefined;
}

/** Clipe imediatamente anterior/seguinte na mesma faixa. */
export function adjacentClip(project: Project, clip: Clip, dir: 'prev' | 'next'): Clip | undefined {
  const list = getTrackClips(project, clip.trackId);
  const i = list.findIndex((c) => c.id === clip.id);
  return dir === 'prev' ? list[i - 1] : list[i + 1];
}

/** Clipes do mesmo grupo (inclui o próprio). */
export function groupMembers(project: Project, clipId: string): Clip[] {
  const c = project.clips[clipId];
  if (!c) return [];
  if (!c.groupId) return [c];
  return Object.values(project.clips).filter((x) => x.groupId === c.groupId);
}
