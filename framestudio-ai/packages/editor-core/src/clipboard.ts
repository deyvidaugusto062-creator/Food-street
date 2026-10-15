import type { Clip, Project } from '@framestudio/shared';

export interface ClipboardData {
  kind: 'framestudio/clips';
  projectId: string;
  clips: Clip[];
}

export function copyClips(project: Project, ids: readonly string[]): ClipboardData | null {
  const clips = ids.map((id) => project.clips[id]).filter((c): c is Clip => !!c);
  if (clips.length === 0) return null;
  return { kind: 'framestudio/clips', projectId: project.id, clips: structuredClone(clips) };
}
