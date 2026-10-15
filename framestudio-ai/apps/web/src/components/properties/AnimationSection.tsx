import { Trash2 } from 'lucide-react';
import { IconButton, NumberField, Section, Select, EmptyState } from '@framestudio/ui';
import { EFFECT_DEFS } from '@framestudio/editor-core';
import type { AnimatableProp, Clip, Easing } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import * as A from '../../lib/actions.ts';

const PROP_LABEL: Record<string, string> = { x: 'Posição X', y: 'Posição Y', scale: 'Escala', rotation: 'Rotação', opacity: 'Opacidade', volume: 'Volume' };

function propLabel(clip: Clip, prop: string): string {
  if (PROP_LABEL[prop]) return PROP_LABEL[prop]!;
  if (prop.startsWith('color:')) return `Cor · ${prop.slice(6)}`;
  if (prop.startsWith('effect:') && 'effects' in clip) {
    const [, id, param] = prop.split(':');
    const fx = clip.effects.find((e) => e.id === id);
    const def = fx ? EFFECT_DEFS[fx.type] : undefined;
    return `${def?.label ?? 'Efeito'} · ${def?.params.find((p) => p.key === param)?.label ?? param}`;
  }
  return prop;
}

const EASINGS: { value: string; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'ease-in-out', label: 'Ease in-out' },
  { value: 'hold', label: 'Manter (degrau)' },
  { value: 'bezier', label: 'Bézier personalizada' },
];

export function AnimationSection({ clip }: { clip: Clip }) {
  const fps = useEditor((s) => s.project!.settings.fps);
  const dispatch = useEditor.getState().dispatch;
  const props = Object.entries(clip.keyframes).filter(([, l]) => l && l.length) as [AnimatableProp, NonNullable<Clip['keyframes'][AnimatableProp]>][];
  return (
    <Section title="Keyframes">
      {props.length === 0 ? (
        <EmptyState icon={<span className="text-lg">◆</span>} title="Sem animação">
          Clique no losango ◇ ao lado de uma propriedade para criar um keyframe no playhead. Depois mova o playhead e altere o valor.
        </EmptyState>
      ) : (
        props.map(([prop, list]) => (
          <div key={prop} className="rounded-lg border border-line bg-bg-2 p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-fg">{propLabel(clip, prop)}</span>
              <button className="text-[11px] text-fg-subtle hover:text-danger" onClick={() => dispatch({ type: 'keyframe.clear', clipId: clip.id, prop })}>
                Limpar
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {list.map((k) => {
                const easingValue = typeof k.easing === 'object' ? 'bezier' : k.easing;
                return (
                  <div key={k.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button className="w-14 shrink-0 text-left font-mono text-[10px] text-accent-soft hover:underline" onClick={() => A.seek(clip.start + k.frame)} title="Ir para o keyframe">
                        {(k.frame / fps).toFixed(2)}s
                      </button>
                      <NumberField
                        className="flex-1"
                        value={k.value}
                        step={prop === 'opacity' || prop === 'volume' ? 0.01 : prop === 'scale' ? 0.01 : 1}
                        precision={prop === 'opacity' || prop === 'volume' || prop === 'scale' ? 2 : 1}
                        onChange={(value) => dispatch({ type: 'keyframe.update', clipId: clip.id, prop, keyframeId: k.id, patch: { value } }, { coalesce: `kfv:${k.id}` })}
                      />
                      <Select
                        value={easingValue}
                        onChange={(v) => {
                          const easing: Easing = v === 'bezier' ? { type: 'bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } : (v as Easing);
                          dispatch({ type: 'keyframe.update', clipId: clip.id, prop, keyframeId: k.id, patch: { easing } });
                        }}
                        ariaLabel="Interpolação"
                        options={EASINGS}
                        className="h-8 w-28 text-[11px]"
                      />
                      <IconButton label="Remover keyframe" size="sm" className="size-6" onClick={() => dispatch({ type: 'keyframe.remove', clipId: clip.id, prop, keyframeId: k.id })}>
                        <Trash2 size={11} />
                      </IconButton>
                    </div>
                    {typeof k.easing === 'object' && (
                      <div className="grid grid-cols-4 gap-1 pl-14">
                        {(['x1', 'y1', 'x2', 'y2'] as const).map((key) => (
                          <NumberField
                            key={key}
                            label={key}
                            value={(k.easing as { [K in typeof key]: number })[key]}
                            min={key.startsWith('x') ? 0 : -2}
                            max={key.startsWith('x') ? 1 : 3}
                            step={0.01}
                            precision={2}
                            onChange={(v) => dispatch({ type: 'keyframe.update', clipId: clip.id, prop, keyframeId: k.id, patch: { easing: { ...(k.easing as object), [key]: v } as unknown as Easing } }, { coalesce: `kfe:${k.id}` })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </Section>
  );
}
