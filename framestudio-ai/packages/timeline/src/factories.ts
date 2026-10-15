import {
  createId,
  defaultTextStyle,
  defaultVisual,
  DEFAULT_AUDIO,
  secondsToFrames,
  type AdjustmentClip,
  type AudioClip,
  type CaptionClip,
  type CaptionWord,
  type ImageClip,
  type MediaAsset,
  type TextClip,
  type TextStyle,
  type VideoClip,
} from '@framestudio/shared';

/** Duração padrão de imagens e textos inseridos: 5 s. */
export const DEFAULT_STILL_SECONDS = 5;

export function createMediaClipFromAsset(
  asset: MediaAsset,
  trackId: string,
  start: number,
  fps: number,
): VideoClip | AudioClip | ImageClip {
  const base = {
    id: createId('clp_'),
    trackId,
    name: asset.name,
    start: Math.max(0, Math.round(start)),
    keyframes: {},
  };
  if (asset.kind === 'image') {
    return { ...base, ...defaultVisual(), type: 'image', assetId: asset.id, duration: secondsToFrames(DEFAULT_STILL_SECONDS, fps) };
  }
  const duration = Math.max(1, Math.floor(asset.duration * fps + 1e-6));
  const media = { assetId: asset.id, sourceIn: 0, speed: 1, reverse: false, freeze: false, duration };
  if (asset.kind === 'audio') {
    return { ...base, ...media, type: 'audio', audio: { ...DEFAULT_AUDIO } };
  }
  return { ...base, ...media, ...defaultVisual(), type: 'video', audio: { ...DEFAULT_AUDIO, muted: !asset.hasAudio } };
}

export function createTextClip(trackId: string, start: number, duration: number, style?: Partial<TextStyle>): TextClip {
  const text = { ...defaultTextStyle(), ...style };
  return {
    id: createId('clp_'),
    type: 'text',
    trackId,
    name: text.content.slice(0, 32) || 'Texto',
    start: Math.max(0, Math.round(start)),
    duration: Math.max(1, Math.round(duration)),
    keyframes: {},
    ...defaultVisual(),
    text,
  };
}

export function createCaptionClip(
  trackId: string,
  start: number,
  duration: number,
  content: string,
  words: CaptionWord[] = [],
  style?: Partial<TextStyle>,
  projectHeight = 1080,
): CaptionClip {
  const text: TextStyle = {
    ...defaultTextStyle(content),
    fontSize: Math.round(projectHeight * 0.05),
    fontWeight: 800,
    stroke: { enabled: true, color: '#101014', width: Math.max(2, Math.round(projectHeight * 0.004)) },
    shadow: { enabled: false, color: 'rgba(0,0,0,0.6)', blur: 8, x: 0, y: 2 },
    ...style,
  };
  const visual = defaultVisual();
  visual.transform.y = Math.round(projectHeight * 0.33);
  return {
    id: createId('clp_'),
    type: 'caption',
    trackId,
    name: content.slice(0, 32),
    start: Math.max(0, Math.round(start)),
    duration: Math.max(1, Math.round(duration)),
    keyframes: {},
    ...visual,
    text,
    words,
    caption: { highlightWords: false, highlightColor: '#8257FF', wordByWord: false },
  };
}

export function createAdjustmentClip(trackId: string, start: number, duration: number): AdjustmentClip {
  const v = defaultVisual();
  return {
    id: createId('clp_'),
    type: 'adjustment',
    trackId,
    name: 'Ajuste',
    start: Math.max(0, Math.round(start)),
    duration: Math.max(1, Math.round(duration)),
    keyframes: {},
    effects: v.effects,
    color: v.color,
    opacity: 1,
  };
}
