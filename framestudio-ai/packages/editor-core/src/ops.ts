/**
 * Operações estruturadas do editor. É a ÚNICA porta de entrada para alterar o projeto:
 * a interface, os atalhos e o assistente de IA produzem `EditOp`s, que são validados e aplicados
 * de forma atômica (via immer). Isso também define a lista de operações permitidas para a IA.
 */
import { produce, setAutoFreeze } from 'immer';
import {
  createId,
  FrameStudioError,
  type AnimatableProp,
  type Clip,
  type Direction,
  type Easing,
  type Effect,
  type EffectType,
  type ExportSettings,
  type Marker,
  type MediaAsset,
  type Project,
  type TextStyle,
  type TrackKind,
  type Transition,
  type TransitionType,
  type CaptionWord,
  type Id,
} from '@framestudio/shared';
import * as T from '@framestudio/timeline';
import { sanitizeClip } from './sanitize.ts';
import { defaultEffectParams, EFFECT_DEFS } from './effects.ts';

// O estado do projeto é imutável por convenção; congelar profundamente custa caro em projetos grandes.
setAutoFreeze(false);

export type ClipPatch = Record<string, unknown>;

export type EditOp =
  | { type: 'track.add'; kind: TrackKind; index?: number }
  | { type: 'track.remove'; trackId: Id }
  | { type: 'track.move'; trackId: Id; toIndex: number }
  | { type: 'track.update'; trackId: Id; patch: T.TrackPatch }
  | { type: 'asset.add'; asset: MediaAsset }
  | { type: 'asset.update'; assetId: Id; patch: Partial<MediaAsset> }
  | { type: 'asset.remove'; assetId: Id }
  | { type: 'clip.insert'; clip: Clip; preferredTrackId?: Id }
  | { type: 'clip.addAsset'; assetId: Id; start: number; trackId?: Id }
  | { type: 'clip.addText'; start: number; duration: number; style?: Partial<TextStyle>; trackId?: Id }
  | { type: 'clip.remove'; clipIds: Id[]; ripple?: boolean }
  | { type: 'clip.move'; clipIds: Id[]; delta: number; trackId?: Id }
  | { type: 'clip.trim'; clipId: Id; edge: 'start' | 'end'; frame: number; ripple?: boolean }
  | { type: 'clip.split'; frame: number; clipIds?: Id[] }
  | { type: 'clip.duplicate'; clipIds: Id[] }
  | { type: 'clip.paste'; clips: Clip[]; at: number }
  | { type: 'clip.slip'; clipId: Id; deltaSeconds: number }
  | { type: 'clip.speed'; clipId: Id; speed: number }
  | { type: 'clip.freeze'; clipId: Id; frame: number; duration: number }
  | { type: 'clip.detachAudio'; clipId: Id }
  | { type: 'clip.update'; clipIds: Id[]; patch: ClipPatch }
  | { type: 'clip.group'; clipIds: Id[] }
  | { type: 'clip.ungroup'; clipIds: Id[] }
  | { type: 'clip.pasteAttributes'; source: Clip; targetIds: Id[]; groups: T.AttributeGroup[] }
  | { type: 'keyframe.set'; clipId: Id; prop: AnimatableProp; frame: number; value: number; easing?: Easing }
  | { type: 'keyframe.update'; clipId: Id; prop: AnimatableProp; keyframeId: Id; patch: { frame?: number; value?: number; easing?: Easing } }
  | { type: 'keyframe.remove'; clipId: Id; prop: AnimatableProp; keyframeId: Id }
  | { type: 'keyframe.clear'; clipId: Id; prop: AnimatableProp }
  | { type: 'effect.add'; clipIds: Id[]; effect: EffectType; params?: Record<string, number | string> }
  | { type: 'effect.update'; clipId: Id; effectId: Id; params?: Record<string, number | string>; enabled?: boolean }
  | { type: 'effect.remove'; clipId: Id; effectId: Id }
  | { type: 'effect.reorder'; clipId: Id; effectId: Id; toIndex: number }
  | { type: 'transition.add'; fromClipId: Id; toClipId: Id; transition: TransitionType; duration: number; direction?: Direction; easing?: Easing }
  | { type: 'transition.update'; transitionId: Id; patch: Partial<Pick<Transition, 'type' | 'duration' | 'direction' | 'easing' | 'intensity'>> }
  | { type: 'transition.remove'; transitionId: Id }
  | { type: 'marker.add'; frame: number; label?: string; color?: string }
  | { type: 'marker.update'; markerId: Id; patch: Partial<Omit<Marker, 'id'>> }
  | { type: 'marker.remove'; markerId: Id }
  | { type: 'project.resize'; width: number; height: number; refit?: 'contain' | 'cover' }
  | { type: 'project.fps'; fps: number }
  | { type: 'project.update'; patch: { name?: string; background?: string; favorite?: boolean; thumbnail?: string } }
  | { type: 'project.exportSettings'; patch: Partial<ExportSettings> }
  | { type: 'lut.add'; lut: Project['luts'][string] }
  | {
      type: 'captions.set';
      /** Substitui as legendas da faixa (ou cria uma faixa de legendas). */
      trackId?: Id;
      captions: { start: number; duration: number; content: string; words?: CaptionWord[] }[];
      style?: Partial<TextStyle>;
    }
  | { type: 'batch'; label?: string; ops: EditOp[] };

