/**
 * Ferramentas de IA baseadas em análise de sinal (sem modelos de aprendizado):
 * remoção de silêncios, ducking, destaques para clipes curtos e reenquadramento por saliência.
 * Cada função devolve sugestões/operações que o usuário revisa antes de aplicar.
 */
import type { EditOp } from '@framestudio/editor-core';
import type { AudioClip, Clip, Keyframe, Project, VideoClip } from '@framestudio/shared';
import { createId } from '@framestudio/shared';
import { clipEnd } from '@framestudio/timeline';
import { detectSilences, rmsEnvelope, type Interval, type PcmData, type SilenceOptions } from '@framestudio/audio-engine';

export type AudibleClip = AudioClip | VideoClip;

/** Recorta o trecho de PCM usado pelo clipe (tempo de origem). */
export function clipSlice(pcm: PcmData, clip: AudibleClip, fps: number): PcmData {
  const s = Math.max(0, Math.floor(clip.sourceIn * pcm.sampleRate));
  const e = Math.min(pcm.channels[0]?.length ?? 0, Math.ceil((clip.sourceIn + (clip.duration / fps) * clip.speed) * pcm.sampleRate));
  return { sampleRate: pcm.sampleRate, channels: pcm.channels.map((c) => c.subarray(s, Math.max(s, e))) };
}

export interface SilenceSuggestion {
  /** Intervalos da timeline (frames) a remover. */
  ranges: { start: number; end: number }[];
  removedFrames: number;
  thresholdDb: number;
}

/**
 * Detecta silêncios no áudio do clipe e converte para intervalos da timeline.
 * Clipes reversos ou congelados não são suportados (o mapeamento de tempo não é linear crescente).
 */
export function suggestSilenceCuts(project: Project, clip: AudibleClip, pcm: PcmData, opts: SilenceOptions): SilenceSuggestion {
  if (clip.reverse || clip.freeze) return { ranges: [], removedFrames: 0, thresholdDb: 0 };
  const fps = project.settings.fps;
  const slice = clipSlice(pcm, clip, fps);
  const { silences, thresholdDb } = detectSilences(slice, opts);
  const ranges = silences
    .map((s: Interval) => ({
      start: Math.round(clip.start + (s.start / clip.speed) * fps),
      end: Math.round(clip.start + (s.end / clip.speed) * fps),
    }))
    .map((r) => ({ start: Math.max(clip.start, r.start), end: Math.min(clipEnd(clip), r.end) }))
    .filter((r) => r.end - r.start >= 2);
  return { ranges, removedFrames: ranges.reduce((a, r) => a + r.end - r.start, 0), thresholdDb };
}

/** Operações para remover os intervalos (do fim para o início, preservando as posições anteriores). */
export function silenceRemovalOps(ranges: { start: number; end: number }[]): EditOp[] {
  return [...ranges].sort((a, b) => b.start - a.start).map((r) => ({ type: 'range.remove' as const, start: r.start, end: r.end }));
}

// ─────────────────────────── Ducking ───────────────────────────

export interface DuckingOptions {
  /** Redução da música durante a fala, em dB (ex.: −12). */
  reductionDb: number;
  /** Nível acima do qual há fala (dBFS). */
  thresholdDb: number;
  /** Tempo de ataque/retorno em segundos. */
  attack: number;
  release: number;
}

/**
 * Gera keyframes de volume para a música abaixar durante a fala (ducking automático).
 * `voice` contém os clipes de voz com seu PCM; o resultado substitui os keyframes de volume da música.
 */
