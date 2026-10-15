import type { Clip, Project, Track, Transition, VideoClip } from '@framestudio/shared';
import { applyEasing } from '@framestudio/shared';
import { clipEnd, sourceTimeAt, visualTracksBottomUp } from '@framestudio/timeline';

export interface TransitionPlan {
  transition: Transition;
  a: Clip;
  b: Clip;
  /** Progresso já com easing (0..1). */
  progress: number;
}

export interface TrackPlan {
  track: Track;
  clip?: Clip;
  transition?: TransitionPlan;
}

/** Janela [início, fim) da transição em frames: centrada no ponto de corte. */
export function transitionWindow(t: Transition, b: Clip): [number, number] {
  const start = b.start - Math.floor(t.duration / 2);
  return [start, start + t.duration];
}

/**
 * O que deve ser desenhado em cada faixa visual no frame (de baixo para cima).
 * `frame` pode ser fracionário (exportação com FPS diferente do projeto).
 */
export function planFrame(project: Project, frame: number, opts: { captions?: boolean } = {}): TrackPlan[] {
  const out: TrackPlan[] = [];
  const trackTransitions = new Map<string, Transition[]>();
  for (const id in project.transitions) {
    const t = project.transitions[id]!;
    const list = trackTransitions.get(t.trackId) ?? [];
    list.push(t);
    trackTransitions.set(t.trackId, list);
  }
  for (const track of visualTracksBottomUp(project)) {
    if (track.hidden) continue;
    if (track.kind === 'caption' && opts.captions === false) continue;
    let plan: TrackPlan | null = null;
    for (const t of trackTransitions.get(track.id) ?? []) {
      const a = project.clips[t.fromClipId];
      const b = project.clips[t.toClipId];
      if (!a || !b) continue;
      const [w0, w1] = transitionWindow(t, b);
      if (frame >= w0 && frame < w1) {
        const raw = (frame - w0) / Math.max(1, t.duration);
        plan = { track, transition: { transition: t, a, b, progress: applyEasing(t.easing, raw) } };
        break;
      }
    }
    if (!plan) {
      for (const id in project.clips) {
        const c = project.clips[id]!;
        if (c.trackId === track.id && frame >= c.start && frame < clipEnd(c)) {
          plan = { track, clip: c };
          break;
        }
      }
    }
    if (plan) out.push(plan);
  }
  return out;
}

export interface VideoRequest {
  clip: VideoClip;
  /** Tempo da mídia de origem (s). */
  time: number;
}

/** Quadros de vídeo necessários para desenhar o frame. */
export function videoRequests(project: Project, plan: TrackPlan[], frame: number): VideoRequest[] {
  const out: VideoRequest[] = [];
  const fps = project.settings.fps;
  const add = (c: Clip | undefined) => {
    if (c?.type === 'video') out.push({ clip: c, time: sourceTimeAt(c, frame, fps, project.assets[c.assetId]) });
  };
  for (const p of plan) {
    add(p.clip);
    add(p.transition?.a);
    add(p.transition?.b);
  }
  return out;
}

export function imageRequests(plan: TrackPlan[]): string[] {
  const ids = new Set<string>();
  for (const p of plan) for (const c of [p.clip, p.transition?.a, p.transition?.b]) if (c?.type === 'image') ids.add(c.assetId);
  return [...ids];
}
