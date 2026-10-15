/**
 * Mixagem do projeto num BaseAudioContext. A MESMA função é usada pelo preview (AudioContext)
 * e pela exportação (OfflineAudioContext), garantindo que o que se ouve é o que se exporta.
 */
import type { AudioClip, Clip, Project, VideoClip } from '@framestudio/shared';
import { evaluateKeyframes, transitionOf } from '@framestudio/timeline';
import { fromDb } from './analysis.ts';

export type AudibleClip = AudioClip | VideoClip;

export interface BufferVariant {
  reverse: boolean;
  denoise: number;
}

/** Fornece o AudioBuffer (já decodificado e processado) de um asset. */
export type BufferLookup = (assetId: string, variant: BufferVariant) => AudioBuffer | undefined;

export function variantOf(c: AudibleClip): BufferVariant {
  return { reverse: c.reverse, denoise: c.audio.noiseReduction?.enabled ? c.audio.noiseReduction.amount : 0 };
}

/** Clipes que produzem som, respeitando mute/solo das faixas. */
export function audibleClips(project: Project): AudibleClip[] {
  const anySolo = project.tracks.some((t) => t.solo && t.kind !== 'caption' && t.kind !== 'text');
  const out: AudibleClip[] = [];
  for (const id in project.clips) {
    const c = project.clips[id] as Clip;
    if (c.type !== 'audio' && c.type !== 'video') continue;
    if (c.audio.muted || c.freeze) continue;
    if (c.type === 'video' && !project.assets[c.assetId]?.hasAudio) continue;
    const t = project.tracks.find((x) => x.id === c.trackId);
    if (!t || t.muted || (anySolo && !t.solo)) continue;
    if (c.type === 'video' && t.hidden) continue;
    out.push(c);
  }
  return out;
}

/** Envelope de ganho (fades + keyframes de volume + crossfade de transições) no tempo local do clipe. */
export function clipGainAt(project: Project, c: AudibleClip, localSec: number): number {
  const fps = project.settings.fps;
  const dur = c.duration / fps;
  let g = evaluateKeyframes(c.keyframes.volume, localSec * fps, c.audio.volume);
  let fadeIn = c.audio.fadeIn;
  let fadeOut = c.audio.fadeOut;
  // Transições de vídeo fazem crossfade automático do áudio na metade correspondente.
  const tin = transitionOf(project, c.id, 'to');
  const tout = transitionOf(project, c.id, 'from');
  if (tin) fadeIn = Math.max(fadeIn, tin.duration / 2 / fps);
  if (tout) fadeOut = Math.max(fadeOut, tout.duration / 2 / fps);
  if (fadeIn > 0 && localSec < fadeIn) g *= Math.max(0, localSec / fadeIn);
  if (fadeOut > 0 && localSec > dur - fadeOut) g *= Math.max(0, (dur - localSec) / fadeOut);
  return Math.max(0, g);
}

export interface MixOptions {
  /** Tempo (s) do projeto a partir do qual tocar. */
  from: number;
  /** Tempo (s) do projeto em que parar (exclusivo). */
  to?: number;
  /** Instante do contexto em que `from` deve soar. */
  when: number;
  /** Destino (padrão: ctx.destination). */
  destination?: AudioNode;
}

export interface ScheduledMix {
  stop(): void;
  sources: AudioBufferSourceNode[];
}

const CURVE_RATE = 100; // pontos de automação por segundo

