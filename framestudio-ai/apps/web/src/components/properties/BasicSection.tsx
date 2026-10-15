import { AlignCenter, FlipHorizontal2, FlipVertical2, Maximize, Minimize, MoveDiagonal } from 'lucide-react';
import { Button, NumberField, Section, Select, Slider, Switch } from '@framestudio/ui';
import { DEFAULT_CROP, DEFAULT_MASK, type BlendMode, type Clip, type MaskShape, type VisualClip } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { AnimNumber, AnimSlider, ResetButton, Row, Segmented, deg, pct } from './controls.tsx';

const upd = (clip: Clip, patch: Record<string, unknown>, key: string) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch }, { coalesce: `${key}:${clip.id}` });

const BLENDS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiplicar' },
  { value: 'screen', label: 'Tela' },
  { value: 'overlay', label: 'Sobrepor' },
  { value: 'darken', label: 'Escurecer' },
  { value: 'lighten', label: 'Clarear' },
  { value: 'color-dodge', label: 'Subexposição de cor' },
  { value: 'color-burn', label: 'Superexposição de cor' },
  { value: 'hard-light', label: 'Luz forte' },
  { value: 'soft-light', label: 'Luz suave' },
  { value: 'difference', label: 'Diferença' },
  { value: 'exclusion', label: 'Exclusão' },
  { value: 'hue', label: 'Matiz' },
  { value: 'saturation', label: 'Saturação' },
  { value: 'color', label: 'Cor' },
  { value: 'luminosity', label: 'Luminosidade' },
];

export function TransformSection({ clip }: { clip: VisualClip }) {
  const t = clip.transform;
  const media = clip.type === 'video' || clip.type === 'image';
  return (
    <Section
      title="Transformar"
      actions={<ResetButton onClick={() => upd(clip, { transform: { x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false } }, 'reset-t')} label="Restaurar transformação" />}
    >
      <Row>
        <AnimNumber clip={clip} prop="x" label="X" suffix="px" />
        <AnimNumber clip={clip} prop="y" label="Y" suffix="px" />
      </Row>
      <Row>
        <AnimNumber clip={clip} prop="scale" label="Escala" step={0.01} min={0.01} max={20} precision={2} />
        <AnimNumber clip={clip} prop="rotation" label="Rot." suffix="°" step={1} min={-3600} max={3600} />
      </Row>
      {media && (
        <Segmented
          value={t.fit}
          onChange={(fit) => upd(clip, { transform: { fit } }, 'fit')}
          options={[
            { value: 'contain', label: <><Minimize size={12} /> Conter</>, title: 'Mostra a mídia inteira' },
            { value: 'cover', label: <><Maximize size={12} /> Preencher</>, title: 'Preenche o quadro, cortando as sobras' },
            { value: 'stretch', label: <><MoveDiagonal size={12} /> Esticar</>, title: 'Distorce para ocupar o quadro' },
          ]}
        />
      )}
      <div className="flex gap-1.5">
        <Button size="sm" variant={t.flipH ? 'primary' : 'secondary'} icon={<FlipHorizontal2 size={13} />} onClick={() => upd(clip, { transform: { flipH: !t.flipH } }, 'flipH')}>
          Espelhar
        </Button>
        <Button size="sm" variant={t.flipV ? 'primary' : 'secondary'} icon={<FlipVertical2 size={13} />} onClick={() => upd(clip, { transform: { flipV: !t.flipV } }, 'flipV')}>
          Vertical
        </Button>
        <Button size="sm" icon={<AlignCenter size={13} />} onClick={() => upd(clip, { transform: { x: 0, y: 0 } }, 'center')}>
          Centro
        </Button>
      </div>
    </Section>
  );
}

export function OpacitySection({ clip }: { clip: VisualClip }) {
  return (
    <Section title="Opacidade e mistura">
      <AnimSlider clip={clip} prop="opacity" label="Opacidade" min={0} max={1} format={pct} defaultValue={1} />
      <Select<BlendMode> value={clip.blendMode} onChange={(blendMode) => upd(clip, { blendMode }, 'blend')} ariaLabel="Modo de mistura" options={BLENDS} />
    </Section>
  );
}

export function CropSection({ clip }: { clip: VisualClip }) {
  const c = clip.crop;
  const set = (k: keyof typeof c) => (v: number) => upd(clip, { crop: { [k]: v } }, `crop-${k}`);
  return (
    <Section title="Recortar enquadramento" defaultOpen={false} actions={<ResetButton onClick={() => upd(clip, { crop: { ...DEFAULT_CROP } }, 'crop-reset')} />}>
      <Row>
        <Slider label="Esquerda" value={c.left} min={0} max={0.9} onChange={set('left')} format={pct} onCommit={() => useEditor.getState().seal()} />
        <Slider label="Direita" value={c.right} min={0} max={0.9} onChange={set('right')} format={pct} onCommit={() => useEditor.getState().seal()} />
      </Row>
      <Row>
        <Slider label="Topo" value={c.top} min={0} max={0.9} onChange={set('top')} format={pct} onCommit={() => useEditor.getState().seal()} />
        <Slider label="Base" value={c.bottom} min={0} max={0.9} onChange={set('bottom')} format={pct} onCommit={() => useEditor.getState().seal()} />
      </Row>
    </Section>
  );
}

