/**
 * Ações do editor compartilhadas por menus, atalhos, barra de ferramentas e interface mobile.
 * Todas passam por `dispatch` (operações validadas e desfazíveis).
 */
import { copyClips, type EditOp } from '@framestudio/editor-core';
import type { AttributeGroup } from '@framestudio/timeline';
import { secondsToFrames, type Clip, type TextStyle } from '@framestudio/shared';
import { adjacentClip, clipEnd, projectDuration } from '@framestudio/timeline';
import { toast } from '@framestudio/ui';
import { useEditor } from '../state/editor.ts';
import { preview } from '../preview/engine.ts';

const st = () => useEditor.getState();

export function dispatch(op: EditOp, opts?: Parameters<ReturnType<typeof st>['dispatch']>[1]) {
  return st().dispatch(op, opts);
}

export function selectedClips(): Clip[] {
  const { project, selection } = st();
  if (!project) return [];
  return selection.map((id) => project.clips[id]).filter((c): c is Clip => !!c);
}

export function playheadFrame(): number {
  return Math.round(st().playhead);
}

// ─────────────────────────── Reprodução ───────────────────────────

export async function play(): Promise<void> {
  const s = st();
  if (!s.project || s.playing) return;
  s.setPlaying(true);
  await preview.play(s.playhead).catch((e) => {
    console.error(e);
    toast({ kind: 'error', title: 'Falha ao reproduzir', description: String(e?.message ?? e) });
    s.setPlaying(false);
  });
  if (!preview.playing) st().setPlaying(false);
}

export function pause(): void {
  preview.pause();
  const s = st();
  s.setPlaying(false);
  s.setPlayhead(Math.round(s.playhead));
}

export function togglePlay(): void {
  if (st().playing) pause();
  else void play();
}

export function seek(frame: number): void {
  const wasPlaying = st().playing;
  if (wasPlaying) pause();
  st().setPlayhead(Math.round(frame));
  if (wasPlaying) void play();
}

export function step(frames: number): void {
  seek(playheadFrame() + frames);
}

export function seekToStart(): void {
  seek(0);
}
export function seekToEnd(): void {
  const p = st().project;
  if (p) seek(projectDuration(p));
}

/** Pula para o ponto de edição (início/fim de clipe ou marcador) anterior/seguinte. */
export function jumpEdit(dir: 1 | -1): void {
  const p = st().project;
  if (!p) return;
  const f = playheadFrame();
  const pts = new Set<number>([0, projectDuration(p)]);
  for (const c of Object.values(p.clips)) {
    pts.add(c.start);
    pts.add(clipEnd(c));
  }
  for (const m of p.markers) pts.add(m.frame);
  const sorted = [...pts].sort((a, b) => a - b);
  const target = dir > 0 ? sorted.find((x) => x > f) : [...sorted].reverse().find((x) => x < f);
  if (target !== undefined) seek(target);
}

// ─────────────────────────── Edição ───────────────────────────

export function splitAtPlayhead(): void {
  const f = playheadFrame();
  const sel = st().selection;
  const p = st().project;
  if (!p) return;
  const ids = sel.length ? sel.filter((id) => p.clips[id] && f > p.clips[id]!.start && f < clipEnd(p.clips[id]!)) : undefined;
  dispatch({ type: 'clip.split', frame: f, clipIds: ids && ids.length ? ids : undefined });
}

export function deleteSelection(ripple = st().ripple): void {
  const s = st();
  if (s.selectedTransition) {
    dispatch({ type: 'transition.remove', transitionId: s.selectedTransition });
    return;
  }
  if (s.selection.length) dispatch({ type: 'clip.remove', clipIds: s.selection, ripple });
}

export function duplicateSelection(): void {
  if (st().selection.length) dispatch({ type: 'clip.duplicate', clipIds: st().selection }, { select: true });
}

export function copySelection(): boolean {
  const s = st();
  if (!s.project || !s.selection.length) return false;
  const data = copyClips(s.project, s.selection);
  if (data) s.setClipboard({ clips: data.clips, projectId: data.projectId });
  return !!data;
}

export function cutSelection(): void {
  if (copySelection()) deleteSelection(false);
}

export function paste(): void {
  const s = st();
  if (!s.clipboard) return;
  dispatch({ type: 'clip.paste', clips: s.clipboard.clips, at: playheadFrame() }, { select: true });
}

