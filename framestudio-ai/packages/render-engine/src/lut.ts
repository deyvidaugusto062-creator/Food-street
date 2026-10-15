import { createId, FrameStudioError, type Lut } from '@framestudio/shared';

/**
 * Lê um arquivo .cube (Adobe/Resolve) com LUT_3D_SIZE. Suporta DOMAIN_MIN/MAX.
 * Ordem dos dados no .cube: R varia mais rápido, depois G, depois B — igual ao layout de textura 3D (x=R).
 */
export function parseCubeLut(text: string, name = 'LUT'): Lut {
  let size = 0;
  let min = [0, 0, 0];
  let max = [1, 1, 1];
  const data: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0]!.toUpperCase();
    if (key === 'TITLE') continue;
    if (key === 'LUT_3D_SIZE') {
      size = parseInt(parts[1]!, 10);
      continue;
    }
    if (key === 'LUT_1D_SIZE') throw new FrameStudioError('UNSUPPORTED_FILE', 'LUTs 1D não são suportados; use um .cube 3D.');
    if (key === 'DOMAIN_MIN') {
      min = parts.slice(1, 4).map(Number);
      continue;
    }
    if (key === 'DOMAIN_MAX') {
      max = parts.slice(1, 4).map(Number);
      continue;
    }
    if (/^[-+\d.]/.test(key)) {
      const v = parts.slice(0, 3).map(Number);
      if (v.length !== 3 || v.some((n) => !Number.isFinite(n))) throw new FrameStudioError('CORRUPTED_FILE', `Linha inválida no LUT: "${line}"`);
      data.push((v[0]! - min[0]!) / (max[0]! - min[0]!), (v[1]! - min[1]!) / (max[1]! - min[1]!), (v[2]! - min[2]!) / (max[2]! - min[2]!));
    }
  }
  if (size < 2 || size > 128) throw new FrameStudioError('CORRUPTED_FILE', 'LUT_3D_SIZE ausente ou inválido.');
  if (data.length !== size * size * size * 3) throw new FrameStudioError('CORRUPTED_FILE', `O LUT declara ${size}³ entradas, mas contém ${data.length / 3}.`);
  return { id: createId('lut_'), name, size, data };
}
