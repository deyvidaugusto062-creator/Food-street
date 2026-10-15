/**
 * Operações da timeline. Todas MUTAM o rascunho recebido (use com `immer.produce`) e lançam
 * `FrameStudioError('INVALID_OPERATION')` quando a operação não é válida. Nenhuma operação
 * toca em arquivos de mídia: tudo é não destrutivo.
 */
import {
  createId,
  createTrack,
  FrameStudioError,
  type AudioClip,
  type Clip,
  type Direction,
  type Easing,
  type Marker,
  type MediaClip,
  type Project,
  type Track,
  type TrackKind,
  type Transition,
  type TransitionType,
} from '@framestudio/shared';
import { deepClone } from './clone.ts';
import { scaleKeyframes, shiftKeyframes } from './keyframes.ts';
import {
  adjacentClip,
  clipEnd,
  getTrack,
  getTrackClips,
  isMediaClip,
  isRangeFree,
  maxClipDuration,
  sourceTimeAt,
  trackAccepts,
} from './queries.ts';

function fail(msg: string): never {
  throw new FrameStudioError('INVALID_OPERATION', msg);
}

function requireClip(p: Project, id: string): Clip {
  const c = p.clips[id];
  if (!c) fail(`Clipe não encontrado: ${id}`);
  return c;
}

function requireTrack(p: Project, id: string): Track {
  const t = getTrack(p, id);
  if (!t) fail(`Faixa não encontrada: ${id}`);
  return t;
}

function assertEditable(p: Project, clip: Clip): void {
  if (requireTrack(p, clip.trackId).locked) fail('A faixa está bloqueada.');
}

// ───────────────────────────── Faixas ─────────────────────────────

export function addTrack(p: Project, kind: TrackKind, index?: number): Track {
  const count = p.tracks.filter((t) => t.kind === kind).length;
  const track = createTrack(kind, count + 1);
  let at = index;
  if (at === undefined) {
    // Visuais novas entram acima da faixa visual mais alta; áudio entra no fim.
    if (kind === 'audio') at = p.tracks.length;
    else {
      const firstOfKind = p.tracks.findIndex((t) => t.kind === kind);
      at = firstOfKind >= 0 ? firstOfKind : kind === 'video' ? p.tracks.findIndex((t) => t.kind === 'audio') : 0;
      if (at < 0) at = p.tracks.length;
    }
  }
  p.tracks.splice(Math.max(0, Math.min(at, p.tracks.length)), 0, track);
  return track;
}

export function removeTrack(p: Project, trackId: string): void {
  const i = p.tracks.findIndex((t) => t.id === trackId);
  if (i < 0) fail('Faixa não encontrada.');
  for (const id of Object.keys(p.clips)) if (p.clips[id]!.trackId === trackId) delete p.clips[id];
  for (const id of Object.keys(p.transitions)) if (p.transitions[id]!.trackId === trackId) delete p.transitions[id];
  p.tracks.splice(i, 1);
}

export function moveTrack(p: Project, trackId: string, toIndex: number): void {
  const i = p.tracks.findIndex((t) => t.id === trackId);
  if (i < 0) fail('Faixa não encontrada.');
  const [t] = p.tracks.splice(i, 1);
  p.tracks.splice(Math.max(0, Math.min(toIndex, p.tracks.length)), 0, t!);
}

export type TrackPatch = Partial<Pick<Track, 'name' | 'locked' | 'hidden' | 'muted' | 'solo' | 'volume' | 'height'>>;

export function updateTrack(p: Project, trackId: string, patch: TrackPatch): void {
  const t = requireTrack(p, trackId);
  Object.assign(t, patch);
  if (t.volume < 0) t.volume = 0;
}

// ───────────────────────────── Clipes ─────────────────────────────