export function copyAttributes(): void {
  const [c] = selectedClips();
  if (c) {
    st().setAttributeClipboard(structuredClone(c));
    toast({ kind: 'info', title: 'Atributos copiados', description: `De “${c.name}”. Use “Colar atributos” em outros clipes.` });
  }
}

export function pasteAttributes(groups: AttributeGroup[] = ['transform', 'opacity', 'color', 'effects', 'blend', 'mask', 'crop', 'audio', 'text']): void {
  const src = st().attributeClipboard;
  if (!src) return;
  dispatch({ type: 'clip.pasteAttributes', source: src, targetIds: st().selection, groups });
}

export function selectAll(): void {
  const p = st().project;
  if (p) st().select(Object.keys(p.clips));
}

export function nudge(frames: number): void {
  const sel = st().selection;
  if (sel.length) dispatch({ type: 'clip.move', clipIds: sel, delta: frames }, { coalesce: 'nudge' });
}

export function addMarkerAtPlayhead(): void {
  dispatch({ type: 'marker.add', frame: playheadFrame(), label: '' });
}

export function addText(style?: Partial<TextStyle>, seconds = 5): string | undefined {
  const p = st().project;
  if (!p) return;
  const res = dispatch({ type: 'clip.addText', start: playheadFrame(), duration: secondsToFrames(seconds, p.settings.fps), style }, { select: true });
  return res?.created[0];
}

export function addAsset(assetId: string, start = playheadFrame(), trackId?: string): string | undefined {
  const res = dispatch({ type: 'clip.addAsset', assetId, start, trackId }, { select: true });
  return res?.created[0];
}

/** Adiciona ao fim da faixa principal (comportamento de "toque para adicionar"). */
export function appendAsset(assetId: string): string | undefined {
  const p = st().project;
  if (!p) return;
  const asset = p.assets[assetId];
  if (!asset) return;
  const kind = asset.kind === 'audio' ? 'audio' : 'video';
  const track = p.tracks.filter((t) => t.kind === kind && !t.locked).pop();
  const end = track ? Math.max(0, ...Object.values(p.clips).filter((c) => c.trackId === track.id).map(clipEnd)) : 0;
  return addAsset(assetId, end, track?.id);
}

export function detachAudio(): void {
  const [c] = selectedClips();
  if (c) dispatch({ type: 'clip.detachAudio', clipId: c.id }, { select: true });
}

export function freezeFrame(seconds = 2): void {
  const [c] = selectedClips();
  const p = st().project;
  if (c && p) dispatch({ type: 'clip.freeze', clipId: c.id, frame: playheadFrame(), duration: secondsToFrames(seconds, p.settings.fps) }, { select: true });
}

export function groupSelection(): void {
  if (st().selection.length > 1) dispatch({ type: 'clip.group', clipIds: st().selection });
}
export function ungroupSelection(): void {
  if (st().selection.length) dispatch({ type: 'clip.ungroup', clipIds: st().selection });
}

/** Adiciona transição entre o clipe selecionado e o seguinte (ou o anterior). */
export function addTransitionToSelection(type: Parameters<typeof transitionOp>[2] = 'dissolve'): void {
  const p = st().project;
  const [c] = selectedClips();
  if (!p || !c) {
    toast({ kind: 'info', title: 'Selecione um clipe', description: 'A transição é aplicada no corte entre o clipe selecionado e o seguinte.' });
    return;
  }
  const next = adjacentClip(p, c, 'next');
  const prev = adjacentClip(p, c, 'prev');
  if (next && clipEnd(c) === next.start) dispatch(transitionOp(c.id, next.id, type, p.settings.fps), { select: false });
  else if (prev && clipEnd(prev) === c.start) dispatch(transitionOp(prev.id, c.id, type, p.settings.fps));
  else toast({ kind: 'warning', title: 'Nenhum corte adjacente', description: 'Encoste dois clipes na mesma faixa para adicionar uma transição.' });
}

export function transitionOp(from: string, to: string, type: import('@framestudio/shared').TransitionType, fps: number): EditOp {
  return { type: 'transition.add', fromClipId: from, toClipId: to, transition: type, duration: Math.round(fps * 0.8) };
}

// ─────────────────────────── Zoom ───────────────────────────

export function zoomBy(factor: number): void {
  st().setZoom(st().pxPerSecond * factor);
}

export function zoomToFit(viewportPx: number): void {
  const p = st().project;
  if (!p) return;
  const dur = Math.max(1, projectDuration(p) / p.settings.fps);
  st().setZoom((viewportPx - 40) / dur);
}
