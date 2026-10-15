/**
 * FrameStudio AI — modelo de dados do projeto (contrato compartilhado entre todos os módulos).
 *
 * Convenções:
 * - Posições e durações na timeline são inteiros em FRAMES, na taxa do projeto (`settings.fps`).
 * - Pontos de entrada na mídia de origem (`sourceIn`) são em SEGUNDOS, porque a mídia pode ter
 *   taxa de quadros diferente da do projeto.
 * - Coordenadas de transformação são em pixels do quadro do projeto, com origem no CENTRO do quadro.
 * - Nada aqui referencia o arquivo original diretamente: clipes apontam para `MediaAsset.id`,
 *   e o asset aponta para uma chave no armazenamento local. A edição é sempre não destrutiva.
 */

export const PROJECT_FORMAT_VERSION = 1;

export type Id = string;

// ───────────────────────────── Mídia ─────────────────────────────

export type AssetKind = 'video' | 'audio' | 'image';

export interface MediaAsset {
  id: Id;
  name: string;
  kind: AssetKind;
  mimeType: string;
  /** Tamanho em bytes. */
  size: number;
  /** Chave do blob no armazenamento local (OPFS/IndexedDB). */
  storageKey: string;
  /** Duração em segundos (0 para imagens estáticas). */
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  /** Rotação declarada no container (0/90/180/270). */
  rotation?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  sampleRate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  /** Identificador para re-vincular mídia ausente: nome + tamanho + data de modificação. */
  fingerprint: string;
  createdAt: number;
  /** Caminho de proxy de baixa resolução, quando gerado. */
  proxyKey?: string;
}

// ─────────────────────────── Animação ────────────────────────────

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold' | BezierEasing;

