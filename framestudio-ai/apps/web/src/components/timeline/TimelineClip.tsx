import { memo } from 'react';
import { AudioLines, Gauge, Image as ImageIcon, Link2, Rewind, Snowflake, Sparkles, Subtitles, Type, VolumeX } from 'lucide-react';
import { ContextMenu, cx, type MenuItem } from '@framestudio/ui';
import type { Clip, Project } from '@framestudio/shared';
import { useMediaCache } from '../../services/media.ts';
import { useEditor } from '../../state/editor.ts';
import * as A from '../../lib/actions.ts';
import { ThumbStrip } from './ThumbStrip.tsx';
import { Waveform } from './Waveform.tsx';
import type { DragVisual } from './Timeline.tsx';

const TYPE_BG: Record<Clip['type'], string> = {
  video: 'bg-clip-video',
  image: 'bg-clip-video',
  audio: 'bg-clip-audio',
  text: 'bg-clip-text',
  caption: 'bg-clip-caption',
  adjustment: 'bg-panel-3',
};

export const TimelineClip = memo(function TimelineClip({
  clip,
  project,
  ppf,
  height,
  selected,
  locked,
  offset,
  onPointerDown,
}: {
  clip: Clip;
  project: Project;
  ppf: number;
  height: number;
  selected: boolean;
  locked: boolean;
  offset: DragVisual | null;
  onPointerDown: (e: React.PointerEvent, clip: Clip, zone: 'body' | 'start' | 'end') => void;
}) {
  const fps = project.settings.fps;
  const asset = 'assetId' in clip ? project.assets[clip.assetId] : undefined;
  const thumbs = useMediaCache((s) => (asset ? s.thumbs[asset.id] : undefined));
  const peaks = useMediaCache((s) => (asset ? s.peaks[asset.id] : undefined));
  const left = clip.start * ppf;
  const width = Math.max(2, clip.duration * ppf);
  const isMedia = clip.type === 'video' || clip.type === 'audio';
  const srcFrom = isMedia ? clip.sourceIn : 0;
  const srcTo = isMedia ? clip.sourceIn + (clip.duration / fps) * clip.speed : 0;
  const kfFrames = selected ? [...new Set(Object.values(clip.keyframes).flatMap((l) => (l ?? []).map((k) => k.frame)))] : [];
  const showWave = !!peaks && asset && (clip.type === 'audio' || (clip.type === 'video' && !clip.audio.muted));
  const waveH = clip.type === 'audio' ? height - 20 : Math.min(18, height * 0.3);
  const missing = asset === undefined && 'assetId' in clip;

  const sel = useEditor.getState;
  const items: MenuItem[] = [
    { label: 'Dividir no playhead', shortcut: 'S', onSelect: A.splitAtPlayhead },
    { label: 'Duplicar', shortcut: 'Ctrl+D', onSelect: A.duplicateSelection },
    { label: 'Copiar', shortcut: 'Ctrl+C', onSelect: () => A.copySelection() },
    { label: 'Recortar', shortcut: 'Ctrl+X', onSelect: A.cutSelection },
    { separator: true, label: '' },
    { label: 'Copiar atributos', onSelect: A.copyAttributes },
    { label: 'Colar atributos', disabled: !sel().attributeClipboard, onSelect: () => A.pasteAttributes() },
    { separator: true, label: '' },
    ...(clip.type === 'video'
      ? [
          { label: 'Separar áudio', onSelect: A.detachAudio, disabled: !asset?.hasAudio || clip.audio.muted },
          { label: 'Congelar frame (2 s)', onSelect: () => A.freezeFrame(2) },
        ]
      : []),
    { label: 'Adicionar transição ao corte', onSelect: () => A.addTransitionToSelection('dissolve') },
    { label: 'Agrupar', shortcut: 'Ctrl+G', disabled: sel().selection.length < 2, onSelect: A.groupSelection },
    { label: 'Desagrupar', shortcut: 'Ctrl+Shift+G', disabled: !clip.groupId, onSelect: A.ungroupSelection },
    { separator: true, label: '' },
    { label: 'Excluir', shortcut: 'Delete', danger: true, onSelect: () => A.deleteSelection(false) },
    { label: 'Excluir e fechar espaço', shortcut: 'Shift+Delete', danger: true, onSelect: () => A.deleteSelection(true) },
  ];

  return (
    <ContextMenu items={items}>
      <div
        data-testid="clip"
        data-clip-id={clip.id}
        data-clip-type={clip.type}
        className={cx(
          'group absolute top-[3px] overflow-hidden rounded-md text-white select-none',
          TYPE_BG[clip.type],
          selected ? 'z-10 ring-2 ring-white shadow-[0_0_0_4px_rgba(130,87,255,0.45)]' : 'ring-1 ring-black/30 hover:ring-white/40',
          offset && 'z-30 opacity-80 shadow-2xl',
          locked ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing',
          missing && 'bg-danger/50',
        )}
        style={{
          left,
          width,
          height: height - 6,
          transform: offset ? `translate(${offset.dFrames * ppf}px, ${offset.dy}px)` : undefined,
        }}
        onPointerDown={(e) => onPointerDown(e, clip, 'body')}
        title={`${clip.name} — ${(clip.duration / fps).toFixed(2)} s`}
      >
        {(clip.type === 'video' || clip.type === 'image') && thumbs && asset && (
          <ThumbStrip thumbs={thumbs} aspect={(asset.width ?? 16) / (asset.height ?? 9)} width={width} height={height - 6} from={srcFrom} to={clip.type === 'video' ? srcTo : 0} duration={asset.duration} />
        )}
        {showWave && (
          <div className={cx('pointer-events-none absolute inset-x-0 bottom-0', clip.type === 'video' && 'bg-black/40')} style={{ height: waveH }}>
            <Waveform peaks={peaks!} duration={asset!.duration} from={srcFrom} to={srcTo} width={width} height={waveH} reverse={isMedia && clip.reverse} color={clip.type === 'audio' ? 'rgba(180,255,240,0.85)' : 'rgba(255,255,255,0.7)'} />
          </div>
        )}
        <div className="pointer-events-none relative flex h-5 items-center gap-1 bg-gradient-to-b from-black/50 to-transparent px-1.5 text-[10px] font-medium">
          {clip.type === 'text' && <Type size={10} />}
          {clip.type === 'caption' && <Subtitles size={10} />}
          {clip.type === 'image' && <ImageIcon size={10} />}
          {clip.type === 'audio' && <AudioLines size={10} />}
          {clip.groupId && <Link2 size={10} />}
          <span className="truncate">{clip.type === 'text' || clip.type === 'caption' ? clip.text.content : clip.name}</span>
          {isMedia && clip.speed !== 1 && (
            <span className="flex items-center gap-0.5 rounded bg-black/40 px-1">
              <Gauge size={9} />
              {clip.speed}x
            </span>
          )}
          {isMedia && clip.reverse && <Rewind size={10} />}
          {isMedia && clip.freeze && <Snowflake size={10} />}
          {'effects' in clip && clip.effects.length > 0 && <Sparkles size={10} />}
          {'audio' in clip && clip.audio.muted && clip.type === 'video' && asset?.hasAudio && <VolumeX size={10} />}
        </div>
        {kfFrames.map((f) => (
          <div key={f} className="pointer-events-none absolute bottom-1 h-2 w-2 -translate-x-1/2 rotate-45 border border-black/40 bg-warning" style={{ left: f * ppf }} />
        ))}
        {!locked && (
          <>
            <div
              className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-white/0 transition-colors hover:bg-white/40 group-hover:bg-white/15"
              onPointerDown={(e) => onPointerDown(e, clip, 'start')}
              data-testid="trim-start"
            />
            <div
              className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-white/0 transition-colors hover:bg-white/40 group-hover:bg-white/15"
              onPointerDown={(e) => onPointerDown(e, clip, 'end')}
              data-testid="trim-end"
            />
          </>
        )}
      </div>
    </ContextMenu>
  );
});
