import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat, canEncodeVideo } from 'mediabunny';
import { FrameStudioError } from '@framestudio/shared';

/**
 * Gera um proxy de baixa resolução (edição fluida de arquivos pesados). O arquivo original é
 * preservado e continua sendo usado na exportação final.
 */
export async function generateProxy(
  blob: Blob,
  opts: { height?: number; onProgress?: (p: number) => void; signal?: AbortSignal } = {},
): Promise<Blob> {
  const height = opts.height ?? 540;
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const useMp4 = await canEncodeVideo('avc', { width: Math.round((height * 16) / 9), height }).catch(() => false);
    const target = new BufferTarget();
    const output = new Output({ format: useMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target });
    const conversion = await Conversion.init({
      input,
      output,
      video: { height, fit: 'contain', codec: useMp4 ? 'avc' : 'vp9', bitrate: 1_500_000, forceTranscode: true },
      audio: { discard: true },
    });
    if (!conversion.isValid) throw new FrameStudioError('NOT_SUPPORTED', 'Não foi possível gerar o proxy para este arquivo neste dispositivo.');
    conversion.onProgress = (p) => opts.onProgress?.(p);
    const abort = () => void conversion.cancel();
    opts.signal?.addEventListener('abort', abort, { once: true });
    try {
      await conversion.execute();
    } finally {
      opts.signal?.removeEventListener('abort', abort);
    }
    if (opts.signal?.aborted) throw new FrameStudioError('CANCELLED', 'Geração de proxy cancelada.');
    return new Blob([target.buffer!], { type: useMp4 ? 'video/mp4' : 'video/webm' });
  } finally {
    input.dispose();
  }
}