export function MaskSection({ clip }: { clip: VisualClip }) {
  const m = clip.mask;
  const set = (k: keyof typeof m) => (v: number | boolean | string) => upd(clip, { mask: { [k]: v } }, `mask-${k}`);
  return (
    <Section title="Máscara" defaultOpen={false} actions={<ResetButton onClick={() => upd(clip, { mask: { ...DEFAULT_MASK } }, 'mask-reset')} />}>
      <Select<MaskShape>
        value={m.shape}
        onChange={(v) => set('shape')(v)}
        ariaLabel="Forma da máscara"
        options={[
          { value: 'none', label: 'Sem máscara' },
          { value: 'rectangle', label: 'Retângulo' },
          { value: 'ellipse', label: 'Elipse' },
          { value: 'linear', label: 'Linear' },
        ]}
      />
      {m.shape !== 'none' && (
        <>
          <Row>
            <Slider label="Centro X" value={m.cx} min={-0.5} max={0.5} onChange={set('cx')} format={pct} onCommit={() => useEditor.getState().seal()} />
            <Slider label="Centro Y" value={m.cy} min={-0.5} max={0.5} onChange={set('cy')} format={pct} onCommit={() => useEditor.getState().seal()} />
          </Row>
          {m.shape !== 'linear' ? (
            <Row>
              <Slider label="Largura" value={m.width} min={0.02} max={1.5} onChange={set('width')} format={pct} onCommit={() => useEditor.getState().seal()} />
              <Slider label="Altura" value={m.height} min={0.02} max={1.5} onChange={set('height')} format={pct} onCommit={() => useEditor.getState().seal()} />
            </Row>
          ) : (
            <Slider label="Ângulo" value={m.angle} min={0} max={360} step={1} onChange={set('angle')} format={deg} onCommit={() => useEditor.getState().seal()} />
          )}
          <Slider label="Suavização" value={m.feather} min={0} max={0.5} onChange={set('feather')} format={pct} onCommit={() => useEditor.getState().seal()} />
          <Switch checked={m.invert} onChange={set('invert')} label="Inverter" />
        </>
      )}
    </Section>
  );
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export function SpeedSection({ clip }: { clip: Extract<Clip, { type: 'video' | 'audio' }> }) {
  const fps = useEditor((s) => s.project!.settings.fps);
  const asset = useEditor((s) => s.project!.assets[clip.assetId]);
  const setSpeed = (speed: number) => useEditor.getState().dispatch({ type: 'clip.speed', clipId: clip.id, speed });
  return (
    <Section title="Velocidade">
      <div className="grid grid-cols-4 gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`rounded-md border px-1 py-1 text-[11px] font-medium ${clip.speed === s ? 'border-accent bg-accent/15 text-fg' : 'border-line text-fg-muted hover:text-fg'}`}
            data-testid={`speed-${s}`}
          >
            {s}x
          </button>
        ))}
      </div>
      <NumberField label="Personalizada" value={clip.speed} min={0.1} max={16} step={0.05} precision={2} suffix="x" onChange={setSpeed} />
      <Switch checked={clip.reverse} onChange={(reverse) => upd(clip, { reverse }, 'reverse')} label="Reproduzir ao contrário" />
      {clip.freeze && <p className="text-[11px] text-fg-subtle">Este clipe é um quadro congelado.</p>}
      <div className="rounded-lg bg-bg-2 p-2 text-[11px] text-fg-muted">
        Duração: {(clip.duration / fps).toFixed(2)} s · Entrada na mídia: {clip.sourceIn.toFixed(2)} s{asset ? ` de ${asset.duration.toFixed(2)} s` : ''}
      </div>
      <NumberField
        label="Slip (entrada)"
        value={clip.sourceIn}
        step={1 / fps}
        precision={2}
        suffix="s"
        min={0}
        onChange={(v) => useEditor.getState().dispatch({ type: 'clip.slip', clipId: clip.id, deltaSeconds: v - clip.sourceIn }, { coalesce: `slip:${clip.id}` })}
      />
      <p className="text-[10px] text-fg-subtle">Dica: Ctrl+Alt+arrastar o clipe faz slip direto na timeline. O áudio acompanha a velocidade (o tom muda).</p>
    </Section>
  );
}