export interface OpResult {
  project: Project;
  /** Ids criados pela operação (novo clipe, faixa etc.). */
  created: Id[];
  label: string;
}

const LABELS: Record<EditOp['type'], string> = {
  'track.add': 'Adicionar faixa',
  'track.remove': 'Remover faixa',
  'track.move': 'Reordenar faixa',
  'track.update': 'Alterar faixa',
  'asset.add': 'Importar mídia',
  'asset.update': 'Atualizar mídia',
  'asset.remove': 'Remover mídia',
  'clip.insert': 'Inserir clipe',
  'clip.addAsset': 'Adicionar clipe',
  'clip.addText': 'Adicionar texto',
  'clip.remove': 'Remover clipe',
  'clip.move': 'Mover clipe',
  'clip.trim': 'Aparar clipe',
  'clip.split': 'Dividir clipe',
  'clip.duplicate': 'Duplicar clipe',
  'clip.paste': 'Colar clipes',
  'clip.slip': 'Slip',
  'clip.speed': 'Alterar velocidade',
  'clip.freeze': 'Congelar frame',
  'clip.detachAudio': 'Separar áudio',
  'clip.update': 'Alterar propriedades',
  'clip.group': 'Agrupar',
  'clip.ungroup': 'Desagrupar',
  'clip.pasteAttributes': 'Colar atributos',
  'keyframe.set': 'Adicionar keyframe',
  'keyframe.update': 'Editar keyframe',
  'keyframe.remove': 'Remover keyframe',
  'keyframe.clear': 'Limpar keyframes',
  'effect.add': 'Adicionar efeito',
  'effect.update': 'Ajustar efeito',
  'effect.remove': 'Remover efeito',
  'effect.reorder': 'Reordenar efeito',
  'transition.add': 'Adicionar transição',
  'transition.update': 'Ajustar transição',
  'transition.remove': 'Remover transição',
  'marker.add': 'Adicionar marcador',
  'marker.update': 'Editar marcador',
  'marker.remove': 'Remover marcador',
  'project.resize': 'Alterar proporção',
  'project.fps': 'Alterar FPS',
  'project.update': 'Alterar projeto',
  'project.exportSettings': 'Configurar exportação',
  'lut.add': 'Importar LUT',
  'captions.set': 'Gerar legendas',
  batch: 'Várias alterações',
};

export function opLabel(op: EditOp): string {
  return op.type === 'batch' && op.label ? op.label : LABELS[op.type];
}

function fail(msg: string): never {
  throw new FrameStudioError('INVALID_OPERATION', msg);
}

function requireClip(p: Project, id: string): Clip {
  const c = p.clips[id];
  if (!c) fail(`Clipe não encontrado: ${id}`);
  return c;
}

function finite(n: unknown, name: string): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) fail(`Valor inválido para ${name}.`);
  return n;
}

const FORBIDDEN_PATCH_KEYS = new Set(['id', 'type', 'trackId', 'start', 'duration', 'assetId', 'keyframes', 'speed']);

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>, path = ''): void {
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') fail('Chave inválida.');
    if (!path && FORBIDDEN_PATCH_KEYS.has(k)) fail(`A propriedade "${k}" não pode ser alterada diretamente.`);
    if (!(k in target)) {
      // Permite somente chaves opcionais conhecidas do modelo.
      const allowedOptional = ['curves', 'hsl', 'lutId', 'lutIntensity', 'eq', 'compressor', 'noiseReduction', 'channelMode', 'normalizeGainDb', 'groupId', 'reverse', 'freeze'];
      if (!allowedOptional.includes(k)) fail(`Propriedade desconhecida: ${path}${k}`);
    }
    const cur = target[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)) {
      deepMerge(cur as Record<string, unknown>, v as Record<string, unknown>, `${path}${k}.`);
    } else if (v === undefined) {
      delete target[k];
    } else {
      if (typeof v === 'number' && !Number.isFinite(v)) fail(`Valor inválido para ${path}${k}.`);
      if (cur !== undefined && cur !== null && v !== null && typeof cur !== typeof v) fail(`Tipo inválido para ${path}${k}.`);
      target[k] = structuredClone(v);
    }
  }
}