/** Insere um clipe já construído, validando faixa e sobreposição. */
export function insertClip(p: Project, clip: Clip): Clip {
  const track = requireTrack(p, clip.trackId);
  if (track.locked) fail('A faixa está bloqueada.');
  if (!trackAccepts(track.kind, clip)) fail(`A faixa "${track.name}" não aceita clipes do tipo ${clip.type}.`);
  if (clip.duration < 1 || !Number.isFinite(clip.duration)) fail('Duração inválida.');
  if (clip.start < 0) fail('Início inválido.');
  if (isMediaClip(clip) && !p.assets[clip.assetId]) fail('Mídia não encontrada no projeto.');
  if (!isRangeFree(p, clip.trackId, clip.start, clip.duration)) fail('Já existe um clipe nesse intervalo.');
  p.clips[clip.id] = clip;
  return clip;
}

function trackKindFor(clip: Pick<Clip, 'type'>): TrackKind {
  switch (clip.type) {
    case 'audio':
      return 'audio';
    case 'text':
      return 'text';
    case 'caption':
      return 'caption';
    default:
      return 'video';
  }
}

/**
 * Coloca o clipe na faixa preferida; se o intervalo estiver ocupado, procura outra faixa compatível
 * livre e, se não houver, cria uma nova. Retorna o id da faixa usada.
 */
export function placeClip(p: Project, clip: Clip, preferredTrackId?: string): string {
  const candidates: Track[] = [];
  const pref = preferredTrackId ? getTrack(p, preferredTrackId) : undefined;
  if (pref && !pref.locked && trackAccepts(pref.kind, clip)) candidates.push(pref);
  for (const t of p.tracks) if (t !== pref && !t.locked && trackAccepts(t.kind, clip) && t.kind === trackKindFor(clip)) candidates.push(t);
  for (const t of candidates) {
    if (isRangeFree(p, t.id, clip.start, clip.duration)) {
      clip.trackId = t.id;
      insertClip(p, clip);
      return t.id;
    }
  }
  const kind = trackKindFor(clip);
  const idx = pref ? p.tracks.indexOf(pref) : undefined;
  const track = addTrack(p, kind, kind === 'audio' ? (idx !== undefined ? idx + 1 : undefined) : idx);
  clip.trackId = track.id;
  insertClip(p, clip);
  return track.id;
}

function removeTransitionsOf(p: Project, clipId: string): void {
  for (const id of Object.keys(p.transitions)) {
    const t = p.transitions[id]!;
    if (t.fromClipId === clipId || t.toClipId === clipId) delete p.transitions[id];
  }
}

/** Remove clipes. Com `ripple`, os clipes seguintes da mesma faixa avançam para fechar o espaço. */
export function removeClips(p: Project, ids: readonly string[], ripple = false): void {
  const clips = ids.map((id) => requireClip(p, id));
  for (const c of clips) assertEditable(p, c);
  // Remove do fim para o início para que o ripple de cada faixa seja consistente.
  clips.sort((a, b) => b.start - a.start);
  for (const c of clips) {
    removeTransitionsOf(p, c.id);
    delete p.clips[c.id];
    if (ripple) shiftTrackAfter(p, c.trackId, clipEnd(c), -c.duration);
  }
}

/** Desloca todos os clipes da faixa que começam em `from` ou depois. */
export function shiftTrackAfter(p: Project, trackId: string, from: number, delta: number): void {
  if (delta === 0) return;
  for (const id in p.clips) {
    const c = p.clips[id]!;
    if (c.trackId === trackId && c.start >= from) c.start = Math.max(0, c.start + delta);
  }
}

/**
 * Move um conjunto de clipes por `deltaFrames`. Se `targetTrackId` for informado (arraste de um único
 * clipe ou de um grupo da mesma faixa), os clipes trocam de faixa. Falha se houver sobreposição.
 */
