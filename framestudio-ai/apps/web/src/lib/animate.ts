import type { AnimatableProp, Clip } from '@framestudio/shared';
import { evaluateKeyframes } from '@framestudio/timeline';
import type { EditOp } from '@framestudio/editor-core';
import { useEditor } from '../state/editor.ts';

/** Valor-base (sem keyframes) de uma propriedade animável. */
export function baseValue(clip: Clip, prop: AnimatableProp): number {
  const c = clip as Clip & Record<string, never>;
  switch (prop) {
    case 'x':
    case 'y':
    case 'scale':
    case 'rotation':
      return 'transform' in clip ? clip.transform[prop] : prop === 'scale' ? 1 : 0;
    case 'opacity':
      return 'opacity' in clip ? clip.opacity : 1;
    case 'volume':
      return 'audio' in clip ? clip.audio.volume : 1;
  }
  if (prop.startsWith('color:') && 'color' in clip) return Number((clip.color as unknown as Record<string, number>)[prop.slice(6)] ?? 0);
  if (prop.startsWith('effect:') && 'effects' in clip) {
    const [, id, param] = prop.split(':');
    return Number(clip.effects.find((e) => e.id === id)?.params[param!] ?? 0);
  }
  void c;
  return 0;
}

/** Valor efetivo no playhead (considera keyframes). */
export function valueAt(clip: Clip, prop: AnimatableProp, frame: number): number {
  return evaluateKeyframes(clip.keyframes[prop], frame - clip.start, baseValue(clip, prop));
}

export function isAnimated(clip: Clip, prop: AnimatableProp): boolean {
  return (clip.keyframes[prop]?.length ?? 0) > 0;
}

export function keyframeAt(clip: Clip, prop: AnimatableProp, frame: number) {
  const local = Math.round(frame - clip.start);
  return clip.keyframes[prop]?.find((k) => k.frame === local);
}

function basePatchOp(clip: Clip, prop: AnimatableProp, value: number): EditOp {
  if (prop === 'x' || prop === 'y' || prop === 'scale' || prop === 'rotation') return { type: 'clip.update', clipIds: [clip.id], patch: { transform: { [prop]: value } } };
  if (prop === 'opacity') return { type: 'clip.update', clipIds: [clip.id], patch: { opacity: value } };
  if (prop === 'volume') return { type: 'clip.update', clipIds: [clip.id], patch: { audio: { volume: value } } };
  if (prop.startsWith('color:')) return { type: 'clip.update', clipIds: [clip.id], patch: { color: { [prop.slice(6)]: value } } };
  const [, effectId, param] = prop.split(':');
  return { type: 'effect.update', clipId: clip.id, effectId: effectId!, params: { [param!]: value } };
}

/**
 * Altera uma propriedade animável: se ela já tem keyframes, grava/atualiza o keyframe no playhead;
 * caso contrário, altera o valor-base.
 */
export function setAnimatable(clip: Clip, prop: AnimatableProp, value: number, coalesce?: string): void {
  const { playhead, dispatch } = useEditor.getState();
  const local = Math.round(playhead - clip.start);
  if (isAnimated(clip, prop) && local >= 0 && local < clip.duration) {
    dispatch({ type: 'keyframe.set', clipId: clip.id, prop, frame: local, value }, { coalesce: coalesce ?? `kf:${clip.id}:${prop}` });
  } else {
    dispatch(basePatchOp(clip, prop, value), { coalesce: coalesce ?? `prop:${clip.id}:${prop}` });
  }
}

/** Liga/desliga keyframe no playhead para a propriedade. */
export function toggleKeyframe(clip: Clip, prop: AnimatableProp): void {
  const { playhead, dispatch } = useEditor.getState();
  const local = Math.round(playhead - clip.start);
  if (local < 0 || local >= clip.duration) return;
  const existing = keyframeAt(clip, prop, playhead);
  if (existing) dispatch({ type: 'keyframe.remove', clipId: clip.id, prop, keyframeId: existing.id });
  else dispatch({ type: 'keyframe.set', clipId: clip.id, prop, frame: local, value: valueAt(clip, prop, playhead), easing: 'ease-in-out' });
}

/** Altera várias propriedades animáveis numa única entrada de histórico. */
export function setAnimatables(clip: Clip, values: Partial<Record<AnimatableProp, number>>, coalesce: string): void {
  const { playhead, dispatch } = useEditor.getState();
  const local = Math.round(playhead - clip.start);
  const ops: EditOp[] = [];
  const transform: Record<string, number> = {};
  for (const [prop, value] of Object.entries(values) as [AnimatableProp, number][]) {
    if (isAnimated(clip, prop) && local >= 0 && local < clip.duration) ops.push({ type: 'keyframe.set', clipId: clip.id, prop, frame: local, value });
    else if (prop === 'x' || prop === 'y' || prop === 'scale' || prop === 'rotation') transform[prop] = value;
    else ops.push(basePatchOp(clip, prop, value));
  }
  if (Object.keys(transform).length) ops.push({ type: 'clip.update', clipIds: [clip.id], patch: { transform } });
  if (ops.length) dispatch({ type: 'batch', ops, label: 'Transformar' }, { coalesce });
}
