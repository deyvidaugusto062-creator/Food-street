import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  Expand,
  Grid3x3,
  Pause,
  Play,
  Ruler as RulerIcon,
  ScanLine,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { IconButton, Select, Spinner, cx } from '@framestudio/ui';
import { formatTimecode, type Clip } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import type { LayerBox } from '@framestudio/render-engine';
import { useEditor } from '../../state/editor.ts';
import { useSettings, type PreviewQuality } from '../../services/settings.ts';
import { preview, QUALITY_SCALE } from '../../preview/engine.ts';
import * as A from '../../lib/actions.ts';
import { setAnimatables, valueAt } from '../../lib/animate.ts';
import { dragState } from '../../lib/dnd.ts';

type Zoom = 'fit' | '0.5' | '1' | '2';

type Gesture =
  | { kind: 'move'; clip: Clip; startX: number; startY: number; x0: number; y0: number }
  | { kind: 'scale'; clip: Clip; box: LayerBox; d0: number; s0: number }
  | { kind: 'rotate'; clip: Clip; box: LayerBox; a0: number; r0: number };

export function PreviewPanel({ compact = false }: { compact?: boolean }) {
  const project = useEditor((s) => s.project)!;
  const playing = useEditor((s) => s.playing);
  const selection = useEditor((s) => s.selection);
  const quality = useSettings((s) => s.previewQuality);
  const showSafe = useSettings((s) => s.showSafeArea);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [grid, setGrid] = useState(false);
  const [guides, setGuides] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [boxes, setBoxes] = useState<LayerBox[]>([]);
  const [snapGuide, setSnapGuide] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [editing, setEditing] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const PW = project.settings.width;
  const PH = project.settings.height;

  useEffect(() => {
    if (canvasRef.current) preview.attach(canvasRef.current);
    preview.onRendered = () => {
      if (!preview.playing) setBoxes([...preview.compositor.lastBoxes]);
    };
    return () => {
      preview.onRendered = () => {};
      preview.detach();
    };
  }, []);

  useEffect(() => preview.setQuality(QUALITY_SCALE[quality]), [quality]);
  useEffect(() => preview.setVolume(muted ? 0 : volume), [muted, volume]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tamanho exibido do quadro.
  const fitK = Math.min((box.w - 16) / PW, (box.h - 16) / PH);
  const k = zoom === 'fit' ? Math.max(0.01, fitK) : Number(zoom);
  const dispW = Math.max(1, Math.round(PW * k));
  const dispH = Math.max(1, Math.round(PH * k));

  // Edição de texto direto no preview.
  useEffect(() => {
    preview.hideClipIds = new Set(editing ? [editing] : []);
    A.seek(useEditor.getState().playhead);
  }, [editing]);

  const toProject = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * PW, y: ((e.clientY - r.top) / r.height) * PH };
    },
    [PW, PH],
  );

  const hit = (pt: { x: number; y: number }): LayerBox | undefined => {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i]!;
      const a = (-b.rotation * Math.PI) / 180;
      const dx = pt.x - b.cx;
      const dy = pt.y - b.cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= Math.abs(b.width) / 2 && Math.abs(ly) <= Math.abs(b.height) / 2) {
        const track = project.tracks.find((t) => t.id === project.clips[b.clipId]?.trackId);
        if (!track?.locked) return b;
      }
    }
    return undefined;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (playing || e.button !== 0) return;
    const pt = toProject(e);
    const b = hit(pt);
    if (!b) {
      useEditor.getState().select([]);
      return;
    }
    const clip = project.clips[b.clipId]!;
    useEditor.getState().select([clip.id], e.shiftKey ? 'toggle' : 'replace');
    const f = useEditor.getState().playhead;
    gesture.current = { kind: 'move', clip, startX: pt.x, startY: pt.y, x0: valueAt(clip, 'x', f), y0: valueAt(clip, 'y', f) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: React.PointerEvent, b: LayerBox, kind: 'scale' | 'rotate') => {
    e.stopPropagation();
    const clip = project.clips[b.clipId]!;
    const pt = toProject(e);
    const f = useEditor.getState().playhead;
    if (kind === 'scale') gesture.current = { kind, clip, box: b, d0: Math.hypot(pt.x - b.cx, pt.y - b.cy), s0: valueAt(clip, 'scale', f) };
    else gesture.current = { kind, clip, box: b, a0: Math.atan2(pt.y - b.cy, pt.x - b.cx), r0: valueAt(clip, 'rotation', f) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const pt = toProject(e);
    const clip = useEditor.getState().project?.clips[g.clip.id];
    if (!clip) return;
    if (g.kind === 'move') {
      let x = Math.round(g.x0 + pt.x - g.startX);
      let y = Math.round(g.y0 + pt.y - g.startY);
      const thr = 8 / k;
      const v = !e.shiftKey && Math.abs(x) < thr;
      const h = !e.shiftKey && Math.abs(y) < thr;
      if (v) x = 0;
      if (h) y = 0;
      setSnapGuide({ v, h });
      setAnimatables(clip, { x, y }, `pv-move:${clip.id}`);
    } else if (g.kind === 'scale') {
      const d = Math.hypot(pt.x - g.box.cx, pt.y - g.box.cy);
      const s = Math.max(0.02, Math.round(((g.s0 * d) / Math.max(1, g.d0)) * 1000) / 1000);
      setAnimatables(clip, { scale: s }, `pv-scale:${clip.id}`);
    } else {
      const a = Math.atan2(pt.y - g.box.cy, pt.x - g.box.cx);
      let r = g.r0 + ((a - g.a0) * 180) / Math.PI;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      setAnimatables(clip, { rotation: Math.round(r * 10) / 10 }, `pv-rot:${clip.id}`);
    }
  };

  const onPointerUp = () => {
    if (gesture.current) useEditor.getState().seal();
    gesture.current = null;
    setSnapGuide({ v: false, h: false });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const b = hit(toProject(e));
    if (!b) return;
    const c = project.clips[b.clipId];
    if (c && (c.type === 'text' || c.type === 'caption')) setEditing(c.id);
  };

  const togglePlay = async () => {
    if (!useEditor.getState().playing) {
      setPreparing(true);
      const t = setTimeout(() => setPreparing(false), 15000);
      await A.play();
      clearTimeout(t);
      setPreparing(false);
    } else A.pause();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragState.kind === 'asset' && dragState.payload) A.addAsset(dragState.payload);
    else if (dragState.kind === 'text' && dragState.payload) A.addText(JSON.parse(dragState.payload));
    else if (dragState.kind === 'effect' && dragState.payload && selection.length) useEditor.getState().dispatch({ type: 'effect.add', clipIds: selection, effect: dragState.payload as never });
    dragState.kind = null;
  };

  const selectedBoxes = playing ? [] : boxes.filter((b) => selection.includes(b.clipId));
  const editingClip = editing ? project.clips[editing] : undefined;
  const editingBox = editing ? boxes.find((b) => b.clipId === editing) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div
        ref={wrapRef}
        className={cx('relative flex min-h-0 flex-1 items-center justify-center', zoom === 'fit' ? 'overflow-hidden' : 'overflow-auto')}
        onDragOver={(e) => dragState.kind && e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="relative shrink-0 shadow-2xl" style={{ width: dispW, height: dispH }}>
          <canvas ref={canvasRef} className="fs-checker block h-full w-full" data-testid="preview-canvas" style={{ width: dispW, height: dispH }} />
          <div
            className="absolute inset-0 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            data-testid="preview-overlay"
          >
            {grid && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                {[1, 2].map((i) => (
                  <g key={i} stroke="rgba(255,255,255,0.35)" strokeWidth="1">
                    <line x1={(dispW * i) / 3} y1={0} x2={(dispW * i) / 3} y2={dispH} />
                    <line x1={0} y1={(dispH * i) / 3} x2={dispW} y2={(dispH * i) / 3} />
                  </g>
                ))}
              </svg>
            )}
            {showSafe && (
              <>
                <div className="pointer-events-none absolute border border-dashed border-warning/60" style={{ inset: '5%' }} title="Área de ação" />
                <div className="pointer-events-none absolute border border-dashed border-blue/60" style={{ inset: '10%' }} title="Área segura de títulos" />
              </>
            )}
            {guides && snapGuide.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-accent" />}
            {guides && snapGuide.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-accent" />}
            {selectedBoxes.map((b) => (
              <div
                key={b.clipId}
                className="pointer-events-none absolute border border-accent"
                style={{
                  left: (b.cx - Math.abs(b.width) / 2) * k,
                  top: (b.cy - Math.abs(b.height) / 2) * k,
                  width: Math.abs(b.width) * k,
                  height: Math.abs(b.height) * k,
                  transform: `rotate(${b.rotation}deg)`,
                }}
              >
                {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                  <div
                    key={c}
                    className="pointer-events-auto absolute size-3 cursor-nwse-resize rounded-sm border-2 border-accent bg-white"
                    style={{ [c[0] === 't' ? 'top' : 'bottom']: -6, [c[1] === 'l' ? 'left' : 'right']: -6 }}
                    onPointerDown={(e) => onHandleDown(e, b, 'scale')}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    data-testid="handle-scale"
                  />
                ))}
                <div
                  className="pointer-events-auto absolute left-1/2 -top-7 size-3.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-accent bg-white"
                  onPointerDown={(e) => onHandleDown(e, b, 'rotate')}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  title="Girar (Shift: passos de 15°)"
                />
              </div>
            ))}
            {editingClip && (editingClip.type === 'text' || editingClip.type === 'caption') && editingBox && (
              <InlineTextEditor clip={editingClip} box={editingBox} k={k} onDone={() => setEditing(null)} />
            )}
          </div>
        </div>
        {preparing && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white">
            <Spinner size={12} /> Preparando áudio…
          </div>
        )}
      </div>
      <Transport compact={compact} playing={playing} onToggle={togglePlay}>
        {!compact && (
          <div className="flex items-center gap-1">
            <IconButton label={muted ? 'Ativar som' : 'Silenciar'} size="sm" onClick={() => setMuted(!muted)}>
              {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </IconButton>
            <input type="range" className="fs-range w-20" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume do preview" />
            <div className="mx-1 h-5 w-px bg-line" />
            <IconButton label="Grade (terços)" size="sm" active={grid} onClick={() => setGrid(!grid)}>
              <Grid3x3 size={15} />
            </IconButton>
            <IconButton label="Guias magnéticas" size="sm" active={guides} onClick={() => setGuides(!guides)}>
              <RulerIcon size={15} />
            </IconButton>
            <IconButton label="Área segura" size="sm" active={showSafe} onClick={() => useSettings.getState().set({ showSafeArea: !showSafe })}>
              <ScanLine size={15} />
            </IconButton>
            <Select<Zoom>
              value={zoom}
              onChange={setZoom}
              ariaLabel="Zoom do preview"
              className="h-7 w-20 text-xs"
              options={[
                { value: 'fit', label: 'Ajustar' },
                { value: '0.5', label: '50%' },
                { value: '1', label: '100%' },
                { value: '2', label: '200%' },
              ]}
            />
            <Select<PreviewQuality>
              value={quality}
              onChange={(previewQuality) => useSettings.getState().set({ previewQuality })}
              ariaLabel="Qualidade do preview"
              className="h-7 w-28 text-xs"
              options={[
                { value: 'high', label: 'Alta' },
                { value: 'balanced', label: 'Equilibrada' },
                { value: 'performance', label: 'Desempenho' },
              ]}
            />
            <IconButton label="Tela cheia" size="sm" onClick={() => void wrapRef.current?.requestFullscreen?.()}>
              <Expand size={15} />
            </IconButton>
          </div>
        )}
      </Transport>
    </div>
  );
}