export function moveClips(p: Project, ids: readonly string[], deltaFrames: number, targetTrackId?: string): void {
  if (ids.length === 0) return;
  const clips = ids.map((id) => requireClip(p, id));
  for (const c of clips) assertEditable(p, c);
  const minStart = Math.min(...clips.map((c) => c.start));
  const delta = Math.max(-minStart, Math.round(deltaFrames));
  const moving = new Set(ids);
  const sameTrack = clips.every((c) => c.trackId === clips[0]!.trackId);
  const newTrack = targetTrackId && sameTrack ? requireTrack(p, targetTrackId) : undefined;
  if (newTrack) {
    if (newTrack.locked) fail('A faixa de destino está bloqueada.');
    for (const c of clips) if (!trackAccepts(newTrack.kind, c)) fail(`A faixa "${newTrack.name}" não aceita ${c.type}.`);
  }
  for (const c of clips) {
    const trackId = newTrack ? newTrack.id : c.trackId;
    if (!isRangeFree(p, trackId, c.start + delta, c.duration, moving)) fail('Sobreposição com outro clipe.');
  }
  // Verifica colisões entre os próprios clipes movidos quando todos vão para a mesma faixa nova.
  for (const c of clips) {
    if (newTrack && c.trackId !== newTrack.id) removeTransitionsOf(p, c.id);
    c.start += delta;
    if (newTrack) c.trackId = newTrack.id;
  }
  pruneInvalidTransitions(p);
}

/** Remove transições cujos clipes não são mais adjacentes. */
export function pruneInvalidTransitions(p: Project): void {
  for (const id of Object.keys(p.transitions)) {
    const t = p.transitions[id]!;
    const a = p.clips[t.fromClipId];
    const b = p.clips[t.toClipId];
    if (!a || !b || a.trackId !== b.trackId || a.trackId !== t.trackId || clipEnd(a) !== b.start) {
      delete p.transitions[id];
      continue;
    }
    t.duration = Math.min(t.duration, maxTransitionDuration(a, b));
    if (t.duration < 2) delete p.transitions[id];
  }
}

/** Limites de trim para a borda informada, considerando mídia e vizinhos. */
export function trimBounds(p: Project, clipId: string, edge: 'start' | 'end', ripple = false): { min: number; max: number } {
  const c = requireClip(p, clipId);
  const fps = p.settings.fps;
  const asset = isMediaClip(c) ? p.assets[c.assetId] : undefined;
  const prev = adjacentClip(p, c, 'prev');
  const next = adjacentClip(p, c, 'next');
  const end = clipEnd(c);
  if (edge === 'start') {
    let min = prev ? clipEnd(prev) : 0;
    if (isMediaClip(c) && c.type !== 'image' && !c.freeze && asset && asset.duration > 0) {
      if (c.reverse) {
        // Estender o início de um clipe reverso consome mídia após o fim do intervalo.
        const used = (c.duration / fps) * c.speed;
        const room = asset.duration - (c.sourceIn + used);
        min = Math.max(min, c.start - Math.floor((room / c.speed) * fps + 1e-6));
      } else {
        min = Math.max(min, c.start - Math.floor((c.sourceIn / c.speed) * fps + 1e-6));
      }
    }
    return { min, max: end - 1 };
  }
  let max = ripple || !next ? Number.POSITIVE_INFINITY : next.start;
  if (isMediaClip(c) && c.type !== 'image' && !c.freeze && asset && asset.duration > 0) {
    if (c.reverse) max = Math.min(max, c.start + c.duration + Math.floor((c.sourceIn / c.speed) * fps + 1e-6));
    else max = Math.min(max, c.start + maxClipDuration(c, asset, fps));
  }
  return { min: c.start + 1, max };
}

/**
 * Apara a borda do clipe para o frame informado (limitado aos valores válidos).
 * Com `ripple`, o trim da borda final desloca os clipes seguintes da mesma faixa.
 */
