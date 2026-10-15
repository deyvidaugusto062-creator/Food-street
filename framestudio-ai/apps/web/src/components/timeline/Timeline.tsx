import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Flag,
  Lock,
  LockOpen,
  Magnet,
  Maximize2,
  Plus,
  Redo2,
  Scissors,
  SplitSquareHorizontal,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ContextMenu, DropdownMenu, IconButton, Tooltip, cx, toast, type MenuItem } from '@framestudio/ui';
import { formatTimecode, type Clip, type Project, type Track, type TrackKind } from '@framestudio/shared';
import { clipEnd, collectSnapPoints, getTrackClips, projectDuration, snapFrame, snapRange, trackAccepts } from '@framestudio/timeline';
import { useEditor } from '../../state/editor.ts';
import { useSettings } from '../../services/settings.ts';
import * as A from '../../lib/actions.ts';
import { dragState } from '../../lib/dnd.ts';
import { TimelineClip } from './TimelineClip.tsx';

export const HEADER_W = 168;
const RULER_H = 28;
const SNAP_PX = 8;

type Drag =
  | { kind: 'move'; ids: string[]; startX: number; startY: number; primary: string; originTrack: string; moved: boolean; additive: boolean }
  | { kind: 'trim'; id: string; edge: 'start' | 'end'; startX: number; orig: number; ripple: boolean }
  | { kind: 'slip'; id: string; startX: number; applied: number }
  | { kind: 'marquee'; x0: number; y0: number; additive: boolean; moved: boolean }
  | { kind: 'scrub' }
  | { kind: 'marker'; id: string; startX: number; orig: number };

export interface DragVisual {
  ids: Set<string>;
  dFrames: number;
  dy: number;
}

