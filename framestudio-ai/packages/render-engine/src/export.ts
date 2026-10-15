/**
 * Exportação real: renderiza cada quadro com o Compositor, codifica com WebCodecs e multiplexa com
 * Mediabunny (MP4/WebM/MOV). O áudio é mixado offline com o mesmo grafo do preview.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  StreamTarget,
  WebMOutputFormat,
  type AudioCodec,
  type StreamTargetChunk,
  type VideoCodec,
} from 'mediabunny';
import { evenize, FrameStudioError, type ExportSettings, type Project, type VideoClip } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import { AudioBufferStore, hasAudibleAudio, renderMixOffline } from '@framestudio/audio-engine';
import { canEncodeAudioCodec, canEncodeVideoAt, openFrameReader, type FrameReader } from '@framestudio/media-engine';
import { Compositor, type FrameSources } from './compositor.ts';
import { imageRequests, planFrame, videoRequests } from './plan.ts';
import { ensureFonts } from './text.ts';

export interface ExportProgress {
  phase: 'preparing' | 'audio' | 'video' | 'finalizing' | 'done';
  /** 0..1 do trabalho total. */
  progress: number;
  frame: number;
  totalFrames: number;
  /** Quadros renderizados por segundo. */
  renderFps: number;
  etaSeconds: number | null;
}

export interface ExportJob {
  project: Project;
  settings: ExportSettings;
  loadBlob: (assetId: string) => Promise<Blob | undefined>;
  audio: AudioBufferStore;
  /** Arquivo de destino (File System Access). Sem ele, o resultado volta como Blob. */
  writable?: WritableStream<StreamTargetChunk>;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob?: Blob;
  mimeType: string;
  bytes: number;
  durationSec: number;
  width: number;
  height: number;
  warnings: string[];
}

export function outputSize(project: Project, height: number): { width: number; height: number } {
  const { width: pw, height: ph } = project.settings;
  if (!height || height <= 0) return { width: evenize(pw), height: evenize(ph) };
  // `height` é a "classe" de resolução (1080p etc.) aplicada ao menor lado, como em plataformas sociais.
  const portrait = ph > pw;
  if (portrait) {
    const w = evenize(height);
    return { width: w, height: evenize((height * ph) / pw) };
  }
  return { width: evenize((height * pw) / ph), height: evenize(height) };
}

const QUALITY_FACTOR: Record<Exclude<ExportSettings['quality'], 'custom'>, number> = { low: 0.35, medium: 0.6, high: 1, 'very-high': 1.7 };
const CODEC_EFFICIENCY: Record<string, number> = { avc: 1, hevc: 0.6, vp9: 0.65, av1: 0.5, vp8: 1.1 };

/** Bitrate de vídeo (bits/s) usado na exportação — também base da estimativa de tamanho. */
export function videoBitrate(settings: ExportSettings, width: number, height: number): number {
  if (settings.quality === 'custom') return Math.max(100_000, settings.videoBitrate);
  const base = 8_000_000 * Math.pow((width * height) / (1920 * 1080), 0.9) * Math.pow(settings.fps / 30, 0.7);
  return Math.round(base * QUALITY_FACTOR[settings.quality] * (CODEC_EFFICIENCY[settings.videoCodec] ?? 1));
}

export function estimateExportBytes(project: Project, settings: ExportSettings): number {
  const { width, height } = outputSize(project, settings.height);
  const dur = exportRange(project, settings);
  const seconds = (dur.to - dur.from) / project.settings.fps;
  const audio = hasAudibleAudio(project) ? settings.audioBitrate : 0;
  return Math.round(((videoBitrate(settings, width, height) + audio) * seconds) / 8 * 1.02);
}

function exportRange(project: Project, settings: ExportSettings): { from: number; to: number } {
  const total = projectDuration(project);
  const from = Math.max(0, Math.min(total, settings.range?.start ?? 0));
  const to = Math.max(from, Math.min(total, settings.range?.end ?? total));
  return { from, to };
}

const MIME: Record<ExportSettings['format'], string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/** Fontes de quadros exatas para exportação (um leitor por clipe de vídeo). */
class ExportSources implements FrameSources {
  private readers = new Map<string, Promise<FrameReader>>();
  private lastUse = new Map<string, number>();
  private frames = new Map<string, CanvasImageSource | null>();
  private images = new Map<string, ImageBitmap>();
  readonly warnings = new Set<string>();