export function trimClip(p: Project, clipId: string, edge: 'start' | 'end', frame: number, ripple = false): void {
  const c = requireClip(p, clipId);
  assertEditable(p, c);
  const fps = p.settings.fps;
  const { min, max } = trimBounds(p, clipId, edge, ripple);
  const target = Math.max(min, Math.min(max, Math.round(frame)));
  if (edge === 'start') {
    const delta = target - c.start; // >0 encurta
    if (delta === 0) return;
    const newDuration = c.duration - delta;
    if (isMediaClip(c) && c.type !== 'image' && !c.freeze && !c.reverse) c.sourceIn = Math.max(0, c.sourceIn + (delta / fps) * c.speed);
    shiftKeyframes(c, delta, newDuration);
    c.start = target;
    c.duration = newDuration;
  } else {
    const oldEnd = clipEnd(c);
    const delta = target - oldEnd;
    if (delta === 0) return;
    if (isMediaClip(c) && c.type !== 'image' && !c.freeze && c.reverse) c.sourceIn = Math.max(0, c.sourceIn - (delta / fps) * c.speed);
    c.duration = target - c.start;
    clampKeyframesToDuration(c);
    if (ripple) {
      for (const id in p.clips) {
        const o = p.clips[id]!;
        if (o.id !== c.id && o.trackId === c.trackId && o.start >= oldEnd) o.start += delta;
      }
    }
  }
  pruneInvalidTransitions(p);
}

function clampKeyframesToDuration(c: Clip): void {
  shiftKeyframes(c, 0, c.duration);
}

/** Divide o clipe no frame absoluto. Retorna o id do novo clipe (parte direita). */
export function splitClip(p: Project, clipId: string, frame: number): string {
  const c = requireClip(p, clipId);
  assertEditable(p, c);
  const f = Math.round(frame);
  if (f <= c.start || f >= clipEnd(c)) fail('O ponto de divisão precisa estar dentro do clipe.');
  const fps = p.settings.fps;
  const leftDur = f - c.start;
  const rightDur = c.duration - leftDur;
  const right = deepClone(c) as Clip;
  right.id = createId('clp_');
  right.start = f;
  right.duration = rightDur;
  if (isMediaClip(c) && c.type !== 'image' && !c.freeze) {
    const r = right as MediaClip & { sourceIn: number };
    if (c.reverse) {
      // Esquerda mostra o fim do intervalo; direita mostra o começo.
      (c as MediaClip & { sourceIn: number }).sourceIn = c.sourceIn + (rightDur / fps) * c.speed;
      r.sourceIn = c.sourceIn - (rightDur / fps) * c.speed;
    } else {
      r.sourceIn = c.sourceIn + (leftDur / fps) * c.speed;
    }
  }
  shiftKeyframes(right, leftDur, rightDur);
  c.duration = leftDur;
  shiftKeyframes(c, 0, leftDur);
  // Fades: o da esquerda perde o fade-out, o da direita perde o fade-in.
  if ('audio' in c && 'audio' in right) {
    (right as AudioClip).audio.fadeIn = 0;
    (c as AudioClip).audio.fadeOut = 0;
  }
  if (c.type === 'text' || c.type === 'caption') {
    (c as typeof c).text.animationOut = 'none';
    (right as typeof c).text.animationIn = 'none';
  }
  if (right.type === 'caption' && c.type === 'caption') {
    const cut = leftDur / fps;
    right.words = c.words.filter((w) => w.end > cut).map((w) => ({ ...w, start: Math.max(0, w.start - cut), end: w.end - cut }));
    c.words = c.words.filter((w) => w.start < cut).map((w) => ({ ...w, end: Math.min(w.end, cut) }));
  }
  p.clips[right.id] = right;
  // Transição de saída passa a pertencer à parte direita.
  for (const id in p.transitions) {
    const t = p.transitions[id]!;
    if (t.fromClipId === c.id) t.fromClipId = right.id;
  }
  pruneInvalidTransitions(p);
  return right.id;
}

/** Divide todos os clipes (das faixas desbloqueadas) que cruzam o frame. Retorna os novos ids. */
export function splitAllAt(p: Project, frame: number, onlyIds?: readonly string[]): string[] {
  const out: string[] = [];
  const ids = onlyIds ?? Object.keys(p.clips);
  for (const id of ids) {
    const c = p.clips[id];
    if (!c || frame <= c.start || frame >= clipEnd(c)) continue;
    if (getTrack(p, c.trackId)?.locked) continue;
    out.push(splitClip(p, id, frame));
  }
  return out;
}

