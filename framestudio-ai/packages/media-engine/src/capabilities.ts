import { canEncodeAudio, canEncodeVideo, QUALITY_HIGH, type AudioCodec, type VideoCodec } from 'mediabunny';
import type { AudioCodecId, ExportFormat, VideoCodecId } from '@framestudio/shared';

export interface DeviceCapabilities {
  webCodecs: boolean;
  webgl2: boolean;
  opfs: boolean;
  fileSystemAccess: boolean;
  offscreenCanvas: boolean;
  sharedArrayBuffer: boolean;
  audioWorklet: boolean;
  touch: boolean;
  vibrate: boolean;
  mobile: boolean;
  cores: number;
  /** GB aproximados (somente Chromium expõe). */
  memoryGb: number | null;
  standalone: boolean;
}

export function detectDevice(): DeviceCapabilities {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const w = typeof window !== 'undefined' ? window : undefined;
  let webgl2 = false;
  try {
    webgl2 = typeof document !== 'undefined' && !!document.createElement('canvas').getContext('webgl2');
  } catch {
    webgl2 = false;
  }
  const ua = nav?.userAgent ?? '';
  const touch = !!w && ('ontouchstart' in w || (nav?.maxTouchPoints ?? 0) > 0);
  return {
    webCodecs: typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined',
    webgl2,
    opfs: !!nav?.storage?.getDirectory,
    fileSystemAccess: !!w && 'showSaveFilePicker' in w,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    audioWorklet: typeof AudioWorkletNode !== 'undefined',
    touch,
    vibrate: !!nav && 'vibrate' in nav,
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && (w?.innerWidth ?? 1024) < 820),
    cores: nav?.hardwareConcurrency ?? 2,
    memoryGb: (nav as Navigator & { deviceMemory?: number })?.deviceMemory ?? null,
    standalone: !!w && (w.matchMedia?.('(display-mode: standalone)').matches || (nav as Navigator & { standalone?: boolean })?.standalone === true),
  };
}

export const VIDEO_CODEC_LABEL: Record<VideoCodecId, string> = {
  avc: 'H.264',
  hevc: 'H.265 / HEVC',
  vp9: 'VP9',
  vp8: 'VP8',
  av1: 'AV1',
};

export const AUDIO_CODEC_LABEL: Record<AudioCodecId, string> = {
  aac: 'AAC',
  opus: 'Opus',
  mp3: 'MP3',
  flac: 'FLAC',
  pcm: 'PCM',
};

/** Codecs que cada container aceita (restrições do formato, não do dispositivo). */
export const CONTAINER_CODECS: Record<ExportFormat, { video: VideoCodecId[]; audio: AudioCodecId[] }> = {
  mp4: { video: ['avc', 'hevc', 'av1', 'vp9'], audio: ['aac', 'opus'] },
  mov: { video: ['avc', 'hevc'], audio: ['aac'] },
  webm: { video: ['vp9', 'av1', 'vp8'], audio: ['opus'] },
};

export interface ExportCapability {
  format: ExportFormat;
  videoCodecs: VideoCodecId[];
  audioCodecs: AudioCodecId[];
}

export interface ExportCapabilities {
  formats: ExportCapability[];
  /** Maior altura testada que o codificador aceitou para cada codec. */
  maxHeight: Partial<Record<VideoCodecId, number>>;
}

const cache = new Map<string, Promise<boolean>>();

function memo(key: string, fn: () => Promise<boolean>): Promise<boolean> {
  let p = cache.get(key);
  if (!p) {
    p = fn().catch(() => false);
    cache.set(key, p);
  }
  return p;
}

export function canEncodeVideoAt(codec: VideoCodecId, width: number, height: number, fps: number): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return Promise.resolve(false);
  return memo(`v:${codec}:${width}x${height}@${fps}`, () => canEncodeVideo(codec as VideoCodec, { width, height, frameRate: fps, bitrate: QUALITY_HIGH }));
}

export function canEncodeAudioCodec(codec: AudioCodecId): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') return Promise.resolve(false);
  const c: AudioCodec = codec === 'pcm' ? 'pcm-s16' : (codec as AudioCodec);
  return memo(`a:${codec}`, () => canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48000, bitrate: 128000 }));
}

const HEIGHTS = [480, 720, 1080, 1440, 2160];

/**
 * Detecta o que este dispositivo realmente consegue exportar. A interface só oferece as
 * combinações retornadas aqui — nada de opções que falhariam na hora de exportar.
 */
export async function detectExportCapabilities(aspect = 16 / 9): Promise<ExportCapabilities> {
  const videoCodecs: VideoCodecId[] = ['avc', 'hevc', 'vp9', 'av1', 'vp8'];
  const audioCodecs: AudioCodecId[] = ['aac', 'opus'];
  const [vOk, aOk] = await Promise.all([
    Promise.all(videoCodecs.map((c) => canEncodeVideoAt(c, even(720 * aspect), 720, 30))),
    Promise.all(audioCodecs.map((c) => canEncodeAudioCodec(c))),
  ]);
  const supportedV = videoCodecs.filter((_, i) => vOk[i]);
  const supportedA = audioCodecs.filter((_, i) => aOk[i]);
  const maxHeight: ExportCapabilities['maxHeight'] = {};
  await Promise.all(
    supportedV.map(async (c) => {
      let max = 720;
      for (const h of HEIGHTS) if (await canEncodeVideoAt(c, even(h * aspect), h, 30)) max = h;
      maxHeight[c] = max;
    }),
  );
  const formats: ExportCapability[] = (['mp4', 'webm', 'mov'] as ExportFormat[])
    .map((format) => ({
      format,
      videoCodecs: CONTAINER_CODECS[format].video.filter((c) => supportedV.includes(c)),
      audioCodecs: CONTAINER_CODECS[format].audio.filter((c) => supportedA.includes(c)),
    }))
    .filter((f) => f.videoCodecs.length > 0);
  return { formats, maxHeight };
}

function even(n: number): number {
  const r = Math.round(n);
  return r % 2 ? r + 1 : r;
}
