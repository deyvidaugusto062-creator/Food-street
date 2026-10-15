import { renderMixOffline, fromAudioBuffer, type PcmData } from '@framestudio/audio-engine';
import { openFrameReader } from '@framestudio/media-engine';
import { WHISPER_MODELS, saliencyCenter, type TimedWord, type WhisperLanguage, type WhisperSize, type WorkerResponse } from '@framestudio/ai-engine';
import { FrameStudioError, type Project, type VideoClip } from '@framestudio/shared';
import { projectDuration, sourceTimeAt } from '@framestudio/timeline';
import { audioStore, getAssetBlob } from './media.ts';

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** O modelo já está no cache do navegador (dispensa novo download)? */
export async function isModelCached(size: WhisperSize, remoteHost?: string): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    const repo = WHISPER_MODELS[size].repo;
    return keys.some((k) => k.url.includes(repo) && k.url.includes('.onnx')) && (!remoteHost || keys.some((k) => k.url.startsWith(remoteHost)));
  } catch {
    return false;
  }
}

export interface TranscribeProgress {
  stage: 'mix' | 'download' | 'load' | 'transcribe';
  progress: number;
  detail?: string;
}

/**
 * Transcreve o que se ouve na timeline (mixagem a 16 kHz mono). Os tempos das palavras saem
 * diretamente em segundos da timeline. `voiceOnly` silencia clipes de áudio do tipo música.
 */
export async function transcribeProject(
  project: Project,
  opts: { model: WhisperSize; language: WhisperLanguage; remoteHost?: string; voiceOnly?: boolean; onProgress?: (p: TranscribeProgress) => void; signal?: AbortSignal },
): Promise<TimedWord[]> {
  const fps = project.settings.fps;
  const dur = projectDuration(project) / fps;
  if (dur <= 0) throw new FrameStudioError('INVALID_OPERATION', 'A timeline está vazia.');
  opts.onProgress?.({ stage: 'mix', progress: 0 });
  let p = project;
  if (opts.voiceOnly) {
    const clips = { ...p.clips };
    for (const [id, c] of Object.entries(clips)) if (c.type === 'audio' && !/narra|voz|voice|fala/i.test(c.name)) clips[id] = { ...c, audio: { ...c.audio, muted: true } };
    p = { ...p, clips };
  }
  await audioStore.prepare(p);
  const mix = await renderMixOffline(p, audioStore.lookup, { from: 0, to: dur }, 16000, 1);
  const audio = mix.getChannelData(0).slice();
  let peak = 0;
  for (let i = 0; i < audio.length; i += 64) peak = Math.max(peak, Math.abs(audio[i]!));
  if (peak < 1e-4) throw new FrameStudioError('INVALID_OPERATION', 'Não há áudio audível na timeline para transcrever.');
  const id = nextId++;
  const w = getWorker();
  return new Promise<TimedWord[]>((resolve, reject) => {
    const onMsg = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') opts.onProgress?.({ stage: m.stage, progress: m.progress, detail: m.file });
      else if (m.type === 'result') {
        cleanup();
        resolve(m.words);
      } else if (m.type === 'error') {
        cleanup();
        reject(new FrameStudioError('MODEL_MISSING', `Falha na transcrição: ${m.message}`));
      }
    };
    const onAbort = () => {
      w.postMessage({ type: 'cancel', id });
      cleanup();
      reject(new FrameStudioError('CANCELLED', 'Transcrição cancelada.'));
    };
    const cleanup = () => {
      w.removeEventListener('message', onMsg);
      opts.signal?.removeEventListener('abort', onAbort);
    };
    w.addEventListener('message', onMsg);
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    w.postMessage({ type: 'transcribe', id, audio, model: opts.model, language: opts.language, remoteHost: opts.remoteHost, offset: 0 }, [audio.buffer]);
  });
}

/** PCM decodificado do asset (48 kHz). */
export async function assetPcm(assetId: string): Promise<PcmData> {
  const buf = await audioStore.get(assetId);
  if (!buf) throw new FrameStudioError('UNSUPPORTED_CODEC', 'Não foi possível decodificar o áudio desta mídia.');
  return fromAudioBuffer(buf);
}

/** Trajetória do assunto: amostra quadros do clipe (2 por segundo) e calcula a saliência. */
export async function analyzeSubject(project: Project, clip: VideoClip, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<{ localFrame: number; cx: number }[]> {
  const blob = await getAssetBlob(clip.assetId);
  if (!blob) throw new FrameStudioError('MEDIA_MISSING', 'Mídia ausente.');
  const reader = await openFrameReader(blob, { maxWidth: 96, maxHeight: 96 });
  const W = 64;
  const H = 36;
  const canvas = new OffscreenCanvas(W, H);
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const fps = project.settings.fps;
  const step = Math.max(1, Math.round(fps / 2));
  const out: { localFrame: number; cx: number }[] = [];
  let prev: Uint8ClampedArray | undefined;
  try {
    for (let f = 0; f < clip.duration; f += step) {
      if (signal?.aborted) throw new FrameStudioError('CANCELLED', 'Análise cancelada.');
      const t = sourceTimeAt(clip, clip.start + f, fps, project.assets[clip.assetId]);
      const frame = await reader.frameAt(t);
      if (!frame) continue;
      g.drawImage(frame, 0, 0, W, H);
      const data = g.getImageData(0, 0, W, H).data;
      const c = saliencyCenter(data, W, H, prev);
      prev = new Uint8ClampedArray(data);
      out.push({ localFrame: f, cx: c.strength > 2 ? c.x : (out[out.length - 1]?.cx ?? 0.5) });
      onProgress?.(f / clip.duration);
    }
  } finally {
    reader.dispose();
  }
  return out;
}