/** Duplica clipes logo após o fim da seleção. Retorna os novos ids. */
export function duplicateClips(p: Project, ids: readonly string[]): string[] {
  const clips = ids.map((id) => requireClip(p, id));
  if (clips.length === 0) return [];
  const start = Math.min(...clips.map((c) => c.start));
  const end = Math.max(...clips.map(clipEnd));
  const offset = end - start;
  const groupMap = new Map<string, string>();
  const out: string[] = [];
  for (const c of clips.sort((a, b) => a.start - b.start)) {
    const copy = deepClone(c) as Clip;
    copy.id = createId('clp_');
    copy.start = c.start + offset;
    if (c.groupId) {
      if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, createId('grp_'));
      copy.groupId = groupMap.get(c.groupId);
    }
    placeClip(p, copy, c.trackId);
    out.push(copy.id);
  }
  return out;
}

/** Slip: desloca o conteúdo dentro do clipe sem mudar posição/duração. */
export function slipClip(p: Project, clipId: string, deltaSeconds: number): void {
  const c = requireClip(p, clipId);
  assertEditable(p, c);
  if (!isMediaClip(c) || c.type === 'image') fail('Slip só se aplica a vídeo e áudio.');
  const asset = p.assets[c.assetId];
  const used = (c.duration / p.settings.fps) * c.speed;
  const maxIn = asset && asset.duration > 0 ? Math.max(0, asset.duration - used) : Number.POSITIVE_INFINITY;
  c.sourceIn = Math.max(0, Math.min(maxIn, c.sourceIn + deltaSeconds));
}

export const MIN_SPEED = 0.1;
export const MAX_SPEED = 16;

/** Altera a velocidade mantendo o ponto de entrada; a duração na timeline é recalculada. */
export function setClipSpeed(p: Project, clipId: string, speed: number): void {
  const c = requireClip(p, clipId);
  assertEditable(p, c);
  if (!isMediaClip(c) || c.type === 'image') fail('Velocidade só se aplica a vídeo e áudio.');
  if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) fail(`Velocidade deve estar entre ${MIN_SPEED}x e ${MAX_SPEED}x.`);
  const fps = p.settings.fps;
  const content = (c.duration / fps) * c.speed; // segundos de mídia usados
  let newDuration = Math.max(1, Math.round((content / speed) * fps));
  const next = adjacentClip(p, c, 'next');
  if (next && c.start + newDuration > next.start) {
    // Abre espaço deslocando os clipes seguintes (ripple), preservando a sincronia na faixa.
    shiftTrackAfter(p, c.trackId, next.start, c.start + newDuration - next.start);
  }
  const factor = newDuration / c.duration;
  c.speed = speed;
  const asset = p.assets[c.assetId];
  newDuration = Math.min(newDuration, maxClipDuration(c, asset, fps));
  scaleKeyframes(c, factor);
  c.duration = newDuration;
  clampKeyframesToDuration(c);
  pruneInvalidTransitions(p);
}

/**
 * Congela o frame em `frame`: divide o clipe e insere `durationFrames` de imagem congelada,
 * empurrando o restante da faixa.
 */
export function freezeFrame(p: Project, clipId: string, frame: number, durationFrames: number): string {
  const c = requireClip(p, clipId);
  assertEditable(p, c);
  if (c.type !== 'video') fail('Congelar frame só se aplica a vídeo.');
  const f = Math.round(frame);
  if (f < c.start || f >= clipEnd(c)) fail('O playhead precisa estar sobre o clipe.');
  const asset = p.assets[c.assetId];
  const t = sourceTimeAt(c, f, p.settings.fps, asset);
  const dur = Math.max(1, Math.round(durationFrames));
  // Empurra os clipes seguintes da faixa (exceto o próprio) para abrir espaço.
  for (const id in p.clips) {
    const o = p.clips[id]!;
    if (o.id !== c.id && o.trackId === c.trackId && o.start >= f) o.start += dur;
  }
  if (f > c.start) {
    const rightId = splitClip(p, c.id, f);
    p.clips[rightId]!.start = f + dur;
  } else {
    c.start = f + dur;
  }
  const freeze = deepClone(c);
  freeze.id = createId('clp_');
  freeze.start = f;
  freeze.duration = dur;
  freeze.freeze = true;
  freeze.reverse = false;
  freeze.sourceIn = t;
  freeze.keyframes = {};
  freeze.audio = { ...freeze.audio, muted: true };
  freeze.name = `${c.name} (congelado)`;
  p.clips[freeze.id] = freeze;
  pruneInvalidTransitions(p);
  return freeze.id;
}