function applyInner(p: Project, op: EditOp, created: Id[]): void {
  switch (op.type) {
    case 'track.add':
      created.push(T.addTrack(p, op.kind, op.index).id);
      return;
    case 'track.remove':
      T.removeTrack(p, op.trackId);
      return;
    case 'track.move':
      T.moveTrack(p, op.trackId, finite(op.toIndex, 'índice'));
      return;
    case 'track.update':
      T.updateTrack(p, op.trackId, op.patch);
      return;
    case 'asset.add':
      p.assets[op.asset.id] = structuredClone(op.asset);
      created.push(op.asset.id);
      return;
    case 'asset.update': {
      const a = p.assets[op.assetId];
      if (!a) fail('Mídia não encontrada.');
      const { id: _id, ...rest } = op.patch;
      void _id;
      Object.assign(a, rest);
      return;
    }
    case 'asset.remove':
      if (!p.assets[op.assetId]) fail('Mídia não encontrada.');
      for (const id of Object.keys(p.clips)) {
        const c = p.clips[id]!;
        if ('assetId' in c && c.assetId === op.assetId) T.removeClips(p, [id]);
      }
      delete p.assets[op.assetId];
      return;
    case 'clip.insert': {
      const clip = structuredClone(op.clip);
      T.placeClip(p, sanitizeClip(clip), op.preferredTrackId ?? clip.trackId);
      created.push(clip.id);
      return;
    }
    case 'clip.addAsset': {
      const asset = p.assets[op.assetId];
      if (!asset) fail('Mídia não encontrada no projeto.');
      const clip = T.createMediaClipFromAsset(asset, op.trackId ?? '', finite(op.start, 'início'), p.settings.fps);
      T.placeClip(p, clip, op.trackId);
      created.push(clip.id);
      return;
    }
    case 'clip.addText': {
      const clip = T.createTextClip(op.trackId ?? '', finite(op.start, 'início'), finite(op.duration, 'duração'), op.style);
      if (op.style?.content !== undefined) clip.name = op.style.content.slice(0, 32) || 'Texto';
      const pref = op.trackId ?? p.tracks.find((t) => t.kind === 'text')?.id;
      T.placeClip(p, clip, pref);
      created.push(clip.id);
      return;
    }
    case 'clip.remove':
      T.removeClips(p, op.clipIds, op.ripple);
      return;
    case 'clip.move':
      T.moveClips(p, op.clipIds, finite(op.delta, 'deslocamento'), op.trackId);
      return;
    case 'clip.trim':
      T.trimClip(p, op.clipId, op.edge, finite(op.frame, 'frame'), op.ripple);
      return;
    case 'clip.split': {
      const ids = T.splitAllAt(p, finite(op.frame, 'frame'), op.clipIds);
      if (ids.length === 0) fail('Nenhum clipe sob o playhead para dividir.');
      created.push(...ids);
      return;
    }
    case 'clip.duplicate':
      created.push(...T.duplicateClips(p, op.clipIds));
      return;
    case 'clip.paste': {
      if (op.clips.length === 0) return;
      const minStart = Math.min(...op.clips.map((c) => c.start));
      const groupMap = new Map<string, string>();
      for (const src of op.clips) {
        const c = sanitizeClip(structuredClone(src));
        if ('assetId' in c && !p.assets[c.assetId]) fail('A mídia do clipe copiado não está neste projeto.');
        c.id = createId('clp_');
        c.start = Math.max(0, Math.round(op.at + (src.start - minStart)));
        if (c.groupId) {
          if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, createId('grp_'));
          c.groupId = groupMap.get(c.groupId);
        }
        T.placeClip(p, c, p.tracks.some((t) => t.id === c.trackId) ? c.trackId : undefined);
        created.push(c.id);
      }
      return;
    }
    case 'clip.slip':
      T.slipClip(p, op.clipId, finite(op.deltaSeconds, 'deslocamento'));
      return;
    case 'clip.speed':
      T.setClipSpeed(p, op.clipId, finite(op.speed, 'velocidade'));
      return;
    case 'clip.freeze':
      created.push(T.freezeFrame(p, op.clipId, finite(op.frame, 'frame'), finite(op.duration, 'duração')));
      return;
    case 'clip.detachAudio':
      created.push(T.detachAudio(p, op.clipId));
      return;
    case 'clip.update':
      for (const id of op.clipIds) {
        const c = requireClip(p, id);
        if (T.getTrack(p, c.trackId)?.locked) fail('A faixa está bloqueada.');
        deepMerge(c as unknown as Record<string, unknown>, op.patch);
        sanitizeClip(c);
        if (c.type === 'text' && 'text' in op.patch) c.name = c.text.content.split('\n')[0]!.slice(0, 32) || 'Texto';
      }
      // Reverse/freeze mudam o mapeamento de mídia: valida limites.
      return;
    case 'clip.group':
      created.push(T.groupClips(p, op.clipIds));
      return;
    case 'clip.ungroup':
      T.ungroupClips(p, op.clipIds);
      return;
    case 'clip.pasteAttributes':
      if (T.pasteAttributes(p, op.source, op.targetIds, op.groups) === 0) fail('Nenhum atributo compatível para colar.');
      for (const id of op.targetIds) sanitizeClip(p.clips[id]!);
      return;
    case 'keyframe.set': {
      const c = requireClip(p, op.clipId);
      validateProp(c, op.prop);
      created.push(T.upsertKeyframe(c, op.prop, finite(op.frame, 'frame'), finite(op.value, 'valor'), op.easing).id);
      return;
    }
    case 'keyframe.update': {
      const c = requireClip(p, op.clipId);
      const list = c.keyframes[op.prop];
      const k = list?.find((x) => x.id === op.keyframeId);
      if (!list || !k) fail('Keyframe não encontrado.');
      if (op.patch.value !== undefined) k.value = finite(op.patch.value, 'valor');
      if (op.patch.easing !== undefined) k.easing = op.patch.easing;
      if (op.patch.frame !== undefined) {
        const f = Math.max(0, Math.min(c.duration - 1, Math.round(finite(op.patch.frame, 'frame'))));
        const clash = list.find((x) => x.frame === f && x.id !== k.id);
        if (clash) list.splice(list.indexOf(clash), 1);
        k.frame = f;
        list.sort((a, b) => a.frame - b.frame);
      }
      return;
    }
    case 'keyframe.remove':
      T.removeKeyframe(requireClip(p, op.clipId), op.prop, op.keyframeId);
      return;
    case 'keyframe.clear':
      delete requireClip(p, op.clipId).keyframes[op.prop];
      return;
    case 'effect.add':
      for (const id of op.clipIds) {
        const c = requireClip(p, id);
        if (!('effects' in c)) fail('Este elemento não aceita efeitos.');
        if (!EFFECT_DEFS[op.effect]) fail(`Efeito desconhecido: ${op.effect}`);
        const fx: Effect = { id: createId('fx_'), type: op.effect, enabled: true, params: { ...defaultEffectParams(op.effect), ...op.params } };
        c.effects.push(fx);
        sanitizeClip(c);
        created.push(fx.id);
      }
      return;
    case 'effect.update': {
      const c = requireClip(p, op.clipId);
      if (!('effects' in c)) fail('Este elemento não aceita efeitos.');
      const fx = c.effects.find((e) => e.id === op.effectId);
      if (!fx) fail('Efeito não encontrado.');
      if (op.params) Object.assign(fx.params, op.params);
      if (op.enabled !== undefined) fx.enabled = op.enabled;
      sanitizeClip(c);
      return;
    }
    case 'effect.remove': {
      const c = requireClip(p, op.clipId);
      if (!('effects' in c)) fail('Este elemento não aceita efeitos.');
      c.effects = c.effects.filter((e) => e.id !== op.effectId);
      for (const k of Object.keys(c.keyframes)) if (k.startsWith(`effect:${op.effectId}:`)) delete c.keyframes[k as AnimatableProp];
      return;
    }
    case 'effect.reorder': {
      const c = requireClip(p, op.clipId);
      if (!('effects' in c)) fail('Este elemento não aceita efeitos.');
      const i = c.effects.findIndex((e) => e.id === op.effectId);
      if (i < 0) fail('Efeito não encontrado.');
      const [fx] = c.effects.splice(i, 1);
      c.effects.splice(Math.max(0, Math.min(op.toIndex, c.effects.length)), 0, fx!);
      return;
    }
    case 'transition.add':
      created.push(
        T.addTransition(p, op.fromClipId, op.toClipId, {
          type: op.transition,
          duration: finite(op.duration, 'duração'),
          direction: op.direction,
          easing: op.easing,
        }),
      );
      return;
    case 'transition.update':
      T.updateTransition(p, op.transitionId, op.patch);
      return;
    case 'transition.remove':
      T.removeTransition(p, op.transitionId);
      return;
    case 'marker.add':
      created.push(T.addMarker(p, finite(op.frame, 'frame'), op.label, op.color).id);
      return;
    case 'marker.update':
      T.updateMarker(p, op.markerId, op.patch);
      return;
    case 'marker.remove':
      T.removeMarker(p, op.markerId);
      return;
    case 'project.resize':
      T.setProjectSize(p, Math.round(finite(op.width, 'largura')), Math.round(finite(op.height, 'altura')), op.refit);
      return;
    case 'project.fps':
      T.setProjectFps(p, finite(op.fps, 'fps'));
      return;
    case 'project.update':
      if (op.patch.name !== undefined) p.name = op.patch.name.trim() || p.name;
      if (op.patch.background !== undefined) p.settings.background = op.patch.background;
      if (op.patch.favorite !== undefined) p.favorite = op.patch.favorite;
      if (op.patch.thumbnail !== undefined) p.thumbnail = op.patch.thumbnail;
      return;
    case 'project.exportSettings':
      Object.assign(p.exportSettings, op.patch);
      return;
    case 'lut.add':
      p.luts[op.lut.id] = op.lut;
      created.push(op.lut.id);
      return;
    case 'captions.set': {
      let trackId = op.trackId;
      if (!trackId || !T.getTrack(p, trackId)) {
        const existing = p.tracks.find((t) => t.kind === 'caption');
        trackId = existing?.id ?? T.addTrack(p, 'caption', 0).id;
      }
      for (const id of Object.keys(p.clips)) if (p.clips[id]!.trackId === trackId) delete p.clips[id];
      for (const cap of op.captions) {
        const clip = T.createCaptionClip(trackId, cap.start, cap.duration, cap.content, cap.words ?? [], op.style, p.settings.height);
        if (!T.isRangeFree(p, trackId, clip.start, clip.duration)) {
          // Legendas sobrepostas: encurta a anterior para evitar conflito.
          const prev = T.getTrackClips(p, trackId).filter((c) => c.start < clip.start).pop();
          if (prev) prev.duration = Math.max(1, clip.start - prev.start);
          if (!T.isRangeFree(p, trackId, clip.start, clip.duration)) continue;
        }
        p.clips[clip.id] = clip;
        created.push(clip.id);
      }
      return;
    }
    case 'batch':
      for (const sub of op.ops) applyInner(p, sub, created);
      return;
  }
}

