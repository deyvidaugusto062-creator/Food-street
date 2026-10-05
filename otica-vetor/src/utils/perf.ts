/**
 * Detecção de capacidades para dosar os efeitos visuais.
 *   full → desktop/aparelho capaz: 3D completo, inclinação dos cards, vidro
 *   lite → celular ou aparelho modesto: 3D simplificado, sem blur pesado
 *   off  → sem WebGL ou com "reduzir movimento": imagem estática, sem animações automáticas
 */
export type FxTier = 'full' | 'lite' | 'off';

let webgl: boolean | null = null;

export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webgl = Boolean(gl);
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const hasFinePointer = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

export function isLowPowerDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  if ((nav.hardwareConcurrency ?? 8) <= 2) return true;
  if ((nav.deviceMemory ?? 8) <= 2) return true;
  return false;
}

export function getFxTier(): FxTier {
  if (prefersReducedMotion()) return 'off';
  if (isLowPowerDevice() || !hasFinePointer()) return 'lite';
  return 'full';
}

/** Marca o <html> com data-fx para o CSS reduzir efeitos (blur, sombras animadas…) */
export function applyFxTier() {
  document.documentElement.dataset.fx = getFxTier();
}
