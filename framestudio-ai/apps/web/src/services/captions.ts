import { toast } from '@framestudio/ui';
import { formatSrtTime, formatVttTime, type CaptionClip, type Project } from '@framestudio/shared';
import { downloadBlob, sanitizeFileName } from '../lib/download.ts';

export function captionClips(project: Project): CaptionClip[] {
  return Object.values(project.clips)
    .filter((c): c is CaptionClip => c.type === 'caption')
    .sort((a, b) => a.start - b.start);
}

export function toSrt(project: Project): string {
  const fps = project.settings.fps;
  return captionClips(project)
    .map((c, i) => `${i + 1}\n${formatSrtTime(c.start / fps)} --> ${formatSrtTime((c.start + c.duration) / fps)}\n${c.text.content}\n`)
    .join('\n');
}

export function toVtt(project: Project): string {
  const fps = project.settings.fps;
  return (
    'WEBVTT\n\n' +
    captionClips(project)
      .map((c) => `${formatVttTime(c.start / fps)} --> ${formatVttTime((c.start + c.duration) / fps)}\n${c.text.content}\n`)
      .join('\n')
  );
}

export function exportCaptions(project: Project, format: 'srt' | 'vtt'): void {
  if (captionClips(project).length === 0) {
    toast({ kind: 'info', title: 'Não há legendas no projeto', description: 'Gere legendas no AI Studio ou adicione uma faixa de legendas.' });
    return;
  }
  const text = format === 'srt' ? toSrt(project) : toVtt(project);
  downloadBlob(new Blob([text], { type: format === 'srt' ? 'application/x-subrip' : 'text/vtt' }), `${sanitizeFileName(project.name)}.${format}`);
}