function validateProp(c: Clip, prop: AnimatableProp): void {
  const base = ['x', 'y', 'scale', 'rotation', 'opacity'];
  if (base.includes(prop)) {
    if (!('transform' in c) && prop !== 'opacity') fail('Esta propriedade não é animável neste elemento.');
    return;
  }
  if (prop === 'volume') {
    if (c.type !== 'audio' && c.type !== 'video') fail('Volume só se aplica a áudio e vídeo.');
    return;
  }
  if (prop.startsWith('color:')) {
    if (!('color' in c) || !(prop.slice(6) in c.color)) fail('Propriedade de cor inválida.');
    return;
  }
  if (prop.startsWith('effect:')) {
    const [, fxId, param] = prop.split(':');
    if (!('effects' in c)) fail('Este elemento não tem efeitos.');
    const fx = c.effects.find((e) => e.id === fxId);
    if (!fx || !param || typeof fx.params[param] !== 'number') fail('Parâmetro de efeito inválido.');
    return;
  }
  fail(`Propriedade não animável: ${prop}`);
}

/** Aplica a operação de forma atômica. Em caso de erro, o projeto original permanece intacto. */
export function applyOp(project: Project, op: EditOp): OpResult {
  const created: Id[] = [];
  const next = produce(project, (draft) => {
    applyInner(draft, op, created);
    draft.updatedAt = Date.now();
  });
  return { project: next, created, label: opLabel(op) };
}