export interface BezierEasing {
  type: 'bezier';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe {
  id: Id;
  /** Frame relativo ao início do clipe. */
  frame: number;
  value: number;
  /** Interpolação aplicada ENTRE este keyframe e o próximo. */
  easing: Easing;
}

/**
 * Propriedades animáveis. Efeitos usam a forma `effect:<effectId>:<param>`
 * e cor usa `color:<campo>`.
 */
export type AnimatableProp =
  | 'x'
  | 'y'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'volume'
  | `color:${string}`
  | `effect:${string}:${string}`;

export type KeyframeMap = Partial<Record<AnimatableProp, Keyframe[]>>;

// ─────────────────────────── Visual ──────────────────────────────

export type FitMode = 'contain' | 'cover' | 'stretch';

export interface Transform {
  /** Deslocamento do centro em px do projeto (0,0 = centro do quadro). */
  x: number;
  y: number;
  /** Multiplicador sobre o tamanho após `fit`. */
  scale: number;
  /** Graus, sentido horário. */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  fit: FitMode;
}

/** Recorte em frações da mídia original (0..1). */
export interface Crop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type MaskShape = 'none' | 'rectangle' | 'ellipse' | 'linear';

export interface Mask {
  shape: MaskShape;
  /** Centro relativo à camada (-0.5..0.5). */
  cx: number;
  cy: number;
  /** Tamanho relativo à camada (0..1). */
  width: number;
  height: number;
  /** Borda suave em fração (0..0.5). */
  feather: number;
  /** Para máscara linear: ângulo em graus. */
  angle: number;
  invert: boolean;
}

export type EffectType =
  | 'blur'
  | 'sharpen'
  | 'vignette'
  | 'grayscale'
  | 'sepia'
  | 'grain'
  | 'glow'
  | 'shadow'
  | 'distort'
  | 'zoom'
  | 'shake'
  | 'glitch'
  | 'flash'
  | 'motion-blur'
  | 'directional-blur'
  | 'chromatic-aberration'
  | 'chroma-key'
  | 'invert'
  | 'pixelate';

export interface Effect {
  id: Id;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number | string>;
}

export interface ColorAdjust {
  exposure: number; // -3..3 EV
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  temperature: number; // -1..1
  tint: number; // -1..1
  hue: number; // -180..180
  shadows: number; // -1..1
  highlights: number; // -1..1
  blacks: number; // -1..1
  whites: number; // -1..1
  gamma: number; // 0.2..3, 1 = neutro
  vibrance: number; // -1..1
  /** Curvas RGB: pontos (x,y) em 0..1, por canal. Vazio = identidade. */
  curves?: { master: Point[]; r: Point[]; g: Point[]; b: Point[] };
  /** Ajuste HSL por faixa de matiz (8 faixas). */
  hsl?: HslBand[];
  /** LUT 3D importada (.cube), referenciada pelo id do LUT no projeto. */
  lutId?: Id;
  lutIntensity?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HslBand {
  /** Cor central da faixa, em graus. */
  hue: number;
  hueShift: number;
  saturation: number;
  luminance: number;
}

// ─────────────────────────── Áudio ───────────────────────────────

export interface AudioProps {
  /** Ganho linear (1 = 0 dB). */
  volume: number;
  muted: boolean;
  /** Segundos. */
  fadeIn: number;
  fadeOut: number;
  /** -1 (esq) .. 1 (dir). */
  pan: number;
  /** Normalização: ganho extra calculado, em dB. */
  normalizeGainDb?: number;
  /** Filtros de áudio aplicados ao clipe. */
  eq?: { low: number; mid: number; high: number }; // dB
  compressor?: { enabled: boolean; threshold: number; ratio: number; attack: number; release: number };
  noiseReduction?: { enabled: boolean; amount: number };
  /** Mono para estéreo / somente um canal. */
  channelMode?: 'stereo' | 'left' | 'right' | 'mono';
}

// ─────────────────────────── Texto ───────────────────────────────

export type TextAnimation = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'pop' | 'typewriter' | 'blur-in';

export interface TextStyle {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  /** Largura máxima da caixa em px do projeto (quebra automática). 0 = sem limite. */
  boxWidth: number;
  stroke: { enabled: boolean; color: string; width: number };
  shadow: { enabled: boolean; color: string; blur: number; x: number; y: number };
  background: { enabled: boolean; color: string; padding: number; radius: number };
  animationIn: TextAnimation;
  animationOut: TextAnimation;
  /** Duração das animações de entrada/saída em frames. */
  animationDuration: number;
}

export interface CaptionWord {
  text: string;
  /** Segundos relativos ao início da legenda. */
  start: number;
  end: number;
}

export interface CaptionStyleExtra {
  /** Destaca a palavra falada (karaokê). */
  highlightWords: boolean;
  highlightColor: string;
  /** Exibe somente a palavra atual. */
  wordByWord: boolean;
}

// ─────────────────────────── Clipes ──────────────────────────────

export type ClipType = 'video' | 'image' | 'audio' | 'text' | 'caption' | 'adjustment';

interface ClipBase {
  id: Id;
  trackId: Id;
  name: string;
  /** Frame de início na timeline. */
  start: number;
  /** Duração na timeline, em frames (>= 1). */
  duration: number;
  groupId?: Id;
  keyframes: KeyframeMap;
}

export interface VisualProps {
  transform: Transform;
  opacity: number;
  blendMode: BlendMode;
  crop: Crop;
  mask: Mask;
  effects: Effect[];
  color: ColorAdjust;
}

export interface MediaClipBase extends ClipBase {
  assetId: Id;
  /** Ponto de entrada na mídia de origem, em segundos. */
  sourceIn: number;
  /** Velocidade de reprodução (0.1..16). */
  speed: number;
  /** Reprodução reversa. */
  reverse: boolean;
  /** Congela em `sourceIn` (freeze frame). */
  freeze: boolean;
}

export interface VideoClip extends MediaClipBase, VisualProps {
  type: 'video';
  audio: AudioProps;
}

export interface ImageClip extends ClipBase, VisualProps {
  type: 'image';
  assetId: Id;
}

export interface AudioClip extends MediaClipBase {
  type: 'audio';
  audio: AudioProps;
}

export interface TextClip extends ClipBase, VisualProps {
  type: 'text';
  text: TextStyle;
}

export interface CaptionClip extends ClipBase, VisualProps {
  type: 'caption';
  text: TextStyle;
  words: CaptionWord[];
  caption: CaptionStyleExtra;
}

/** Camada de ajuste: aplica cor/efeitos a tudo que está abaixo dela. */
export interface AdjustmentClip extends ClipBase, Pick<VisualProps, 'effects' | 'color' | 'opacity'> {
  type: 'adjustment';
}

export type Clip = VideoClip | ImageClip | AudioClip | TextClip | CaptionClip | AdjustmentClip;
export type VisualClip = VideoClip | ImageClip | TextClip | CaptionClip;
export type MediaClip = VideoClip | ImageClip | AudioClip;

// ─────────────────────────── Faixas ──────────────────────────────

export type TrackKind = 'video' | 'audio' | 'text' | 'caption';

export interface Track {
  id: Id;
  kind: TrackKind;
  name: string;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  solo: boolean;
  /** Volume da faixa (multiplica o volume dos clipes). */
  volume: number;
  height: number;
}

export type TransitionType =
  | 'dissolve'
  | 'fade-black'
  | 'fade-white'
  | 'wipe'
  | 'slide'
  | 'push'
  | 'zoom'
  | 'blur'
  | 'flash'
  | 'circle'
  | 'diamond'
  | 'clock';

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Transição centrada no ponto de corte entre dois clipes adjacentes da mesma faixa. */
export interface Transition {
  id: Id;
  trackId: Id;
  fromClipId: Id;
  toClipId: Id;
  type: TransitionType;
  /** Duração total em frames (metade antes e metade depois do corte). */
  duration: number;
  direction: Direction;
  easing: Easing;
  intensity: number;
}

export interface Marker {
  id: Id;
  frame: number;
  label: string;
  color: string;
}

export interface Lut {
  id: Id;
  name: string;
  size: number;
  /** Dados RGB em float (size³ × 3), serializados como array. */
  data: number[];
}

// ─────────────────────────── Projeto ─────────────────────────────

export type ExportFormat = 'mp4' | 'webm' | 'mov';
export type VideoCodecId = 'avc' | 'hevc' | 'vp9' | 'vp8' | 'av1';
export type AudioCodecId = 'aac' | 'opus' | 'mp3' | 'flac' | 'pcm';

export interface ExportSettings {
  fileName: string;
  format: ExportFormat;
  videoCodec: VideoCodecId;
  audioCodec: AudioCodecId;
  /** Altura de saída (480, 720, 1080, 1440, 2160) ou 0 para usar a do projeto. */
  height: number;
  fps: number;
  quality: 'low' | 'medium' | 'high' | 'very-high' | 'custom';
  /** bits/s quando `quality === 'custom'`. */
  videoBitrate: number;
  audioBitrate: number;
  burnCaptions: boolean;
  /** Exporta só um trecho (frames). */
  range?: { start: number; end: number };
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  background: string;
  sampleRate: number;
}

export interface Project {
  id: Id;
  formatVersion: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  settings: ProjectSettings;
  assets: Record<Id, MediaAsset>;
  /** Ordem de exibição: índice 0 no topo. Faixas visuais superiores ficam sobre as inferiores. */
  tracks: Track[];
  clips: Record<Id, Clip>;
  transitions: Record<Id, Transition>;
  markers: Marker[];
  luts: Record<Id, Lut>;
  exportSettings: ExportSettings;
  /** Origem: template usado, se houver. */
  templateId?: string;
  /** Miniatura (data URL JPEG pequena). */
  thumbnail?: string;
}

export interface ProjectSummary {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  thumbnail?: string;
  /** Há um salvamento de recuperação mais recente que o último salvamento explícito. */
  hasRecovery?: boolean;
}