function Transport({ playing, onToggle, compact, children }: { playing: boolean; onToggle: () => void; compact: boolean; children?: React.ReactNode }) {
  const project = useEditor((s) => s.project)!;
  const playhead = useEditor((s) => s.playhead);
  const fps = project.settings.fps;
  return (
    <div className={cx('flex shrink-0 items-center gap-2 border-t border-line bg-panel px-2', compact ? 'h-11' : 'h-12')}>
      <span className="w-[92px] font-mono text-xs tabular-nums text-fg" data-testid="timecode">
        {formatTimecode(playhead, fps)}
      </span>
      <div className="flex flex-1 items-center justify-center gap-1">
        {!compact && (
          <IconButton label="Início" shortcut="Home" size="sm" onClick={A.seekToStart}>
            <ChevronFirst size={16} />
          </IconButton>
        )}
        <IconButton label="Quadro anterior" shortcut="←" size="sm" onClick={() => A.step(-1)}>
          <SkipBack size={15} />
        </IconButton>
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
          data-testid="play-toggle"
          className="flex size-9 items-center justify-center rounded-full bg-fg text-bg transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="translate-x-px" />}
        </button>
        <IconButton label="Próximo quadro" shortcut="→" size="sm" onClick={() => A.step(1)}>
          <SkipForward size={15} />
        </IconButton>
        {!compact && (
          <IconButton label="Fim" shortcut="End" size="sm" onClick={A.seekToEnd}>
            <ChevronLast size={16} />
          </IconButton>
        )}
      </div>
      <span className="hidden w-[92px] text-right font-mono text-xs tabular-nums text-fg-subtle sm:inline">{formatTimecode(projectDuration(project), fps)}</span>
      {children}
    </div>
  );
}

function InlineTextEditor({ clip, box, k, onDone }: { clip: Extract<Clip, { type: 'text' | 'caption' }>; box: LayerBox; k: number; onDone: () => void }) {
  const [value, setValue] = useState(clip.text.content);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    if (value !== clip.text.content) useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { text: { content: value } } });
    onDone();
  };
  const w = Math.max(160, Math.abs(box.width) * k);
  const h = Math.max(48, Math.abs(box.height) * k);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onDone();
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Editar texto"
      className="absolute resize-none rounded border-2 border-accent bg-black/60 p-1 text-center text-white outline-none"
      style={{
        left: box.cx * k - w / 2,
        top: box.cy * k - h / 2,
        width: w,
        height: h,
        fontFamily: clip.text.fontFamily,
        fontWeight: clip.text.fontWeight,
        fontSize: Math.max(12, clip.text.fontSize * k * 0.9),
        lineHeight: clip.text.lineHeight,
        textAlign: clip.text.align,
        color: clip.text.color,
      }}
    />
  );
}
