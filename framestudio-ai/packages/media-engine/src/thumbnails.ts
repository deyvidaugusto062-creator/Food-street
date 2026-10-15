import type { MediaAsset } from '@framestudio/shared';
import { openFrameReader } from './frame-reader.ts';

export interface Thumbnail {
  /** Tempo de origem em segundos. */
  time: number;
  blob: Blob;
}

function canvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function toJpeg(c: OffscreenCanvas | HTMLCanvasElement, quality = 0.72): Promise<Blob> {
  if ('convertToBlob' in c) return c.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('toBlob falhou'))), 'image/jpeg', quality));
}

/**
 * Gera miniaturas reais distribuídas ao longo do vídeo (ou uma única para imagens).
 * Altura padrão de 72 px — adequada para a timeline e a biblioteca.
 */
export async function generateThumbnails(blob: Blob, asset: MediaAsset, count: number, height = 72, signal?: AbortSignal): Promise<Thumbnail[]> {
  const aspect = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
  const w = Math.max(2, Math.round(height * aspect));
  if (asset.kind === 'image') {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const c = canvas(w, height);
    (c.getContext('2d') as CanvasRenderingContext2D).drawImage(bmp, 0, 0, w, height);
    bmp.close();
    return [{ time: 0, blob: await toJpeg(c) }];
  }
  if (asset.kind !== 'video') return [];
  const reader = await openFrameReader(blob, { maxHeight: height * 2 });
  try {
    const out: Thumbnail[] = [];
    const n = Math.max(1, count);
    const c = canvas(w, height);
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    for (let i = 0; i < n; i++) {
      if (signal?.aborted) break;
      const t = n === 1 ? Math.min(0.5, asset.duration / 2) : (asset.duration * (i + 0.5)) / n;
      const frame = await reader.frameAt(t);
      if (!frame) continue;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, height);
      ctx.drawImage(frame, 0, 0, w, height);
      out.push({ time: t, blob: await toJpeg(c) });
    }
    return out;
  } finally {
    reader.dispose();
  }
}
