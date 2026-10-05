/** Acabamentos do modelo 3D do hero (ilustrativos — não representam o estoque da loja). */
export type FinishKey = 'verde' | 'tartaruga' | 'cristal' | 'preto';

export const FINISHES: { key: FinishKey; label: string; swatch: string }[] = [
  { key: 'verde', label: 'Verde profundo', swatch: 'linear-gradient(135deg, #2d6e5e, #12352d)' },
  { key: 'tartaruga', label: 'Tartaruga', swatch: 'radial-gradient(circle at 30% 30%, #c98a3e, #5a2c10 55%, #1e0e05)' },
  { key: 'cristal', label: 'Cristal', swatch: 'linear-gradient(135deg, #ffffff, #cfe6da)' },
  { key: 'preto', label: 'Preto', swatch: 'linear-gradient(135deg, #3a3f3d, #0b0d0c)' },
];
