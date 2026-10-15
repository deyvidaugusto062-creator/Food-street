import type { ReactNode } from 'react';
import { Diamond, RotateCcw } from 'lucide-react';
import { NumberField, Slider, cx } from '@framestudio/ui';
import type { AnimatableProp, Clip } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { isAnimated, keyframeAt, setAnimatable, toggleKeyframe, valueAt } from '../../lib/animate.ts';

export function KeyframeToggle({ clip, prop }: { clip: Clip; prop: AnimatableProp }) {
  const playhead = useEditor((s) => s.playhead);
  const animated = isAnimated(clip, prop);
  const here = !!keyframeAt(clip, prop, playhead);
  const inside = playhead >= clip.start && playhead < clip.start + clip.duration;
  return (
    <button
      onClick={() => toggleKeyframe(clip, prop)}
      disabled={!inside}
      aria-label={here ? 'Remover keyframe no playhead' : 'Adicionar keyframe no playhead'}
      title={inside ? (here ? 'Remover keyframe' : 'Adicionar keyframe no playhead') : 'Posicione o playhead sobre o clipe'}
      className={cx('flex size-6 shrink-0 items-center justify-center rounded transition-colors disabled:opacity-30', here ? 'text-warning' : animated ? 'text-warning/60 hover:text-warning' : 'text-fg-subtle hover:text-fg')}
      data-testid={`kf-${prop}`}
    >
      <Diamond size={12} fill={here ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Campo numérico animável (valor no playhead + botão de keyframe). */
export function AnimNumber({
  clip,
  prop,
  label,
  min,
  max,
  step = 1,
  suffix,
  precision,
}: {
  clip: Clip;
  prop: AnimatableProp;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  precision?: number;
}) {
  const playhead = useEditor((s) => s.playhead);
  const v = valueAt(clip, prop, playhead);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <NumberField
        className="flex-1"
        label={label}
        value={v}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        precision={precision}
        onChange={(nv) => setAnimatable(clip, prop, nv)}
        onCommit={() => useEditor.getState().seal()}
      />
      <KeyframeToggle clip={clip} prop={prop} />
    </div>
  );
}

/** Slider animável. */
export function AnimSlider({
  clip,
  prop,
  label,
  min,
  max,
  step = 0.01,
  format,
  defaultValue,
}: {
  clip: Clip;
  prop: AnimatableProp;
  label: string;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  defaultValue?: number;
}) {
  const playhead = useEditor((s) => s.playhead);
  const v = valueAt(clip, prop, playhead);
  return (
    <div className="flex items-end gap-1">
      <div className="flex-1">
        <Slider
          label={label}
          value={v}
          min={min}
          max={max}
          step={step}
          format={format}
          defaultValue={defaultValue}
          onChange={(nv) => setAnimatable(clip, prop, nv)}
          onCommit={() => useEditor.getState().seal()}
        />
      </div>
      <KeyframeToggle clip={clip} prop={prop} />
    </div>
  );
}

/** Slider simples ligado a um patch do clipe. */
export function PatchSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  defaultValue,
  patch,
  coalesce,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  defaultValue?: number;
  patch: (v: number) => void;
  coalesce?: string;
}) {
  void coalesce;
  return <Slider label={label} value={value} min={min} max={max} step={step} format={format} defaultValue={defaultValue} onChange={patch} onCommit={() => useEditor.getState().seal()} />;
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return <div className={cx('grid gap-2', cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : cols === 4 ? 'grid-cols-4' : 'grid-cols-1')}>{children}</div>;
}

export function ResetButton({ onClick, label = 'Restaurar' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[11px] text-fg-subtle hover:text-fg" aria-label={label} title={label}>
      <RotateCcw size={11} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="flex rounded-lg border border-line bg-bg-2 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx('flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors', value === o.value ? 'bg-panel-3 text-fg' : 'text-fg-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const signedPct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
export const deg = (v: number) => `${Math.round(v)}°`;
export const secs = (v: number) => `${v.toFixed(2)} s`;
export const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