export function Timeline({ compact = false }: { compact?: boolean }) {
  const project = useEditor((s) => s.project)!;
  const pps = useEditor((s) => s.pxPerSecond);
  const selection = useEditor((s) => s.selection);
  const selectedTransition = useEditor((s) => s.selectedTransition);
  const ripple = useEditor((s) => s.ripple);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const snapping = useSettings((s) => s.snapping);
  const fps = project.settings.fps;
  const ppf = pps / fps;
  const headerW = compact ? 76 : HEADER_W;
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [visual, setVisual] = useState<DragVisual | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<{ trackId: string; frame: number } | null>(null);
  const [viewportW, setViewportW] = useState(800);
  const selSet = useMemo(() => new Set(selection), [selection]);

  const duration = projectDuration(project);
  const contentW = Math.max(viewportW - headerW, (duration + fps * 30) * ppf);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    ro.observe(el);
    setViewportW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Posições verticais das faixas.
  const rows = useMemo(() => {
    let y = 0;
    return project.tracks.map((t) => {
      const r = { track: t, top: y, height: compact ? Math.min(t.height, 48) : t.height };
      y += r.height;
      return r;
    });
  }, [project.tracks, compact]);
  const tracksH = rows.reduce((a, r) => a + r.height, 0);

  const toFrame = useCallback(
    (clientX: number) => {
      const rect = content.current!.getBoundingClientRect();
      return Math.max(0, (clientX - rect.left - headerW) / ppf);
    },
    [ppf, headerW],
  );
  const rowAt = useCallback(
    (clientY: number) => {
      const rect = content.current!.getBoundingClientRect();
      const y = clientY - rect.top - RULER_H;
      return rows.find((r) => y >= r.top && y < r.top + r.height) ?? null;
    },
    [rows],
  );

  // Zoom com Ctrl/⌘ + roda, mantendo o ponto sob o cursor.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const s = useEditor.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - headerW;
      const frameAt = (el.scrollLeft + cursorX) / (s.pxPerSecond / fps);
      const next = s.pxPerSecond * Math.exp(-e.deltaY * 0.0025);
      s.setZoom(next);
      requestAnimationFrame(() => {
        const ppf2 = useEditor.getState().pxPerSecond / fps;
        el.scrollLeft = Math.max(0, frameAt * ppf2 - cursorX);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fps, headerW]);

  // Gesto de pinça (touch) para zoom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const pts = new Map<number, number>();
    let startDist = 0;
    let startZoom = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        startDist = Math.abs(a! - b!);
        startZoom = useEditor.getState().pxPerSecond;
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2 && startDist > 10) {
        const [a, b] = [...pts.values()];
        useEditor.getState().setZoom((startZoom * Math.abs(a! - b!)) / startDist);
      }
    };
    const up = (e: PointerEvent) => pts.delete(e.pointerId);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, []);

  // Acompanha o playhead durante a reprodução.
  useEffect(
    () =>
      useEditor.subscribe((s, prev) => {
        if (!s.playing || s.playhead === prev.playhead) return;
        const el = scroller.current;
        if (!el) return;
        const x = s.playhead * (s.pxPerSecond / fps);
        const visible = el.clientWidth - headerW;
        if (x < el.scrollLeft || x > el.scrollLeft + visible - 60) el.scrollLeft = Math.max(0, x - 60);
      }),
    [fps, headerW],
  );

  const snapPoints = useCallback(
    (exclude: Set<string>) => (snapping ? collectSnapPoints(useEditor.getState().project!, exclude, Math.round(useEditor.getState().playhead)) : []),
    [snapping],
  );

  // ─────────────────────────── Ponteiro ───────────────────────────

  const onClipPointerDown = (e: React.PointerEvent, clip: Clip, zone: 'body' | 'start' | 'end') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = useEditor.getState();
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (zone !== 'body') {
      if (track?.locked) return;
      drag.current = { kind: 'trim', id: clip.id, edge: zone, startX: e.clientX, orig: zone === 'start' ? clip.start : clipEnd(clip), ripple: s.ripple || e.altKey };
      if (!selSet.has(clip.id)) s.select([clip.id]);
    } else {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      let ids = s.selection;
      if (additive) {
        s.select([clip.id], 'toggle');
        ids = useEditor.getState().selection;
      } else if (!selSet.has(clip.id)) {
        s.select([clip.id]);
        ids = useEditor.getState().selection;
      }
      if (track?.locked) return;
      if (e.altKey && (e.ctrlKey || e.metaKey) && (clip.type === 'video' || clip.type === 'audio')) {
        drag.current = { kind: 'slip', id: clip.id, startX: e.clientX, applied: 0 };
      } else {
        drag.current = { kind: 'move', ids: ids.includes(clip.id) ? ids : [clip.id], startX: e.clientX, startY: e.clientY, primary: clip.id, originTrack: clip.trackId, moved: false, additive };
      }
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLanePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.pointerType === 'touch' && e.isPrimary === false)) return;
    const rect = content.current!.getBoundingClientRect();
    drag.current = { kind: 'marquee', x0: e.clientX - rect.left, y0: e.clientY - rect.top, additive: e.shiftKey, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onRulerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { kind: 'scrub' };
    A.seek(Math.round(toFrame(e.clientX)));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const s = useEditor.getState();
    const p = s.project!;
    switch (d.kind) {
      case 'scrub': {
        const f = Math.round(toFrame(e.clientX));
        if (s.playing) A.pause();
        s.setPlayhead(f);
        return;
      }
      case 'marker': {
        const f = Math.max(0, Math.round(d.orig + (e.clientX - d.startX) / ppf));
        s.dispatch({ type: 'marker.update', markerId: d.id, patch: { frame: f } }, { coalesce: `marker:${d.id}`, silent: true });
        return;
      }
      case 'move': {
        const dx = e.clientX - d.startX;
        const dyPx = e.clientY - d.startY;
        if (!d.moved && Math.hypot(dx, dyPx) < 4) return;
        d.moved = true;
        const primary = p.clips[d.primary]!;
        const moving = d.ids.map((id) => p.clips[id]).filter((c): c is Clip => !!c);
        let dFrames = Math.round(dx / ppf);
        let snapTo: number | null = null;
        if (snapping && !e.shiftKey) {
          const r = snapRange(primary.start + dFrames, primary.duration, snapPoints(new Set(d.ids)), SNAP_PX / ppf);
          if (r.snappedTo !== null) {
            dFrames = r.start - primary.start;
            snapTo = r.snappedTo;
          }
        }
        const minStart = Math.min(...moving.map((c) => c.start));
        dFrames = Math.max(-minStart, dFrames);
        let dy = 0;
        const sameTrack = moving.every((c) => c.trackId === d.originTrack);
        const row = sameTrack ? rowAt(e.clientY) : null;
        if (row && row.track.id !== d.originTrack && moving.every((c) => trackAccepts(row.track.kind, c))) {
          const origin = rows.find((r) => r.track.id === d.originTrack)!;
          dy = row.top - origin.top;
        }
        setSnapLine(snapTo);
        setVisual({ ids: new Set(d.ids), dFrames, dy });
        return;
      }
      case 'trim': {
        let f = Math.round(d.orig + (e.clientX - d.startX) / ppf);
        if (snapping && !e.shiftKey) {
          const sn = snapFrame(f, snapPoints(new Set([d.id])), SNAP_PX / ppf);
          if (sn !== null) f = sn;
          setSnapLine(sn);
        }
        s.dispatch({ type: 'clip.trim', clipId: d.id, edge: d.edge, frame: f, ripple: d.ripple }, { coalesce: `trim:${d.id}:${d.edge}`, silent: true });
        if (d.edge === 'end') s.setPlayhead(Math.max(0, f - 1));
        else s.setPlayhead(f);
        return;
      }
      case 'slip': {
        const sec = ((e.clientX - d.startX) / ppf / fps) * -1;
        const delta = sec - d.applied;
        if (Math.abs(delta) > 1e-4) {
          s.dispatch({ type: 'clip.slip', clipId: d.id, deltaSeconds: delta }, { coalesce: `slip:${d.id}`, silent: true });
          d.applied = sec;
        }
        return;
      }
      case 'marquee': {
        const rect = content.current!.getBoundingClientRect();
        const x1 = e.clientX - rect.left;
        const y1 = e.clientY - rect.top;
        if (!d.moved && Math.hypot(x1 - d.x0, y1 - d.y0) < 4) return;
        d.moved = true;
        const box = { x: Math.min(d.x0, x1), y: Math.min(d.y0, y1), w: Math.abs(x1 - d.x0), h: Math.abs(y1 - d.y0) };
        setMarquee(box);
        const f0 = (box.x - headerW) / ppf;
        const f1 = (box.x + box.w - headerW) / ppf;
        const ids: string[] = [];
        for (const r of rows) {
          const top = r.top + RULER_H;
          if (top + r.height < box.y || top > box.y + box.h) continue;
          for (const c of getTrackClips(p, r.track.id)) if (c.start < f1 && clipEnd(c) > f0) ids.push(c.id);
        }
        s.select(ids, d.additive ? 'add' : 'replace');
        return;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setSnapLine(null);
    if (!d) return;
    const s = useEditor.getState();
    if (d.kind === 'move') {
      const v = visual;
      setVisual(null);
      if (d.moved && v) {
        let target: string | undefined;
        if (v.dy !== 0) target = rowAt(e.clientY)?.track.id;
        if (v.dFrames !== 0 || target) s.dispatch({ type: 'clip.move', clipIds: d.ids, delta: v.dFrames, trackId: target });
      } else if (!d.moved && !d.additive) {
        s.select([d.primary]);
      }
    } else if (d.kind === 'trim' || d.kind === 'slip' || d.kind === 'marker') {
      s.seal();
    } else if (d.kind === 'marquee') {
      setMarquee(null);
      if (!d.moved) {
        if (!d.additive) s.select([]);
        A.seek(Math.round(toFrame(e.clientX)));
      }
    }
  };

  // ─────────────────────────── Soltar da biblioteca ───────────────────────────

  const onDragOver = (e: React.DragEvent) => {
    if (!dragState.kind) return;
    const row = rowAt(e.clientY);
    if (!row) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    let f = Math.round(toFrame(e.clientX));
    if (snapping && dragState.kind === 'asset') {
      const sn = snapFrame(f, snapPoints(new Set()), SNAP_PX / ppf);
      if (sn !== null) f = sn;
    }
    setDropHint({ trackId: row.track.id, frame: f });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const hint = dropHint;
    setDropHint(null);
    const kind = dragState.kind;
    const payload = dragState.payload;
    dragState.kind = null;
    if (!kind || !payload || !hint) return;
    const s = useEditor.getState();
    const p = s.project!;
    const track = p.tracks.find((t) => t.id === hint.trackId)!;
    if (kind === 'asset') {
      const asset = p.assets[payload];
      if (!asset) return;
      const type = asset.kind === 'audio' ? 'audio' : asset.kind === 'image' ? 'image' : 'video';
      s.dispatch({ type: 'clip.addAsset', assetId: payload, start: hint.frame, trackId: trackAccepts(track.kind, { type }) ? track.id : undefined }, { select: true });
    } else if (kind === 'text') {
      s.dispatch({ type: 'clip.addText', start: hint.frame, duration: fps * 5, style: JSON.parse(payload), trackId: trackAccepts(track.kind, { type: 'text' }) ? track.id : undefined }, { select: true });
    } else if (kind === 'transition') {
      // Corte mais próximo na faixa.
      const clips = getTrackClips(p, track.id);
      let best: [Clip, Clip] | null = null;
      let bestDist = Infinity;
      for (let i = 1; i < clips.length; i++) {
        const a = clips[i - 1]!;
        const b = clips[i]!;
        if (clipEnd(a) !== b.start) continue;
        const dist = Math.abs(b.start - hint.frame) * ppf;
        if (dist < bestDist) {
          bestDist = dist;
          best = [a, b];
        }
      }
      if (best && bestDist < 60) s.dispatch(A.transitionOp(best[0].id, best[1].id, payload as never, fps));
      else toast({ kind: 'info', title: 'Solte a transição sobre um corte', description: 'Ela precisa ficar entre dois clipes encostados na mesma faixa.' });
    } else if (kind === 'effect') {
      const clip = getTrackClips(p, track.id).find((c) => hint.frame >= c.start && hint.frame < clipEnd(c));
      if (clip && 'effects' in clip) s.dispatch({ type: 'effect.add', clipIds: [clip.id], effect: payload as never });
    }
  };

  // ─────────────────────────── Render ───────────────────────────

  const clipsByTrack = useMemo(() => {
    const m = new Map<string, Clip[]>();
    for (const t of project.tracks) m.set(t.id, []);
    for (const c of Object.values(project.clips)) m.get(c.trackId)?.push(c);
    return m;
  }, [project.clips, project.tracks]);

  const rulerStep = useMemo(() => {
    // Intervalo de marcas em segundos que mantém ~90 px entre rótulos.
    const steps = [1 / fps, 2 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    return steps.find((s) => s * pps >= 90) ?? 600;
  }, [pps, fps]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel" data-testid="timeline">
      {!compact && (
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-2">
          <IconButton label="Desfazer" shortcut="Ctrl+Z" size="sm" disabled={!canUndo} onClick={() => useEditor.getState().undo()}>
            <Undo2 size={15} />
          </IconButton>
          <IconButton label="Refazer" shortcut="Ctrl+Shift+Z" size="sm" disabled={!canRedo} onClick={() => useEditor.getState().redo()}>
            <Redo2 size={15} />
          </IconButton>
          <div className="mx-1 h-5 w-px bg-line" />
          <IconButton label="Dividir no playhead" shortcut="S" size="sm" onClick={A.splitAtPlayhead} data-testid="tl-split">
            <Scissors size={15} />
          </IconButton>
          <IconButton label="Excluir" shortcut="Delete" size="sm" disabled={!selection.length && !selectedTransition} onClick={() => A.deleteSelection()}>
            <Trash2 size={15} />
          </IconButton>
          <IconButton label="Duplicar" shortcut="Ctrl+D" size="sm" disabled={!selection.length} onClick={A.duplicateSelection}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Adicionar marcador" shortcut="M" size="sm" onClick={A.addMarkerAtPlayhead}>
            <Flag size={15} />
          </IconButton>
          <div className="mx-1 h-5 w-px bg-line" />
          <IconButton label="Snap magnético" size="sm" active={snapping} onClick={() => useSettings.getState().set({ snapping: !snapping })}>
            <Magnet size={15} />
          </IconButton>
          <IconButton label="Modo ripple (fecha espaços ao excluir/aparar)" size="sm" active={ripple} onClick={() => useEditor.getState().setRipple(!ripple)}>
            <SplitSquareHorizontal size={15} />
          </IconButton>
          <DropdownMenu
            items={(['video', 'audio', 'text', 'caption'] as TrackKind[]).map((k) => ({
              label: `Faixa de ${k === 'video' ? 'vídeo' : k === 'audio' ? 'áudio' : k === 'text' ? 'texto/overlay' : 'legendas'}`,
              onSelect: () => useEditor.getState().dispatch({ type: 'track.add', kind: k }),
            }))}
          >
            <IconButton label="Adicionar faixa" size="sm" tooltip>
              <Plus size={15} />
            </IconButton>
          </DropdownMenu>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden font-mono text-[11px] text-fg-subtle md:inline">{formatTimecode(duration, fps)}</span>
            <IconButton label="Diminuir zoom" shortcut="-" size="sm" onClick={() => A.zoomBy(1 / 1.4)}>
              <ZoomOut size={15} />
            </IconButton>
            <input
              type="range"
              className="fs-range w-24"
              min={Math.log(4)}
              max={Math.log(1200)}
              step={0.01}
              value={Math.log(pps)}
              onChange={(e) => useEditor.getState().setZoom(Math.exp(Number(e.target.value)))}
              aria-label="Zoom da timeline"
            />
            <IconButton label="Aumentar zoom" shortcut="+" size="sm" onClick={() => A.zoomBy(1.4)}>
              <ZoomIn size={15} />
            </IconButton>
            <IconButton label="Ajustar à janela" size="sm" onClick={() => A.zoomToFit(viewportW - headerW)}>
              <Maximize2 size={14} />
            </IconButton>
          </div>
        </div>
      )}
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={onDragOver}
        onDragLeave={() => setDropHint(null)}
        onDrop={onDrop}
      >
        <div ref={content} className="relative" style={{ width: headerW + contentW, minHeight: '100%' }}>
          {/* Régua */}
          <div className="sticky top-0 z-30 flex" style={{ height: RULER_H }}>
            <div className="sticky left-0 z-40 shrink-0 border-b border-r border-line bg-panel" style={{ width: headerW }} />
            <div className="relative flex-1 cursor-pointer border-b border-line bg-panel" onPointerDown={onRulerPointerDown} data-testid="ruler">
              <Ruler width={contentW} pps={pps} step={rulerStep} fps={fps} />
              {project.markers.map((m) => (
                <MarkerFlag key={m.id} marker={m} x={m.frame * ppf} onDown={(e) => {
                  e.stopPropagation();
                  drag.current = { kind: 'marker', id: m.id, startX: e.clientX, orig: m.frame };
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }} />
              ))}
            </div>
          </div>
          {/* Faixas */}
          {rows.map((r) => (
            <div key={r.track.id} className="relative flex" style={{ height: r.height }} data-track-id={r.track.id} data-track-kind={r.track.kind}>
              <TrackHeader track={r.track} project={project} height={r.height} width={headerW} compact={compact} />
              <div
                className={cx('relative flex-1 border-b border-line/70', r.track.kind === 'audio' ? 'bg-bg/40' : 'bg-bg/20', r.track.hidden && 'opacity-50')}
                onPointerDown={onLanePointerDown}
              >
                {(clipsByTrack.get(r.track.id) ?? []).map((c) => (
                  <TimelineClip
                    key={c.id}
                    clip={c}
                    project={project}
                    ppf={ppf}
                    height={r.height}
                    selected={selSet.has(c.id)}
                    locked={r.track.locked}
                    offset={visual?.ids.has(c.id) ? visual : null}
                    onPointerDown={onClipPointerDown}
                  />
                ))}
                {Object.values(project.transitions)
                  .filter((t) => t.trackId === r.track.id)
                  .map((t) => {
                    const b = project.clips[t.toClipId];
                    if (!b) return null;
                    const x0 = (b.start - Math.floor(t.duration / 2)) * ppf;
                    return (
                      <button
                        key={t.id}
                        className={cx(
                          'absolute bottom-[5px] z-20 h-3.5 rounded border text-[8px] font-semibold leading-none',
                          selectedTransition === t.id ? 'border-white bg-accent text-white' : 'border-accent/70 bg-accent/40 text-white hover:bg-accent/70',
                        )}
                        style={{ left: x0, width: Math.max(10, t.duration * ppf) }}
                        title="Transição — clique para editar"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => useEditor.getState().selectTransition(t.id)}
                        data-testid="transition-chip"
                      >
                        {t.duration * ppf > 40 ? '⧓' : ''}
                      </button>
                    );
                  })}
                {dropHint?.trackId === r.track.id && <div className="pointer-events-none absolute inset-y-1 z-30 w-0.5 rounded bg-blue" style={{ left: dropHint.frame * ppf }} />}
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-6 text-sm text-fg-muted">Adicione uma faixa para começar.</div>}
          {/* Linha de snap */}
          {snapLine !== null && <div className="pointer-events-none absolute z-40 w-px bg-warning" style={{ left: headerW + snapLine * ppf, top: 0, height: RULER_H + tracksH }} />}
          {marquee && <div className="pointer-events-none absolute z-40 border border-accent bg-accent/10" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          <Playhead ppf={ppf} height={RULER_H + tracksH} headerW={headerW} />
        </div>
      </div>
    </div>
  );
}

const Ruler = memo(function Ruler({ width, pps, step, fps }: { width: number; pps: number; step: number; fps: number }) {
  const ticks = [];
  const count = Math.ceil(width / (step * pps)) + 1;
  for (let i = 0; i < Math.min(count, 3000); i++) {
    const t = i * step;
    const x = t * pps;
    ticks.push(
      <div key={i} className="absolute bottom-0 flex h-full flex-col justify-end" style={{ left: x }}>
        <span className="mb-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-fg-subtle">{label(t, step, fps)}</span>
        <div className="h-2 w-px bg-fg-subtle/60" />
      </div>,
    );
    for (let k = 1; k < 5; k++) ticks.push(<div key={`${i}.${k}`} className="absolute bottom-0 h-1 w-px bg-fg-subtle/30" style={{ left: x + (k * step * pps) / 5 }} />);
  }
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{ticks}</div>;
});

function label(t: number, step: number, fps: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  if (step < 1) {
    const f = Math.round((t - Math.floor(t)) * fps);
    return f === 0 ? `${m}:${String(s).padStart(2, '0')}` : `${f}f`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Playhead({ ppf, height, headerW }: { ppf: number; height: number; headerW: number }) {
  const playhead = useEditor((s) => s.playhead);
  return (
    <div className="pointer-events-none absolute top-0 z-50" style={{ left: headerW + playhead * ppf, height }} data-testid="playhead">
      <div className="absolute -left-[6px] top-0 h-3 w-[13px] rounded-b-sm bg-accent" style={{ clipPath: 'polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)' }} />
      <div className="absolute left-0 top-0 h-full w-px bg-accent shadow-[0_0_6px_rgba(130,87,255,0.8)]" />
    </div>
  );
}

function MarkerFlag({ marker, x, onDown }: { marker: Project['markers'][number]; x: number; onDown: (e: React.PointerEvent) => void }) {
  const items: MenuItem[] = [
    {
      label: 'Renomear',
      onSelect: () => {
        const label = prompt('Nome do marcador', marker.label);
        if (label !== null) useEditor.getState().dispatch({ type: 'marker.update', markerId: marker.id, patch: { label } });
      },
    },
    { label: 'Ir para o marcador', onSelect: () => A.seek(marker.frame) },
    { label: 'Excluir marcador', danger: true, onSelect: () => useEditor.getState().dispatch({ type: 'marker.remove', markerId: marker.id }) },
  ];
  return (
    <ContextMenu items={items}>
      <div className="absolute top-0 z-10 -translate-x-1/2 cursor-ew-resize" style={{ left: x }} onPointerDown={onDown} onDoubleClick={() => A.seek(marker.frame)}>
        <Tooltip content={marker.label || 'Marcador'}>
          <div className="h-3 w-3 rotate-45 rounded-[2px] border border-black/30" style={{ background: marker.color }} />
        </Tooltip>
      </div>
    </ContextMenu>
  );
}

function TrackHeader({ track, project, height, width, compact }: { track: Track; project: Project; height: number; width: number; compact: boolean }) {
  const upd = (patch: Partial<Track>) => useEditor.getState().dispatch({ type: 'track.update', trackId: track.id, patch });
  const idx = project.tracks.indexOf(track);
  const items: MenuItem[] = [
    {
      label: 'Renomear faixa',
      onSelect: () => {
        const name = prompt('Nome da faixa', track.name);
        if (name) upd({ name });
      },
    },
    { label: 'Mover para cima', disabled: idx === 0, onSelect: () => useEditor.getState().dispatch({ type: 'track.move', trackId: track.id, toIndex: idx - 1 }) },
    { label: 'Mover para baixo', disabled: idx === project.tracks.length - 1, onSelect: () => useEditor.getState().dispatch({ type: 'track.move', trackId: track.id, toIndex: idx + 1 }) },
    { label: 'Altura maior', onSelect: () => upd({ height: Math.min(140, track.height + 16) }) },
    { label: 'Altura menor', onSelect: () => upd({ height: Math.max(36, track.height - 16) }) },
    { separator: true, label: '' },
    { label: 'Excluir faixa', danger: true, onSelect: () => useEditor.getState().dispatch({ type: 'track.remove', trackId: track.id }) },
  ];
  const kindColor = track.kind === 'audio' ? 'bg-clip-audio' : track.kind === 'text' ? 'bg-clip-text' : track.kind === 'caption' ? 'bg-clip-caption' : 'bg-clip-video';
  return (
    <ContextMenu items={items}>
      <div className="sticky left-0 z-20 flex shrink-0 items-center gap-1 border-b border-r border-line bg-panel pl-2 pr-1" style={{ width, height }}>
        <div className={cx('h-6 w-1 rounded-full', kindColor)} />
        {!compact && (
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fg-muted" title={track.name}>
            {track.name}
          </span>
        )}
        <IconButton label={track.locked ? 'Desbloquear faixa' : 'Bloquear faixa'} size="sm" active={track.locked} onClick={() => upd({ locked: !track.locked })} className="size-6">
          {track.locked ? <Lock size={12} /> : <LockOpen size={12} />}
        </IconButton>
        {track.kind !== 'audio' && (
          <IconButton label={track.hidden ? 'Mostrar faixa' : 'Ocultar faixa'} size="sm" active={track.hidden} onClick={() => upd({ hidden: !track.hidden })} className="size-6">
            {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </IconButton>
        )}
        {(track.kind === 'audio' || track.kind === 'video') && (
          <>
            <IconButton label={track.muted ? 'Ativar som' : 'Silenciar faixa'} size="sm" active={track.muted} onClick={() => upd({ muted: !track.muted })} className="size-6">
              {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </IconButton>
            <IconButton label="Solo" size="sm" active={track.solo} onClick={() => upd({ solo: !track.solo })} className="size-6 text-[10px] font-bold">
              S
            </IconButton>
          </>
        )}
      </div>
    </ContextMenu>
  );
}