export function planDucking(project: Project, music: AudibleClip, voices: { clip: AudibleClip; pcm: PcmData }[], opts: DuckingOptions): EditOp[] {
  const fps = project.settings.fps;
  // Intervalos de fala em frames da timeline.
  const speech: { start: number; end: number }[] = [];
  for (const v of voices) {
    const env = rmsEnvelope(clipSlice(v.pcm, v.clip, fps), 0.05);
    let runStart = -1;
    for (let i = 0; i <= env.db.length; i++) {
      const loud = i < env.db.length && env.db[i]! > opts.thresholdDb;
      if (loud && runStart < 0) runStart = env.times[i]!;
      if (!loud && runStart >= 0) {
        const endT = i < env.db.length ? env.times[i]! : env.times[env.times.length - 1]! + env.windowSec;
        speech.push({ start: v.clip.start + Math.round((runStart / v.clip.speed) * fps), end: v.clip.start + Math.round((endT / v.clip.speed) * fps) });
        runStart = -1;
      }
    }
  }
  speech.sort((a, b) => a.start - b.start);
  // Junta falas próximas (< release) para evitar "bombeamento".
  const merged: { start: number; end: number }[] = [];
  for (const s of speech) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < opts.release * fps * 2) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  const base = music.audio.volume;
  const low = base * Math.pow(10, opts.reductionDb / 20);
  const kfs: Keyframe[] = [];
  const push = (frame: number, value: number) => {
    const local = Math.round(frame - music.start);
    if (local < 0 || local >= music.duration) return;
    const prev = kfs[kfs.length - 1];
    if (prev && local <= prev.frame) return;
    kfs.push({ id: createId('kf_'), frame: local, value, easing: 'ease-in-out' });
  };
  for (const s of merged) {
    if (s.end <= music.start || s.start >= clipEnd(music)) continue;
    push(s.start - opts.attack * fps, base);
    push(s.start, low);
    push(s.end, low);
    push(s.end + opts.release * fps, base);
  }
  if (kfs.length === 0) return [];
  return [
    { type: 'keyframe.clear', clipId: music.id, prop: 'volume' },
    ...kfs.map((k) => ({ type: 'keyframe.set' as const, clipId: music.id, prop: 'volume' as const, frame: k.frame, value: k.value, easing: k.easing })),
  ];
}

// ─────────────────────────── Destaques ───────────────────────────

export interface Highlight {
  start: number; // s (tempo de origem)
  end: number;
  score: number;
  reason: string;
}

/**
 * Sugere trechos para clipes curtos a partir de uma gravação longa. Pontua janelas pela densidade
 * de fala (proporção de tempo acima do limiar) e pela energia média; prefere começar e terminar
 * em pausas. Não há compreensão do conteúdo: é uma heurística de atividade sonora.
 */
export function suggestHighlights(pcm: PcmData, opts: { minLen?: number; maxLen?: number; count?: number; transcript?: { start: number; end: number; text: string }[] } = {}): Highlight[] {
  const minLen = opts.minLen ?? 15;
  const maxLen = opts.maxLen ?? 45;
  const count = opts.count ?? 3;
  const env = rmsEnvelope(pcm, 0.1);
  const total = (pcm.channels[0]?.length ?? 0) / pcm.sampleRate;
  if (total < minLen) return total > 2 ? [{ start: 0, end: total, score: 1, reason: 'Gravação curta: usar inteira' }] : [];
  const finite = Array.from(env.db).filter((v) => v > -150).sort((a, b) => a - b);
  const thr = finite.length ? Math.max(-55, finite[Math.floor(finite.length * 0.3)]! + 6) : -45;
  const step = env.windowSec;
  const active = Array.from(env.db, (d) => (d > thr ? 1 : 0));
  const energy = Array.from(env.db, (d) => Math.max(0, d + 60));
  const prefix = (arr: number[]) => arr.reduce<number[]>((acc, v, i) => (acc.push((acc[i - 1] ?? 0) + v), acc), []);
  const pa = prefix(active);
  const pe = prefix(energy);
  const sum = (p: number[], a: number, b: number) => (p[b - 1] ?? 0) - (p[a - 1] ?? 0);
  const candidates: Highlight[] = [];
  const lenW = Math.round(((minLen + maxLen) / 2) / step);
  for (let i = 0; i + lenW <= env.db.length; i += Math.max(1, Math.round(1 / step))) {
    const density = sum(pa, i, i + lenW) / lenW;
    const loud = sum(pe, i, i + lenW) / lenW / 60;
    // Ajusta início/fim para a pausa mais próxima (até 2 s).
    const snap = (idx: number, dir: number) => {
      for (let k = 0; k < Math.round(2 / step); k++) {
        const j = idx + k * dir;
        if (j <= 0 || j >= active.length) return Math.max(0, Math.min(active.length, j));
        if (!active[j]) return j;
      }
      return idx;
    };
    const s = snap(i, -1);
    const e = snap(i + lenW, 1);
    let words = 0;
    if (opts.transcript) for (const seg of opts.transcript) if (seg.start >= s * step && seg.end <= e * step) words += seg.text.split(/\s+/).length;
    const score = density * 0.6 + loud * 0.3 + (opts.transcript ? Math.min(1, words / ((e - s) * step * 2.5)) * 0.1 : 0);
    candidates.push({ start: s * step, end: Math.min(total, e * step), score, reason: `${Math.round(density * 100)}% com fala/som ativo` });
  }
  candidates.sort((a, b) => b.score - a.score);
  const out: Highlight[] = [];
  for (const c of candidates) {
    if (out.some((o) => c.start < o.end && c.end > o.start)) continue;
    out.push(c);
    if (out.length >= count) break;
  }
  return out.sort((a, b) => a.start - b.start);
}

