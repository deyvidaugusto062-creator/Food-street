/** Acabamentos do modelo 3D do hero (ilustrativos — não representam o estoque da loja). */
export type FinishKey = 'laranja' | 'tartaruga' | 'cristal' | 'preto';

export const FINISHES: { key: FinishKey; label: string; swatch: string }[] = [
  { key: 'laranja', label: 'Laranja', swatch: 'linear-gradient(135deg, #ff9a4d, #e85d00)' },
  { key: 'tartaruga', label: 'Tartaruga', swatch: 'radial-gradient(circle at 30% 30%, #c98a3e, #5a2c10 55%, #1e0e05)' },
  { key: 'cristal', label: 'Cristal', swatch: 'linear-gradient(135deg, #ffffff, #e6e6e6)' },
  { key: 'preto', label: 'Preto', swatch: 'linear-gradient(135deg, #3a3f3d, #0b0d0c)' },
];