export function buildMix(ctx: BaseAudioContext, project: Project, lookup: BufferLookup, opts: MixOptions): ScheduledMix {
  const fps = project.settings.fps;
  const sources: AudioBufferSourceNode[] = [];
  const dest = opts.destination ?? ctx.destination;
  const to = opts.to ?? Infinity;
  for (const c of audibleClips(project)) {
    const buffer = lookup(c.assetId, variantOf(c));
    if (!buffer) continue;
    const s = c.start / fps;
    const e = Math.min((c.start + c.duration) / fps, to);
    if (e <= opts.from || s >= to) continue;
    const offsetLocal = Math.max(0, opts.from - s); // segundos dentro do clipe
    const playLocal = e - s - offsetLocal; // segundos de timeline a tocar
    if (playLocal <= 1e-4) continue;
    const startAt = opts.when + Math.max(0, s - opts.from);
    const span = (c.duration / fps) * c.speed;
    let bufOffset = c.reverse ? buffer.duration - (c.sourceIn + span) + offsetLocal * c.speed : c.sourceIn + offsetLocal * c.speed;
    bufOffset = Math.max(0, bufOffset);
    if (bufOffset >= buffer.duration) continue;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = c.speed;
    const track = project.tracks.find((t) => t.id === c.trackId)!;
    const norm = c.audio.normalizeGainDb ? fromDb(c.audio.normalizeGainDb) : 1;
    let node: AudioNode = src;

    const env = ctx.createGain();
    const n = Math.max(2, Math.ceil(playLocal * CURVE_RATE) + 1);
    const curve = new Float32Array(n);
    let constant = true;
    for (let i = 0; i < n; i++) {
      const local = offsetLocal + (playLocal * i) / (n - 1);
      curve[i] = clipGainAt(project, c, local) * track.volume * norm;
      if (i > 0 && Math.abs(curve[i]! - curve[0]!) > 1e-6) constant = false;
    }
    if (constant) env.gain.value = curve[0]!;
    else {
      env.gain.value = curve[0]!;
      env.gain.setValueCurveAtTime(curve, startAt, playLocal);
    }
    node.connect(env);
    node = env;

    const eq = c.audio.eq;
    if (eq && (eq.low || eq.mid || eq.high)) {
      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 200;
      low.gain.value = eq.low;
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 0.9;
      mid.gain.value = eq.mid;
      const high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 4000;
      high.gain.value = eq.high;
      node.connect(low);
      low.connect(mid);
      mid.connect(high);
      node = high;
    }
    const comp = c.audio.compressor;
    if (comp?.enabled) {
      const k = ctx.createDynamicsCompressor();
      k.threshold.value = comp.threshold;
      k.ratio.value = comp.ratio;
      k.attack.value = comp.attack;
      k.release.value = comp.release;
      k.knee.value = 6;
      node.connect(k);
      node = k;
    }
    const mode = c.audio.channelMode ?? 'stereo';
    if (mode !== 'stereo' && buffer.numberOfChannels > 1) {
      if (mode === 'mono') {
        const m = ctx.createGain();
        m.channelCount = 1;
        m.channelCountMode = 'explicit';
        m.channelInterpretation = 'speakers';
        node.connect(m);
        node = m;
      } else {
        const split = ctx.createChannelSplitter(2);
        const merge = ctx.createChannelMerger(2);
        node.connect(split);
        const ch = mode === 'left' ? 0 : 1;
        split.connect(merge, ch, 0);
        split.connect(merge, ch, 1);
        node = merge;
      }
    }
    if (c.audio.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = c.audio.pan;
      node.connect(p);
      node = p;
    }
    node.connect(dest);
    src.start(startAt, bufOffset, playLocal * c.speed);
    sources.push(src);
  }
  return {
    sources,
    stop() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* já parado */
        }
        s.disconnect();
      }
    },
  };
}

/** Renderiza a mixagem completa (ou um trecho) offline. */
export async function renderMixOffline(
  project: Project,
  lookup: BufferLookup,
  range: { from: number; to: number },
  sampleRate = 48000,
  channels = 2,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil((range.to - range.from) * sampleRate));
  const ctx = new OfflineAudioContext({ numberOfChannels: channels, length, sampleRate });
  buildMix(ctx, project, lookup, { from: range.from, to: range.to, when: 0 });
  return ctx.startRendering();
}

/** Indica se o projeto (no intervalo) tem algum áudio audível. */
export function hasAudibleAudio(project: Project): boolean {
  return audibleClips(project).length > 0;
}
