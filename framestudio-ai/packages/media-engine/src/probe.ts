import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { createId, FrameStudioError, type AssetKind, type MediaAsset } from '@framestudio/shared';
import { validateFile } from './formats.ts';

export interface ProbeResult {
  kind: AssetKind;
  mimeType: string;
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  rotation?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  sampleRate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  /** O navegador consegue decodificar o vídeo/áudio (WebCodecs ou elemento de mídia). */
  decodable: { video: boolean; audio: boolean };
  /** Avisos não fatais para o usuário. */
  warnings: string[];
}

const timeout = <T>(p: Promise<T>, ms: number, msg: string) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new FrameStudioError('CORRUPTED_FILE', msg)), ms))]);

/** Lê metadados reais do arquivo: duração, resolução, FPS, codecs, canais, rotação. */
export async function probeFile(file: File): Promise<ProbeResult> {
  const v = await validateFile(file);
  if (v.kind === 'image') return probeImage(file, v.mime);
  const warnings: string[] = [];
  let input: Input | null = null;
  try {
    input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const [videoTrack, audioTrack] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
    if (!videoTrack && !audioTrack) throw new FrameStudioError('UNSUPPORTED_FILE', `"${file.name}" não contém faixas de vídeo ou áudio.`);
    const duration = await input.computeDuration();
    const result: ProbeResult = {
      kind: videoTrack ? 'video' : 'audio',
      mimeType: (await input.getMimeType().catch(() => v.mime)) || v.mime,
      duration,
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      decodable: { video: false, audio: false },
      warnings,
    };
    if (videoTrack) {
      result.width = await videoTrack.getDisplayWidth();
      result.height = await videoTrack.getDisplayHeight();
      result.rotation = await videoTrack.getRotation();
      result.videoCodec = (await videoTrack.getCodecParameterString()) ?? (await videoTrack.getCodec()) ?? undefined;
      try {
        const m = await timeout(videoTrack.computeFrameRateMetrics(), 8000, 'timeout');
        result.fps = Math.round((m.underlyingFrameRate ?? m.bestGuessFrameRate) * 1000) / 1000;
      } catch {
        // Metadado opcional.
      }
      result.decodable.video = await videoTrack.canDecode().catch(() => false);
      if (!result.decodable.video) {
        // WebCodecs indisponível ou codec sem suporte: tenta o elemento <video> (usado no preview).
        result.decodable.video = await canPlayInElement(file, 'video');
        if (!result.decodable.video) {
          throw new FrameStudioError(
            'UNSUPPORTED_CODEC',
            `O codec de vídeo de "${file.name}" (${result.videoCodec ?? 'desconhecido'}) não é suportado por este navegador. Converta para MP4 (H.264) ou WebM (VP9) e tente novamente.`,
          );
        }
        warnings.push('Decodificação quadro a quadro (WebCodecs) indisponível para este codec: a exportação usará um modo mais lento.');
      }
    }
    if (audioTrack) {
      result.audioCodec = (await audioTrack.getCodecParameterString()) ?? (await audioTrack.getCodec()) ?? undefined;
      result.audioChannels = await audioTrack.getNumberOfChannels();
      result.sampleRate = await audioTrack.getSampleRate();
      result.decodable.audio = await audioTrack.canDecode().catch(() => false);
      if (!result.decodable.audio) {
        result.decodable.audio = await canPlayInElement(file, 'audio');
        if (!result.decodable.audio) {
          if (!videoTrack) throw new FrameStudioError('UNSUPPORTED_CODEC', `O codec de áudio de "${file.name}" (${result.audioCodec}) não é suportado por este navegador.`);
          warnings.push(`O áudio (${result.audioCodec}) não pode ser decodificado neste navegador e será ignorado.`);
          result.hasAudio = false;
        }
      }
    }
    if (!(duration > 0)) throw new FrameStudioError('CORRUPTED_FILE', `Não foi possível determinar a duração de "${file.name}".`);
    return result;
  } catch (e) {
    if (e instanceof FrameStudioError) throw e;
    // Container que o Mediabunny não lê: último recurso via elemento HTML.
    const fallback = await probeWithElement(file, v.kind === 'audio' ? 'audio' : 'video').catch(() => null);
    if (fallback) return { ...fallback, warnings: [...fallback.warnings, 'Metadados lidos pelo navegador (container não reconhecido pelo motor de mídia).'] };
    throw new FrameStudioError('CORRUPTED_FILE', `Não foi possível ler "${file.name}": arquivo corrompido ou formato não suportado.`, e);
  } finally {
    input?.dispose();
  }
}

async function probeImage(file: File, mime: string): Promise<ProbeResult> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const r: ProbeResult = {
      kind: 'image',
      mimeType: mime,
      duration: 0,
      width: bmp.width,
      height: bmp.height,
      hasVideo: true,
      hasAudio: false,
      decodable: { video: true, audio: false },
      warnings: mime === 'image/gif' ? ['GIFs são importados como imagem estática (primeiro quadro).'] : [],
    };
    bmp.close();
    return r;
  } catch (e) {
    throw new FrameStudioError('CORRUPTED_FILE', `Não foi possível decodificar a imagem "${file.name}".`, e);
  }
}

function canPlayInElement(file: Blob, kind: 'video' | 'audio'): Promise<boolean> {
  return probeWithElement(file, kind)
    .then(() => true)
    .catch(() => false);
}

function probeWithElement(file: Blob, kind: 'video' | 'audio'): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('sem DOM'));
    const el = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const cleanup = () => {
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 10000);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      const video = el as HTMLVideoElement;
      const hasVideo = kind === 'video' && video.videoWidth > 0;
      const r: ProbeResult = {
        kind: hasVideo ? 'video' : 'audio',
        mimeType: (file as File).type || `${kind}/*`,
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        width: hasVideo ? video.videoWidth : undefined,
        height: hasVideo ? video.videoHeight : undefined,
        hasVideo,
        hasAudio: true,
        decodable: { video: hasVideo, audio: true },
        warnings: [],
      };
      cleanup();
      if (!(r.duration > 0)) reject(new Error('duração inválida'));
      else resolve(r);
    };
    el.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('erro de mídia'));
    };
    el.src = url;
  });
}

export function fingerprintOf(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/** Constrói o MediaAsset a partir do arquivo e do resultado do probe. */
export function assetFromProbe(file: File, probe: ProbeResult): MediaAsset {
  const id = createId('ast_');
  return {
    id,
    name: file.name,
    kind: probe.kind,
    mimeType: probe.mimeType,
    size: file.size,
    storageKey: `media_${id}`,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
    rotation: probe.rotation,
    videoCodec: probe.videoCodec,
    audioCodec: probe.audioCodec,
    audioChannels: probe.audioChannels,
    sampleRate: probe.sampleRate,
    hasVideo: probe.hasVideo,
    hasAudio: probe.hasAudio,
    fingerprint: fingerprintOf(file),
    createdAt: Date.now(),
  };
}
