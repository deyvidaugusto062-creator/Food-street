import type { EffectType, TransitionType } from '@framestudio/shared';

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Parâmetro de cor (string hex) em vez de número. */
  color?: string;
}

export interface EffectDef {
  type: EffectType;
  label: string;
  category: 'básico' | 'dinâmico' | 'composição';
  description: string;
  params: ParamDef[];
}

const p = (key: string, label: string, min: number, max: number, def: number, step = 0.01): ParamDef => ({ key, label, min, max, step, default: def });

export const EFFECT_DEFS: Record<EffectType, EffectDef> = {
  blur: { type: 'blur', label: 'Desfoque', category: 'básico', description: 'Desfoque gaussiano.', params: [p('radius', 'Raio (px)', 0, 60, 8, 0.5)] },
  sharpen: { type: 'sharpen', label: 'Nitidez', category: 'básico', description: 'Realça bordas (unsharp mask).', params: [p('amount', 'Intensidade', 0, 3, 0.8)] },
  vignette: {
    type: 'vignette',
    label: 'Vinheta',
    category: 'básico',
    description: 'Escurece as bordas do quadro.',
    params: [p('amount', 'Intensidade', 0, 1, 0.5), p('size', 'Tamanho', 0.1, 1, 0.55), p('softness', 'Suavidade', 0.05, 1, 0.45)],
  },
  grayscale: { type: 'grayscale', label: 'Preto e branco', category: 'básico', description: 'Remove a cor.', params: [p('amount', 'Intensidade', 0, 1, 1)] },
  sepia: { type: 'sepia', label: 'Sépia', category: 'básico', description: 'Tom envelhecido.', params: [p('amount', 'Intensidade', 0, 1, 0.8)] },
  grain: {
    type: 'grain',
    label: 'Granulação',
    category: 'básico',
    description: 'Ruído de filme, varia a cada frame.',
    params: [p('amount', 'Intensidade', 0, 1, 0.25), p('size', 'Tamanho', 1, 4, 1.5, 0.1)],
  },
  glow: {
    type: 'glow',
    label: 'Glow',
    category: 'básico',
    description: 'Brilho difuso nas áreas claras.',
    params: [p('amount', 'Intensidade', 0, 2, 0.7), p('radius', 'Raio (px)', 1, 40, 12, 0.5), p('threshold', 'Limiar', 0, 1, 0.6)],
  },
  shadow: {
    type: 'shadow',
    label: 'Sombra',
    category: 'básico',
    description: 'Sombra projetada da camada.',
    params: [p('blur', 'Desfoque', 0, 80, 24, 1), p('x', 'Deslocamento X', -100, 100, 0, 1), p('y', 'Deslocamento Y', -100, 100, 16, 1), p('opacity', 'Opacidade', 0, 1, 0.6)],
  },
  distort: {
    type: 'distort',
    label: 'Distorção',
    category: 'básico',
    description: 'Ondulação senoidal da imagem.',
    params: [p('amount', 'Amplitude', 0, 0.1, 0.02, 0.001), p('frequency', 'Frequência', 1, 40, 10, 0.5), p('speed', 'Velocidade', 0, 10, 2, 0.1)],
  },
  zoom: {
    type: 'zoom',
    label: 'Zoom',
    category: 'dinâmico',
    description: 'Zoom progressivo (Ken Burns) ao longo do clipe.',
    params: [p('from', 'Escala inicial', 0.5, 3, 1), p('to', 'Escala final', 0.5, 3, 1.2)],
  },
  shake: {
    type: 'shake',
    label: 'Tremor',
    category: 'dinâmico',
    description: 'Tremor de câmera pseudoaleatório determinístico.',
    params: [p('amount', 'Intensidade (px)', 0, 80, 12, 1), p('frequency', 'Frequência', 1, 30, 12, 0.5), p('rotation', 'Rotação (°)', 0, 10, 1, 0.1)],
  },
  glitch: {
    type: 'glitch',
    label: 'Glitch',
    category: 'dinâmico',
    description: 'Deslocamento de blocos e canais.',
    params: [p('amount', 'Intensidade', 0, 1, 0.5), p('speed', 'Velocidade', 1, 30, 10, 0.5)],
  },
  flash: {
    type: 'flash',
    label: 'Flash',
    category: 'dinâmico',
    description: 'Clarão periódico.',
    params: [p('amount', 'Intensidade', 0, 1, 0.8), p('frequency', 'Por segundo', 0.1, 10, 1, 0.1)],
  },
  'motion-blur': {
    type: 'motion-blur',
    label: 'Motion blur',
    category: 'dinâmico',
    description: 'Mistura de quadros (rastro). Aplicado como desfoque direcional na direção do movimento animado.',
    params: [p('amount', 'Intensidade', 0, 1, 0.5)],
  },
  'directional-blur': {
    type: 'directional-blur',
    label: 'Desfoque direcional',
    category: 'dinâmico',
    description: 'Desfoque linear em um ângulo.',
    params: [p('length', 'Comprimento (px)', 0, 80, 16, 0.5), p('angle', 'Ângulo (°)', 0, 360, 0, 1)],
  },
  'chromatic-aberration': {
    type: 'chromatic-aberration',
    label: 'Aberração cromática',
    category: 'dinâmico',
    description: 'Separa os canais RGB.',
    params: [p('amount', 'Deslocamento (px)', 0, 30, 6, 0.5), p('angle', 'Ângulo (°)', 0, 360, 0, 1)],
  },
  'chroma-key': {
    type: 'chroma-key',
    label: 'Chroma key',
    category: 'composição',
    description: 'Remove uma cor de fundo (tela verde/azul).',
    params: [
      { key: 'color', label: 'Cor-chave', min: 0, max: 0, step: 0, default: 0, color: '#00ff00' },
      p('similarity', 'Similaridade', 0, 1, 0.35),
      p('smoothness', 'Suavidade', 0, 1, 0.08),
      p('spill', 'Remover spill', 0, 1, 0.5),
    ],
  },
  invert: { type: 'invert', label: 'Inverter', category: 'básico', description: 'Negativo da imagem.', params: [p('amount', 'Intensidade', 0, 1, 1)] },
  pixelate: { type: 'pixelate', label: 'Pixelizar', category: 'básico', description: 'Mosaico de pixels.', params: [p('size', 'Tamanho do bloco', 1, 80, 12, 1)] },
};

export function defaultEffectParams(type: EffectType): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const prm of EFFECT_DEFS[type].params) out[prm.key] = prm.color ?? prm.default;
  return out;
}

export const TRANSITION_DEFS: { type: TransitionType; label: string; directional: boolean }[] = [
  { type: 'dissolve', label: 'Dissolver', directional: false },
  { type: 'fade-black', label: 'Fade (preto)', directional: false },
  { type: 'fade-white', label: 'Fade (branco)', directional: false },
  { type: 'wipe', label: 'Wipe', directional: true },
  { type: 'slide', label: 'Slide', directional: true },
  { type: 'push', label: 'Push', directional: true },
  { type: 'zoom', label: 'Zoom', directional: false },
  { type: 'blur', label: 'Desfoque', directional: false },
  { type: 'flash', label: 'Flash', directional: false },
  { type: 'circle', label: 'Círculo', directional: false },
  { type: 'diamond', label: 'Losango', directional: false },
  { type: 'clock', label: 'Relógio', directional: false },
];
