import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { ColorInput, DropdownMenu, IconButton, Section, Switch, EmptyState } from '@framestudio/ui';
import { EFFECT_DEFS } from '@framestudio/editor-core';
import type { AdjustmentClip, EffectType, VisualClip } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { AnimSlider } from './controls.tsx';

export function EffectsSection({ clip }: { clip: VisualClip | AdjustmentClip }) {
  const dispatch = useEditor.getState().dispatch;
  const add = (effect: EffectType) => dispatch({ type: 'effect.add', clipIds: [clip.id], effect });
  return (
    <Section
      title={`Efeitos (${clip.effects.length})`}
      actions={
        <DropdownMenu items={Object.values(EFFECT_DEFS).map((d) => ({ label: `${d.label}`, onSelect: () => add(d.type) }))} align="end">
          <IconButton label="Adicionar efeito" size="sm" className="size-6">
            <Plus size={13} />
          </IconButton>
        </DropdownMenu>
      }
    >
      {clip.effects.length === 0 && (
        <EmptyState icon={<Plus size={18} />} title="Nenhum efeito">
          Adicione pelo botão + ou pela aba Efeitos.
        </EmptyState>
      )}
      {clip.effects.map((fx, i) => {
        const def = EFFECT_DEFS[fx.type];
        return (
          <div key={fx.id} className="rounded-lg border border-line bg-bg-2 p-2.5" data-testid={`fx-${fx.type}`}>
            <div className="mb-2 flex items-center gap-1">
              <Switch checked={fx.enabled} onChange={(enabled) => dispatch({ type: 'effect.update', clipId: clip.id, effectId: fx.id, enabled })} label={<span className="text-xs font-medium text-fg">{def.label}</span>} />
              <div className="ml-auto flex">
                <IconButton label="Mover para cima" size="sm" className="size-6" disabled={i === 0} onClick={() => dispatch({ type: 'effect.reorder', clipId: clip.id, effectId: fx.id, toIndex: i - 1 })}>
                  <ChevronUp size={12} />
                </IconButton>
                <IconButton label="Mover para baixo" size="sm" className="size-6" disabled={i === clip.effects.length - 1} onClick={() => dispatch({ type: 'effect.reorder', clipId: clip.id, effectId: fx.id, toIndex: i + 1 })}>
                  <ChevronDown size={12} />
                </IconButton>
                <IconButton label="Remover efeito" size="sm" className="size-6" onClick={() => dispatch({ type: 'effect.remove', clipId: clip.id, effectId: fx.id })}>
                  <Trash2 size={12} />
                </IconButton>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {def.params.map((p) =>
                p.color ? (
                  <ColorInput
                    key={p.key}
                    label={p.label}
                    value={String(fx.params[p.key] ?? p.color)}
                    onChange={(v) => dispatch({ type: 'effect.update', clipId: clip.id, effectId: fx.id, params: { [p.key]: v } }, { coalesce: `fx:${fx.id}:${p.key}` })}
                  />
                ) : (
                  <AnimSlider
                    key={p.key}
                    clip={clip as never}
                    prop={`effect:${fx.id}:${p.key}`}
                    label={p.label}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    defaultValue={p.default}
                    format={(v) => (p.step >= 1 ? String(Math.round(v)) : v.toFixed(2))}
                  />
                ),
              )}
            </div>
          </div>
        );
      })}
    </Section>
  );
}