/** Separa o áudio de um clipe de vídeo para uma faixa de áudio própria. */
export function detachAudio(p: Project, clipId: string): string {
  const c = requireClip(p, clipId);
  assertEditable(p, c);
  if (c.type !== 'video') fail('Somente clipes de vídeo têm áudio para separar.');
  const asset = p.assets[c.assetId];
  if (!asset?.hasAudio) fail('Este vídeo não possui faixa de áudio.');
  const audio: AudioClip = {
    id: createId('clp_'),
    type: 'audio',
    trackId: '',
    name: `${c.name} (áudio)`,
    start: c.start,
    duration: c.duration,
    keyframes: c.keyframes.volume ? { volume: deepClone(c.keyframes.volume) } : {},
    assetId: c.assetId,
    sourceIn: c.sourceIn,
    speed: c.speed,
    reverse: c.reverse,
    freeze: c.freeze,
    audio: { ...c.audio, muted: false },
    groupId: c.groupId,
  };
  const audioTrack = p.tracks.find((t) => t.kind === 'audio' && !t.locked && isRangeFree(p, t.id, c.start, c.duration));
  placeClip(p, audio, audioTrack?.id);
  c.audio.muted = true;
  delete c.keyframes.volume;
  return audio.id;
}

// ───────────────────────────── Grupos ─────────────────────────────

export function groupClips(p: Project, ids: readonly string[]): string {
  if (ids.length < 2) fail('Selecione ao menos dois elementos para agrupar.');
  const gid = createId('grp_');
  for (const id of ids) requireClip(p, id).groupId = gid;
  return gid;
}

export function ungroupClips(p: Project, ids: readonly string[]): void {
  const groups = new Set(ids.map((id) => requireClip(p, id).groupId).filter(Boolean));
  for (const id in p.clips) if (groups.has(p.clips[id]!.groupId)) delete p.clips[id]!.groupId;
}

// ─────────────────────────── Transições ───────────────────────────

export function maxTransitionDuration(a: Clip, b: Clip): number {
  return Math.max(0, Math.min(a.duration, b.duration));
}

export interface TransitionInput {
  type: TransitionType;
  duration: number;
  direction?: Direction;
  easing?: Easing;
  intensity?: number;
}

/** Adiciona (ou substitui) a transição entre dois clipes adjacentes da mesma faixa. */
export function addTransition(p: Project, fromClipId: string, toClipId: string, input: TransitionInput): string {
  const a = requireClip(p, fromClipId);
  const b = requireClip(p, toClipId);
  assertEditable(p, a);
  if (a.trackId !== b.trackId) fail('Transições exigem clipes na mesma faixa.');
  if (clipEnd(a) !== b.start) fail('Os clipes precisam estar encostados (sem espaço entre eles).');
  if (a.type === 'audio' || b.type === 'audio') fail('Use fades para transições de áudio.');
  const max = maxTransitionDuration(a, b);
  const duration = Math.max(2, Math.min(max, Math.round(input.duration)));
  if (max < 2) fail('Clipes curtos demais para uma transição.');
  for (const id of Object.keys(p.transitions)) {
    const t = p.transitions[id]!;
    if (t.fromClipId === a.id || t.toClipId === b.id) delete p.transitions[id];
  }
  const t: Transition = {
    id: createId('trn_'),
    trackId: a.trackId,
    fromClipId: a.id,
    toClipId: b.id,
    type: input.type,
    duration,
    direction: input.direction ?? 'left',
    easing: input.easing ?? 'ease-in-out',
    intensity: input.intensity ?? 1,
  };
  p.transitions[t.id] = t;
  return t.id;
}

