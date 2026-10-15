import type { ColorAdjust, TextStyle } from '@framestudio/shared';

export interface TextPreset {
  id: string;
  label: string;
  style: Partial<TextStyle>;
}

const noShadow = { enabled: false, color: 'rgba(0,0,0,0.5)', blur: 0, x: 0, y: 0 };

export const TEXT_PRESETS: TextPreset[] = [
  { id: 'title', label: 'Título', style: { content: 'Título', fontSize: 120, fontWeight: 800, fontFamily: '"Montserrat Variable", Montserrat, sans-serif', animationIn: 'pop', animationOut: 'fade' } },
  { id: 'subtitle', label: 'Subtítulo', style: { content: 'Subtítulo', fontSize: 64, fontWeight: 500, animationIn: 'fade', animationOut: 'fade' } },
  { id: 'body', label: 'Texto livre', style: { content: 'Digite seu texto', fontSize: 52, fontWeight: 400, shadow: noShadow } },
  {
    id: 'lower-third',
    label: 'Lower third',
    style: { content: 'Nome Sobrenome\nCargo', fontSize: 44, fontWeight: 600, align: 'left', background: { enabled: true, color: 'rgba(130,87,255,0.92)', padding: 22, radius: 10 }, animationIn: 'slide-left', animationOut: 'fade', shadow: noShadow },
  },
  { id: 'impact', label: 'Impacto', style: { content: 'IMPACTO', fontSize: 180, fontFamily: '"Bebas Neue", sans-serif', fontWeight: 400, letterSpacing: 6, stroke: { enabled: true, color: '#101014', width: 6 }, animationIn: 'pop' } },
  { id: 'neon', label: 'Neon', style: { content: 'NEON', fontSize: 130, fontWeight: 700, color: '#B39CFF', shadow: { enabled: true, color: 'rgba(130,87,255,0.95)', blur: 36, x: 0, y: 0 }, animationIn: 'blur-in' } },
  { id: 'typewriter', label: 'Máquina de escrever', style: { content: 'Era uma vez…', fontSize: 64, fontFamily: '"Roboto Mono Variable", monospace', fontWeight: 500, animationIn: 'typewriter', animationDuration: 45, shadow: noShadow } },
  { id: 'quote', label: 'Citação', style: { content: '“Uma frase marcante.”', fontSize: 72, fontFamily: '"Playfair Display Variable", serif', italic: true, fontWeight: 500, animationIn: 'fade' } },
  { id: 'cta', label: 'Chamada (CTA)', style: { content: 'Inscreva-se', fontSize: 60, fontWeight: 700, color: '#101014', background: { enabled: true, color: '#F5F5F7', padding: 26, radius: 48 }, animationIn: 'slide-up', shadow: noShadow } },
  { id: 'marker', label: 'Manuscrito', style: { content: 'Uau!', fontSize: 110, fontFamily: '"Permanent Marker", cursive', fontWeight: 400, color: '#FFE08A', animationIn: 'pop' } },
];

export const STICKERS = ['🔥', '✨', '❤️', '😂', '👍', '🎉', '⭐', '👀', '💡', '✅', '❌', '🚀', '📌', '🎬', '🎵', '💥', '👉', '😍', '🤯', '💯'];

export interface ColorPreset {
  id: string;
  label: string;
  color: Partial<ColorAdjust>;
  swatch: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'none', label: 'Original', color: {}, swatch: 'linear-gradient(135deg,#888,#ccc)' },
  { id: 'cinema', label: 'Cinema', color: { contrast: 0.18, saturation: -0.12, temperature: -0.08, shadows: -0.1, highlights: -0.1, tint: 0.04 }, swatch: 'linear-gradient(135deg,#0f3b4a,#d8a25e)' },
  { id: 'warm', label: 'Quente', color: { temperature: 0.35, saturation: 0.08, exposure: 0.05 }, swatch: 'linear-gradient(135deg,#d97a3a,#f6d39b)' },
  { id: 'cool', label: 'Frio', color: { temperature: -0.35, tint: -0.05, contrast: 0.05 }, swatch: 'linear-gradient(135deg,#2f5c9c,#a8d0f0)' },
  { id: 'vivid', label: 'Vívido', color: { saturation: 0.35, vibrance: 0.3, contrast: 0.12 }, swatch: 'linear-gradient(135deg,#e5306b,#30c2e5)' },
  { id: 'faded', label: 'Desbotado', color: { blacks: -0.5, contrast: -0.2, saturation: -0.2 }, swatch: 'linear-gradient(135deg,#8c8c95,#d6d1c8)' },
  { id: 'bw', label: 'P&B contrastado', color: { saturation: -1, contrast: 0.3 }, swatch: 'linear-gradient(135deg,#111,#eee)' },
  { id: 'noir', label: 'Noir', color: { saturation: -1, contrast: 0.5, exposure: -0.25, shadows: -0.3 }, swatch: 'linear-gradient(135deg,#000,#777)' },
  { id: 'vintage', label: 'Vintage', color: { temperature: 0.2, saturation: -0.25, contrast: -0.08, blacks: -0.3, tint: 0.08 }, swatch: 'linear-gradient(135deg,#7a5d3b,#e9d3a6)' },
  { id: 'teal-orange', label: 'Teal & Orange', color: { contrast: 0.15, saturation: 0.1, hsl: [
    { hue: 0, hueShift: 0, saturation: 0, luminance: 0 },
    { hue: 30, hueShift: 0, saturation: 0.25, luminance: 0.05 },
    { hue: 60, hueShift: -8, saturation: 0, luminance: 0 },
    { hue: 120, hueShift: 30, saturation: -0.3, luminance: 0 },
    { hue: 180, hueShift: 0, saturation: 0.25, luminance: -0.05 },
    { hue: 220, hueShift: -20, saturation: 0.15, luminance: 0 },
    { hue: 270, hueShift: 0, saturation: -0.2, luminance: 0 },
    { hue: 320, hueShift: 0, saturation: 0, luminance: 0 },
  ] }, swatch: 'linear-gradient(135deg,#167c80,#f08a3c)' },
];

export const HSL_BANDS = [
  { hue: 0, label: 'Vermelho', color: '#ef4444' },
  { hue: 30, label: 'Laranja', color: '#f97316' },
  { hue: 60, label: 'Amarelo', color: '#eab308' },
  { hue: 120, label: 'Verde', color: '#22c55e' },
  { hue: 180, label: 'Ciano', color: '#06b6d4' },
  { hue: 220, label: 'Azul', color: '#3b82f6' },
  { hue: 270, label: 'Roxo', color: '#8b5cf6' },
  { hue: 320, label: 'Magenta', color: '#ec4899' },
];