  constructor(
    private readonly loadBlob: (assetId: string) => Promise<Blob | undefined>,
    private readonly maxW: number,
    private readonly maxH: number,
  ) {}

  private reader(clip: VideoClip): Promise<FrameReader> {
    let r = this.readers.get(clip.id);
    if (!r) {
      r = (async () => {
        const blob = await this.loadBlob(clip.assetId);
        if (!blob) throw new FrameStudioError('MEDIA_MISSING', `Mídia ausente: ${clip.name}`);
        const reader = await openFrameReader(blob, { maxWidth: this.maxW * 2, maxHeight: this.maxH * 2 });
        if (reader.kind === 'element') this.warnings.add(`"${clip.name}" foi decodificado no modo compatível (mais lento).`);
        return reader;
      })();
      this.readers.set(clip.id, r);
    }
    return r;
  }

  async prepare(project: Project, frame: number): Promise<void> {
    const plan = planFrame(project, frame);
    this.frames.clear();
    for (const req of videoRequests(project, plan, frame)) {
      const reader = await this.reader(req.clip);
      this.frames.set(req.clip.id, await reader.frameAt(req.time));
      this.lastUse.set(req.clip.id, frame);
    }
    for (const id of imageRequests(plan)) {
      if (this.images.has(id)) continue;
      const blob = await this.loadBlob(id);
      if (!blob) throw new FrameStudioError('MEDIA_MISSING', `Imagem ausente: ${project.assets[id]?.name ?? id}`);
      this.images.set(id, await createImageBitmap(blob, { imageOrientation: 'from-image' }));
    }
    // Libera leitores que não são usados há mais de 3 s de timeline.
    const limit = project.settings.fps * 3;
    for (const [id, last] of this.lastUse) {
      if (frame - last > limit) {
        void this.readers.get(id)?.then((r) => r.dispose());
        this.readers.delete(id);
        this.lastUse.delete(id);
      }
    }
  }

  video(clip: VideoClip): CanvasImageSource | null {
    return this.frames.get(clip.id) ?? null;
  }
  image(assetId: string): CanvasImageSource | null {
    return this.images.get(assetId) ?? null;
  }