export function updateTransition(p: Project, id: string, patch: Partial<Omit<Transition, 'id' | 'trackId' | 'fromClipId' | 'toClipId'>>): void {
  const t = p.transitions[id];
  if (!t) fail('Transição não encontrada.');
  Object.assign(t, patch);
  const a = p.clips[t.fromClipId];
  const b = p.clips[t.toClipId];
  if (a && b) t.duration = Math.max(2, Math.min(maxTransitionDuration(a, b), Math.round(t.duration)));
}

export function removeTransition(p: Project, id: string): void {
  delete p.transitions[id];
}

// ─────────────────────────── Marcadores ───────────────────────────

export function addMarker(p: Project, frame: number, label = '', color = '#4F8CFF'): Marker {
  const m: Marker = { id: createId('mrk_'), frame: Math.max(0, Math.round(frame)), label, color };
  p.markers.push(m);
  p.markers.sort((a, b) => a.frame - b.frame);
  return m;
}

export function updateMarker(p: Project, id: string, patch: Partial<Omit<Marker, 'id'>>): void {
  const m = p.markers.find((x) => x.id === id);
  if (!m) fail('Marcador não encontrado.');
  Object.assign(m, patch);
  p.markers.sort((a, b) => a.frame - b.frame);
}

export function removeMarker(p: Project, id: string): void {
  p.markers = p.markers.filter((m) => m.id !== id);
}

// ──────────────────────── Copiar atributos ────────────────────────

export type AttributeGroup = 'transform' | 'opacity' | 'color' | 'effects' | 'audio' | 'text' | 'speed' | 'mask' | 'crop' | 'blend';

/** Copia grupos de atributos de `source` para os clipes alvo, quando compatíveis. */
export function pasteAttributes(p: Project, source: Clip, targetIds: readonly string[], groups: readonly AttributeGroup[]): number {
  let applied = 0;
  for (const id of targetIds) {
    const t = requireClip(p, id);
    if (t.id === source.id) continue;
    assertEditable(p, t);
    let touched = false;
    const s = source as unknown as Record<string, unknown>;
    const d = t as unknown as Record<string, unknown>;
    const copy = (key: string) => {
      if (key in s && key in d) {
        d[key] = deepClone(s[key]);
        touched = true;
      }
    };
    for (const g of groups) {
      switch (g) {
        case 'transform':
          copy('transform');
          break;
        case 'opacity':
          copy('opacity');
          break;
        case 'color':
          copy('color');
          break;
        case 'effects':
          if ('effects' in s && 'effects' in d) {
            d.effects = (s.effects as { id: string }[]).map((e) => ({ ...deepClone(e), id: createId('fx_') }));
            touched = true;
          }
          break;
        case 'audio':
          copy('audio');
          break;
        case 'text':
          if ((source.type === 'text' || source.type === 'caption') && (t.type === 'text' || t.type === 'caption')) {
            t.text = { ...deepClone(source.text), content: t.text.content };
            touched = true;
          }
          break;
        case 'speed':
          if (isMediaClip(source) && source.type !== 'image' && isMediaClip(t) && t.type !== 'image') {
            setClipSpeed(p, t.id, source.speed);
            touched = true;
          }
          break;
        case 'mask':
          copy('mask');
          break;
        case 'crop':
          copy('crop');
          break;
        case 'blend':
          copy('blendMode');
          break;
      }
    }
    if (touched) applied++;
  }
  return applied;
}

// ─────────────────────────── Projeto ──────────────────────────────

/**
 * Muda a resolução/proporção do projeto. Com `refit`, os clipes visuais passam a usar o modo
 * informado (ex.: 'cover' para preencher o quadro vertical) e posições são reescaladas.
 */
