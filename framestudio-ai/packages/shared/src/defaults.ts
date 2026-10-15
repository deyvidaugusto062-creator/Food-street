import { createId } from './id.ts';
import {
  PROJECT_FORMAT_VERSION,
  type AudioProps,
  type ColorAdjust,
  type Crop,
  type ExportSettings,
  type Mask,
  type Project,
  type ProjectSettings,
  type TextStyle,
  type Track,
  type TrackKind,
  type Transform,
  type VisualProps,
} from './model.ts';

export interface AspectPreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: '16:9', label: 'Horizontal 16:9', description: 'YouTube, apresentações', width: 1920, height: 1080 },
  { id: '9:16', label: 'Vertical 9:16', description: 'Reels, TikTok, Shorts', width: 1080, height: 1920 },
  { id: '1:1', label: 'Quadrado 1:1', description: 'Feed', width: 1080, height: 1080 },
  { id: '4:5', label: 'Retrato 4:5', description: 'Feed do Instagram', width: 1080, height: 1350 },
  { id: '21:9', label: 'Cinema 21:9', description: 'Cinematográfico', width: 2560, height: 1080 },
];

export const FPS_OPTIONS = [24, 25, 30, 50, 60] as const;

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  fit: 'contain',
};

export const DEFAULT_CROP: Crop = { left: 0, top: 0, right: 0, bottom: 0 };

export const DEFAULT_MASK: Mask = {
  shape: 'none',
  cx: 0,
  cy: 0,
  width: 0.6,
  height: 0.6,
  feather: 0.05,
  angle: 0,
  invert: false,
};

export const DEFAULT_COLOR: ColorAdjust = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  shadows: 0,
  highlights: 0,
  blacks: 0,
  whites: 0,
  gamma: 1,
  vibrance: 0,
};

export const DEFAULT_AUDIO: AudioProps = {
  volume: 1,
  muted: false,
  fadeIn: 0,
  fadeOut: 0,
  pan: 0,
};

export function defaultVisual(): VisualProps {
  return {
    transform: { ...DEFAULT_TRANSFORM },
    opacity: 1,
    blendMode: 'normal',
    crop: { ...DEFAULT_CROP },
    mask: { ...DEFAULT_MASK },
    effects: [],
    color: { ...DEFAULT_COLOR },
  };
}

export const DEFAULT_FONT_STACK = '"Inter Variable", Inter, sans-serif';

export function defaultTextStyle(content = 'Seu texto aqui'): TextStyle {
  return {
    content,
    fontFamily: DEFAULT_FONT_STACK,
    fontSize: 96,
    fontWeight: 700,
    italic: false,
    color: '#F5F5F7',
    align: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    boxWidth: 0,
    stroke: { enabled: false, color: '#101014', width: 6 },
    shadow: { enabled: true, color: 'rgba(0,0,0,0.55)', blur: 16, x: 0, y: 4 },
    background: { enabled: false, color: 'rgba(16,16,20,0.75)', padding: 24, radius: 16 },
    animationIn: 'none',
    animationOut: 'none',
    animationDuration: 12,
  };
}

export function defaultExportSettings(name: string, fps: number): ExportSettings {
  return {
    fileName: name,
    format: 'mp4',
    videoCodec: 'avc',
    audioCodec: 'aac',
    height: 0,
    fps,
    quality: 'high',
    videoBitrate: 8_000_000,
    audioBitrate: 192_000,
    burnCaptions: true,
  };
}

const TRACK_NAMES: Record<TrackKind, string> = {
  video: 'Vídeo',
  audio: 'Áudio',
  text: 'Texto',
  caption: 'Legendas',
};

export function createTrack(kind: TrackKind, index = 1): Track {
  return {
    id: createId('trk_'),
    kind,
    name: `${TRACK_NAMES[kind]} ${index}`,
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
    volume: 1,
    height: kind === 'audio' ? 56 : 64,
  };
}

export interface NewProjectOptions {
  name: string;
  width: number;
  height: number;
  fps: number;
  background?: string;
}

export function createProject(opts: NewProjectOptions): Project {
  const now = Date.now();
  const settings: ProjectSettings = {
    width: evenize(opts.width),
    height: evenize(opts.height),
    fps: opts.fps,
    background: opts.background ?? '#000000',
    sampleRate: 48000,
  };
  return {
    id: createId('prj_'),
    formatVersion: PROJECT_FORMAT_VERSION,
    name: opts.name.trim() || 'Projeto sem título',
    createdAt: now,
    updatedAt: now,
    favorite: false,
    settings,
    assets: {},
    tracks: [createTrack('text', 1), createTrack('video', 1), createTrack('audio', 1)],
    clips: {},
    transitions: {},
    markers: [],
    luts: {},
    exportSettings: defaultExportSettings(opts.name.trim() || 'framestudio', opts.fps),
  };
}

/** Codificadores de vídeo exigem dimensões pares. */
export function evenize(n: number): number {
  const r = Math.max(2, Math.round(n));
  return r % 2 === 0 ? r : r + 1;
}