  async dispose(): Promise<void> {
    for (const r of this.readers.values()) await r.then((x) => x.dispose()).catch(() => {});
    this.readers.clear();
    for (const b of this.images.values()) b.close();
    this.images.clear();
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new FrameStudioError('CANCELLED', 'Exportação cancelada.');
};

export async function exportProject(job: ExportJob): Promise<ExportResult> {
  const { project, settings, signal } = job;
  const warnings: string[] = [];
  const progress = (p: Partial<ExportProgress> & Pick<ExportProgress, 'phase' | 'progress'>) =>
    job.onProgress?.({ frame: 0, totalFrames: 0, renderFps: 0, etaSeconds: null, ...p });
  progress({ phase: 'preparing', progress: 0 });

  const { width, height } = outputSize(project, settings.height);
  const fps = settings.fps;
  const range = exportRange(project, settings);
  const fromSec = range.from / project.settings.fps;
  const durationSec = (range.to - range.from) / project.settings.fps;
  if (durationSec <= 0) throw new FrameStudioError('EXPORT_FAILED', 'O projeto está vazio: adicione clipes à timeline antes de exportar.');
  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  if (!(await canEncodeVideoAt(settings.videoCodec, width, height, fps))) {
    throw new FrameStudioError('NOT_SUPPORTED', `Este dispositivo não consegue codificar ${settings.videoCodec.toUpperCase()} em ${width}×${height} a ${fps} fps.`);
  }
  const withAudio = hasAudibleAudio(project);
  if (withAudio && !(await canEncodeAudioCodec(settings.audioCodec))) {
    throw new FrameStudioError('NOT_SUPPORTED', `Este dispositivo não consegue codificar áudio ${settings.audioCodec.toUpperCase()}.`);
  }

  const textStyles = Object.values(project.clips).flatMap((c) => (c.type === 'text' || c.type === 'caption' ? [c.text] : []));
  await ensureFonts(textStyles);
  check(signal);

  // Saída.
  const bufferTarget = job.writable ? null : new BufferTarget();
  const target = job.writable ? new StreamTarget(job.writable, { chunked: true }) : bufferTarget!;
  const format =
    settings.format === 'webm'
      ? new WebMOutputFormat()
      : settings.format === 'mov'
        ? new MovOutputFormat({ fastStart: job.writable ? false : 'in-memory' })
        : new Mp4OutputFormat({ fastStart: job.writable ? false : 'in-memory' });
  const output = new Output({ format, target });
  const canvas = makeCanvas(width, height);
  const videoSource = new CanvasSource(canvas, {
    codec: settings.videoCodec as VideoCodec,
    bitrate: videoBitrate(settings, width, height),
    keyFrameInterval: 2,
    latencyMode: 'quality',
  });
  output.addVideoTrack(videoSource, { frameRate: fps });
  let audioSource: AudioBufferSource | null = null;
  if (withAudio) {
    audioSource = new AudioBufferSource({ codec: settings.audioCodec as AudioCodec, bitrate: settings.audioBitrate });
    output.addAudioTrack(audioSource);
  }

  const sources = new ExportSources(job.loadBlob, width, height);
  const compositor = new Compositor();
  let finished = false;
  try {
    // Áudio: decodifica as mídias necessárias.
    let audioSegments: { from: number; to: number }[] = [];
    if (withAudio) {
      progress({ phase: 'audio', progress: 0.01 });
      const failed = await job.audio.prepare(project);
      if (failed.length) warnings.push(`Áudio não decodificado: ${failed.join(', ')}`);
      const SEG = 20;
      for (let t = 0; t < durationSec; t += SEG) audioSegments.push({ from: fromSec + t, to: fromSec + Math.min(durationSec, t + SEG) });
    }
    check(signal);
    await output.start();

    let audioFedUntil = 0; // segundos relativos ao início da exportação
    const feedAudio = async (untilSec: number) => {
      if (!audioSource) return;
      while (audioSegments.length && audioFedUntil < untilSec) {
        const seg = audioSegments.shift()!;
        const buf = await renderMixOffline(project, job.audio.lookup, seg, 48000, 2);
        await audioSource.add(buf);
        audioFedUntil = seg.to - fromSec;
        check(signal);
      }
    };

    const started = performance.now();
    for (let i = 0; i < totalFrames; i++) {
      check(signal);
      const t = i / fps;
      const projFrame = (fromSec + t) * project.settings.fps;
      await sources.prepare(project, projFrame);
      compositor.render(canvas, project, projFrame, sources, { captions: settings.burnCaptions });
      await videoSource.add(t, 1 / fps);
      await feedAudio(t + 1);
      if (i % 5 === 0 || i === totalFrames - 1) {
        const elapsed = (performance.now() - started) / 1000;
        const rate = (i + 1) / Math.max(elapsed, 1e-3);
        progress({
          phase: 'video',
          progress: 0.02 + 0.95 * ((i + 1) / totalFrames),
          frame: i + 1,
          totalFrames,
          renderFps: rate,
          etaSeconds: (totalFrames - i - 1) / rate,
        });
        // Cede o controle para manter a interface responsiva.
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await feedAudio(Infinity);
    check(signal);
    progress({ phase: 'finalizing', progress: 0.98, frame: totalFrames, totalFrames });
    await output.finalize();
    finished = true;
    for (const w of sources.warnings) warnings.push(w);
    for (const w of compositor.warnings) warnings.push(w);
    const mimeType = MIME[settings.format];
    const blob = bufferTarget?.buffer ? new Blob([bufferTarget.buffer], { type: mimeType }) : undefined;
    progress({ phase: 'done', progress: 1, frame: totalFrames, totalFrames });
    return { blob, mimeType, bytes: blob?.size ?? 0, durationSec, width, height, warnings };
  } catch (e) {
    if (!finished) await output.cancel().catch(() => {});
    if (e instanceof FrameStudioError) throw e;
    throw new FrameStudioError('EXPORT_FAILED', `Falha na exportação: ${e instanceof Error ? e.message : String(e)}`, e);
  } finally {
    await sources.dispose();
    compositor.dispose();
  }
}