export function setProjectSize(p: Project, width: number, height: number, refit?: 'contain' | 'cover'): void {
  if (width < 16 || height < 16 || width > 7680 || height > 4320) fail('Resolução fora dos limites suportados (16–7680 × 16–4320).');
  const sx = width / p.settings.width;
  const sy = height / p.settings.height;
  p.settings.width = width % 2 ? width + 1 : width;
  p.settings.height = height % 2 ? height + 1 : height;
  for (const id in p.clips) {
    const c = p.clips[id]!;
    if (!('transform' in c)) continue;
    c.transform.x = Math.round(c.transform.x * sx);
    c.transform.y = Math.round(c.transform.y * sy);
    if (refit && (c.type === 'video' || c.type === 'image')) c.transform.fit = refit;
    if (c.type === 'text' || c.type === 'caption') {
      const k = Math.min(sx, sy);
      c.text.fontSize = Math.max(8, Math.round(c.text.fontSize * k));
      if (c.text.boxWidth) c.text.boxWidth = Math.round(c.text.boxWidth * sx);
    }
  }
}

/** Muda o FPS do projeto, convertendo posições/durações para preservar o tempo real. */
export function setProjectFps(p: Project, fps: number): void {
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) fail('FPS inválido.');
  const k = fps / p.settings.fps;
  if (k === 1) return;
  for (const id in p.clips) {
    const c = p.clips[id]!;
    c.start = Math.round(c.start * k);
    c.duration = Math.max(1, Math.round(c.duration * k));
    scaleKeyframes(c, k);
  }
  // Corrige sobreposições criadas por arredondamento.
  for (const t of p.tracks) {
    const list = getTrackClips(p, t.id);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (cur.start < clipEnd(prev)) prev.duration = Math.max(1, cur.start - prev.start);
    }
  }
  for (const id in p.transitions) p.transitions[id]!.duration = Math.round(p.transitions[id]!.duration * k);
  for (const m of p.markers) m.frame = Math.round(m.frame * k);
  for (const id in p.clips) {
    const c = p.clips[id]!;
    if ('text' in c) c.text.animationDuration = Math.round(c.text.animationDuration * k);
  }
  p.settings.fps = fps;
  p.exportSettings.fps = fps;
  pruneInvalidTransitions(p);
}

/**
 * Remove o intervalo [start, end) de todas as faixas desbloqueadas (ou das informadas): divide os
 * clipes nas bordas, apaga o que está dentro e puxa o restante para a esquerda, mantendo as
 * faixas sincronizadas. Faixas bloqueadas não são alteradas.
 */
export function removeRange(p: Project, start: number, end: number, trackIds?: readonly string[]): number {
  const s = Math.max(0, Math.round(start));
  const e = Math.round(end);
  if (e <= s) fail('Intervalo vazio.');
  const len = e - s;
  const tracks = p.tracks.filter((t) => !t.locked && (!trackIds || trackIds.includes(t.id)));
  const allowed = new Set(tracks.map((t) => t.id));
  for (const id of Object.keys(p.clips)) {
    const c = p.clips[id];
    if (!c || !allowed.has(c.trackId)) continue;
    if (s > c.start && s < clipEnd(c)) splitClip(p, c.id, s);
  }
  for (const id of Object.keys(p.clips)) {
    const c = p.clips[id];
    if (!c || !allowed.has(c.trackId)) continue;
    if (e > c.start && e < clipEnd(c)) splitClip(p, c.id, e);
  }
  for (const id of Object.keys(p.clips)) {
    const c = p.clips[id]!;
    if (!allowed.has(c.trackId)) continue;
    if (c.start >= s && clipEnd(c) <= e) {
      removeTransitionsOf(p, c.id);
      delete p.clips[id];
    }
  }
  for (const id in p.clips) {
    const c = p.clips[id]!;
    if (allowed.has(c.trackId) && c.start >= e) c.start -= len;
  }
  for (const m of p.markers) if (m.frame >= e) m.frame -= len;
  pruneInvalidTransitions(p);
  return len;
}
