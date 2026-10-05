import { SINGLE_FILE } from '../config/site';

declare global {
  interface Window {
    /** Imagens embutidas na versão de arquivo único (caminho → data URI) */
    __OV_ASSETS__?: Record<string, string>;
  }
}

const embedded = (path: string) => (typeof window !== 'undefined' ? window.__OV_ASSETS__?.[path] : undefined) ?? path;

/**
 * Fontes de uma imagem otimizada a partir do caminho sem extensão.
 * Na versão de arquivo único só existe o WebP, embutido no HTML.
 */
export function imageSources(base: string) {
  if (SINGLE_FILE) return { avif: undefined, webp: embedded(`${base}.webp`) };
  return { avif: `${base}.avif`, webp: `${base}.webp` };
}