// ─────────────────────────── Reenquadramento ───────────────────────────

/**
 * Centro de saliência horizontal de um quadro RGBA reduzido: combina energia de bordas
 * (gradiente) e diferença em relação ao quadro anterior (movimento). Retorna x ∈ [0, 1].
 */
export function saliencyCenter(rgba: Uint8ClampedArray, w: number, h: number, prev?: Uint8ClampedArray): { x: number; y: number; strength: number } {
  const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const gx = lum(rgba, i + 4) - lum(rgba, i - 4);
      const gy = lum(rgba, i + w * 4) - lum(rgba, i - w * 4);
      let wgt = Math.hypot(gx, gy);
      if (prev) wgt += 2 * Math.abs(lum(rgba, i) - lum(prev, i));
      // Leve viés para o centro (composição).
      wgt *= 1 - 0.3 * Math.abs(x / w - 0.5);
      sx += x * wgt;
      sy += y * wgt;
      sw += wgt;
    }
  }
  if (sw <= 0) return { x: 0.5, y: 0.5, strength: 0 };
  return { x: sx / sw / w, y: sy / sw / h, strength: sw / (w * h) };
}

/**
 * Converte a trajetória do assunto (tempos e centros) em keyframes de posição X para um clipe em
 * modo "preencher" num quadro de destino, mantendo o assunto centralizado sem mostrar bordas.
 */
export function reframeKeyframes(
  clip: VideoClip,
  samples: { localFrame: number; cx: number }[],
  src: { width: number; height: number },
  dst: { width: number; height: number },
  smoothing = 0.6,
): EditOp[] {
  const k = Math.max(dst.width / src.width, dst.height / src.height) * clip.transform.scale;
  const drawnW = src.width * k;
  const maxShift = Math.max(0, (drawnW - dst.width) / 2);
  if (maxShift < 1 || samples.length === 0) return [];
  let ema = samples[0]!.cx;
  const ops: EditOp[] = [{ type: 'keyframe.clear', clipId: clip.id, prop: 'x' }];
  let lastX: number | null = null;
  for (const s of samples) {
    ema = ema * smoothing + s.cx * (1 - smoothing);
    const x = Math.round(Math.max(-maxShift, Math.min(maxShift, (0.5 - ema) * drawnW)));
    if (lastX !== null && Math.abs(x - lastX) < 4) continue;
    ops.push({ type: 'keyframe.set', clipId: clip.id, prop: 'x', frame: s.localFrame, value: x, easing: 'ease-in-out' });
    lastX = x;
  }
  ops.push({ type: 'clip.update', clipIds: [clip.id], patch: { transform: { fit: 'cover' } } });
  return ops;
}

export function isAudible(c: Clip, p: Project): c is AudibleClip {
  return c.type === 'audio' || (c.type === 'video' && !!p.assets[c.assetId]?.hasAudio);
}
