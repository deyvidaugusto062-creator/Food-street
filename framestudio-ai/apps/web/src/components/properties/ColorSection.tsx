import { useEffect, useRef, useState } from 'react';
import { ClipboardCopy, ClipboardPaste, Eye, Save } from 'lucide-react';
import { Button, Section, Select, Slider, toast } from '@framestudio/ui';
import { curveTable } from '@framestudio/render-engine';
import { DEFAULT_COLOR, type AdjustmentClip, type ColorAdjust, type HslBand, type Point, type VisualClip } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { HSL_BANDS } from '../../services/presets.ts';
import { AnimSlider, ResetButton, Segmented, signedPct } from './controls.tsx';
import { useCompare } from '../../state/compare.ts';

type ColorClip = VisualClip | AdjustmentClip;

const upd = (clip: ColorClip, color: Partial<ColorAdjust> | Record<string, unknown>, key: string) =>
  useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { color } }, { coalesce: `color-${key}:${clip.id}` });

const SLIDERS: { key: keyof ColorAdjust; label: string; min: number; max: number; def: number; fmt?: (v: number) => string }[] = [
  { key: 'exposure', label: 'Exposição', min: -3, max: 3, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV` },
  { key: 'brightness', label: 'Brilho', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'contrast', label: 'Contraste', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'saturation', label: 'Saturação', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'vibrance', label: 'Vibrance', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'temperature', label: 'Temperatura', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'tint', label: 'Matiz (tint)', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'hue', label: 'Rotação de matiz', min: -180, max: 180, def: 0, fmt: (v) => `${Math.round(v)}°` },
  { key: 'highlights', label: 'Realces', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'shadows', label: 'Sombras', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'whites', label: 'Brancos', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'blacks', label: 'Pretos', min: -1, max: 1, def: 0, fmt: signedPct },
  { key: 'gamma', label: 'Gamma', min: 0.2, max: 3, def: 1, fmt: (v) => v.toFixed(2) },
];

const USER_PRESETS_KEY = 'fs.colorPresets';

export function ColorSection({ clip }: { clip: ColorClip }) {
  const luts = useEditor((s) => s.project!.luts);
  const compare = useCompare();
  const c = clip.color;
  const [userPresets, setUserPresets] = useState<{ name: string; color: ColorAdjust }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_PRESETS_KEY) ?? '[]');
    } catch {
      return [];
    }
  });
  const savePreset = () => {
    const name = prompt('Nome do ajuste personalizado');
    if (!name) return;
    const next = [...userPresets.filter((p) => p.name !== name), { name, color: structuredClone(c) }];
    setUserPresets(next);
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(next));
    toast({ kind: 'success', title: `Ajuste “${name}” salvo` });
  };
  return (
    <>
      <Section
        title="Correção de cor"
        actions={<ResetButton onClick={() => upd(clip, { ...DEFAULT_COLOR, curves: undefined, hsl: undefined, lutId: undefined }, 'reset')} label="Restaurar cor" />}
      >
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={compare.clipId === clip.id ? 'primary' : 'secondary'} icon={<Eye size={13} />} onPointerDown={() => compare.set(clip.id)} onPointerUp={() => compare.set(null)} onPointerLeave={() => compare.set(null)} title="Segure para ver o original">
            Antes/depois
          </Button>
          <Button
            size="sm"
            icon={<ClipboardCopy size={13} />}
            onClick={() => {
              useEditor.getState().setAttributeClipboard(structuredClone(clip) as never);
              toast({ kind: 'info', title: 'Ajustes de cor copiados' });
            }}
          >
            Copiar
          </Button>
          <Button size="sm" icon={<ClipboardPaste size={13} />} onClick={() => useEditor.getState().dispatch({ type: 'clip.pasteAttributes', source: useEditor.getState().attributeClipboard!, targetIds: useEditor.getState().selection, groups: ['color'] })} disabled={!useEditor.getState().attributeClipboard}>
            Colar
          </Button>
          <Button size="sm" icon={<Save size={13} />} onClick={savePreset}>
            Salvar
          </Button>
        </div>
        {userPresets.length > 0 && (
          <Select
            value=""
            onChange={(name) => {
              const p = userPresets.find((x) => x.name === name);
              if (p) upd(clip, { ...DEFAULT_COLOR, curves: undefined, hsl: undefined, ...p.color }, 'preset');
            }}
            ariaLabel="Ajustes salvos"
            options={[{ value: '', label: 'Aplicar ajuste salvo…', disabled: true }, ...userPresets.map((p) => ({ value: p.name, label: p.name }))]}
          />
        )}
        {SLIDERS.map((s) => (
          <AnimSlider key={s.key} clip={clip as never} prop={`color:${s.key}`} label={s.label} min={s.min} max={s.max} step={s.key === 'hue' ? 1 : 0.01} format={s.fmt} defaultValue={s.def} />
        ))}
      </Section>
      <CurvesSection clip={clip} />
      <HslSection clip={clip} />
      <Section title="LUT" defaultOpen={!!c.lutId}>
        <Select
          value={c.lutId ?? 'none'}
          onChange={(lutId) => upd(clip, { lutId: lutId === 'none' ? undefined : lutId, lutIntensity: c.lutIntensity ?? 1 }, 'lut')}
          ariaLabel="LUT"
          options={[{ value: 'none', label: 'Nenhum' }, ...Object.values(luts).map((l) => ({ value: l.id, label: `${l.name} (${l.size}³)` }))]}
        />
        {c.lutId && <Slider label="Intensidade" value={c.lutIntensity ?? 1} min={0} max={1} onChange={(v) => upd(clip, { lutIntensity: v }, 'lut-int')} format={(v) => `${Math.round(v * 100)}%`} />}
        {Object.keys(luts).length === 0 && <p className="text-[11px] text-fg-subtle">Importe arquivos .cube na aba Filtros.</p>}
      </Section>
    </>
  );
}

type Channel = 'master' | 'r' | 'g' | 'b';
const CH_COLOR: Record<Channel, string> = { master: '#F5F5F7', r: '#ef4444', g: '#22c55e', b: '#3b82f6' };

function CurvesSection({ clip }: { clip: ColorClip }) {
  const [ch, setCh] = useState<Channel>('master');
  const curves = clip.color.curves ?? { master: [], r: [], g: [], b: [] };
  const pts: Point[] = curves[ch].length ? curves[ch] : [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<number | null>(null);
  const SIZE = 220;
  useEffect(() => {
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, SIZE, SIZE);
    g.strokeStyle = 'rgba(160,160,170,0.25)';
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo((i * SIZE) / 4, 0);
      g.lineTo((i * SIZE) / 4, SIZE);
      g.moveTo(0, (i * SIZE) / 4);
      g.lineTo(SIZE, (i * SIZE) / 4);
      g.stroke();
    }
    const table = curveTable(pts);
    g.strokeStyle = CH_COLOR[ch];
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * SIZE;
      const y = SIZE - (table[i]! / 255) * SIZE;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#fff';
    for (const p of pts) {
      g.beginPath();
      g.arc(p.x * SIZE, SIZE - p.y * SIZE, 4, 0, Math.PI * 2);
      g.fill();
    }
  }, [pts, ch]);

  const write = (next: Point[], coalesce = true) => {
    const sorted = [...next].sort((a, b) => a.x - b.x);
    useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { color: { curves: { ...curves, [ch]: sorted } } } }, coalesce ? { coalesce: `curves:${clip.id}:${ch}` } : undefined);
  };
  const toPt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) };
  };
  return (
    <Section title="Curvas RGB" defaultOpen={false} actions={<ResetButton onClick={() => write([], false)} label="Restaurar curva" />}>
      <Segmented<Channel>
        value={ch}
        onChange={setCh}
        options={[
          { value: 'master', label: 'RGB' },
          { value: 'r', label: <span className="text-red-400">R</span> },
          { value: 'g', label: <span className="text-green-400">G</span> },
          { value: 'b', label: <span className="text-blue-400">B</span> },
        ]}
      />
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        className="aspect-square w-full touch-none rounded-lg border border-line bg-bg-2"
        aria-label="Editor de curva. Clique para adicionar pontos, arraste para mover, clique duplo para remover."
        onPointerDown={(e) => {
          const p = toPt(e);
          let idx = pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.05);
          if (idx < 0) {
            const next = [...pts, p];
            write(next);
            idx = next.sort((a, b) => a.x - b.x).findIndex((q) => q === p);
          }
          dragging.current = idx;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragging.current === null) return;
          const p = toPt(e);
          const next = pts.map((q, i) => (i === dragging.current ? p : q));
          write(next);
        }}
        onPointerUp={() => {
          dragging.current = null;
          useEditor.getState().seal();
        }}
        onDoubleClick={(e) => {
          const p = toPt(e as unknown as React.PointerEvent);
          const next = pts.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 0.05);
          write(next, false);
        }}
      />
    </Section>
  );
}

function HslSection({ clip }: { clip: ColorClip }) {
  const bands: HslBand[] = clip.color.hsl ?? HSL_BANDS.map((b) => ({ hue: b.hue, hueShift: 0, saturation: 0, luminance: 0 }));
  const [sel, setSel] = useState(0);
  const band = bands[sel]!;
  const set = (patch: Partial<HslBand>) => {
    const next = bands.map((b, i) => (i === sel ? { ...b, ...patch } : b));
    upd(clip, { hsl: next }, `hsl-${sel}`);
  };
  return (
    <Section title="HSL" defaultOpen={false} actions={<ResetButton onClick={() => upd(clip, { hsl: undefined }, 'hsl-reset')} />}>
      <div className="flex gap-1">
        {HSL_BANDS.map((b, i) => (
          <button key={b.hue} onClick={() => setSel(i)} aria-label={b.label} title={b.label} className={`h-6 flex-1 rounded ${sel === i ? 'ring-2 ring-white' : ''}`} style={{ background: b.color }} />
        ))}
      </div>
      <Slider label={`Matiz — ${HSL_BANDS[sel]!.label}`} value={band.hueShift} min={-60} max={60} step={1} onChange={(v) => set({ hueShift: v })} format={(v) => `${Math.round(v)}°`} defaultValue={0} />
      <Slider label="Saturação" value={band.saturation} min={-1} max={1} onChange={(v) => set({ saturation: v })} format={signedPct} defaultValue={0} />
      <Slider label="Luminância" value={band.luminance} min={-1} max={1} onChange={(v) => set({ luminance: v })} format={signedPct} defaultValue={0} />
    </Section>
  );
}
