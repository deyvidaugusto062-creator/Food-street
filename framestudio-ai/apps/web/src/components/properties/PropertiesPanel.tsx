import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ColorInput, Field, NumberField, Section, Select, Slider, Tabs, TabsContent, TabsList, TabsTrigger, TextInput } from '@framestudio/ui';
import { TRANSITION_DEFS } from '@framestudio/editor-core';
import { ASPECT_PRESETS, FPS_OPTIONS, formatTimecode, type Direction, type Easing, type Project, type Transition, type TransitionType } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import { useEditor } from '../../state/editor.ts';
import * as A from '../../lib/actions.ts';
import { CropSection, MaskSection, OpacitySection, SpeedSection, TransformSection } from './BasicSection.tsx';
import { ColorSection } from './ColorSection.tsx';
import { EffectsSection } from './EffectsSection.tsx';
import { AudioSection } from './AudioSection.tsx';
import { TextSection } from './TextSection.tsx';
import { AnimationSection } from './AnimationSection.tsx';
import { Segmented } from './controls.tsx';

export function PropertiesPanel() {
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const selectedTransition = useEditor((s) => s.selectedTransition);
  const [tab, setTab] = useState('basic');
  const selectedId = selection.length === 1 ? selection[0] : undefined;
  const selectedType = selectedId ? project.clips[selectedId]?.type : undefined;
  // Ao selecionar outro clipe, abre a aba mais relevante para o tipo.
  useEffect(() => {
    if (selectedType === 'text' || selectedType === 'caption') setTab('text');
    else if (selectedType === 'audio') setTab('basic');
    else if (selectedType === 'adjustment') setTab('color');
  }, [selectedId, selectedType]);
  if (selectedTransition && project.transitions[selectedTransition]) return <TransitionProps t={project.transitions[selectedTransition]!} fps={project.settings.fps} />;
  if (selection.length === 0) return <ProjectProps project={project} />;
  if (selection.length > 1) return <MultiProps count={selection.length} />;
  const clip = project.clips[selection[0]!];
  if (!clip) return <ProjectProps project={project} />;
  const fps = project.settings.fps;
  const visual = clip.type === 'video' || clip.type === 'image' || clip.type === 'text' || clip.type === 'caption';
  const hasAudio = clip.type === 'audio' || clip.type === 'video';
  const isText = clip.type === 'text' || clip.type === 'caption';
  const tabs: { id: string; label: string }[] = [];
  if (isText) tabs.push({ id: 'text', label: 'Texto' });
  if (visual || clip.type === 'audio') tabs.push({ id: 'basic', label: clip.type === 'audio' ? 'Edição' : 'Básico' });
  if (visual || clip.type === 'adjustment') tabs.push({ id: 'color', label: 'Cor' }, { id: 'fx', label: 'Efeitos' });
  if (hasAudio) tabs.push({ id: 'audio', label: 'Áudio' });
  tabs.push({ id: 'anim', label: 'Animação' });
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0]!.id;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="properties">
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <p className="truncate text-sm font-medium text-fg" title={clip.name}>
          {clip.type === 'text' || clip.type === 'caption' ? clip.text.content.split('\n')[0] : clip.name}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-fg-subtle">
          {formatTimecode(clip.start, fps)} → {formatTimecode(clip.start + clip.duration, fps)} · {(clip.duration / fps).toFixed(2)} s
        </p>
      </div>
      <Tabs value={active} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 gap-0.5 border-b border-line px-1.5 py-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="px-2 py-1 text-[11px]">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isText && (
            <TabsContent value="text">
              <TextSection clip={clip} />
            </TabsContent>
          )}
          <TabsContent value="basic">
            {visual && (
              <>
                <TransformSection clip={clip} />
                <OpacitySection clip={clip} />
                {(clip.type === 'video' || clip.type === 'image') && <CropSection clip={clip} />}
                <MaskSection clip={clip} />
              </>
            )}
            {(clip.type === 'video' || clip.type === 'audio') && <SpeedSection clip={clip} />}
          </TabsContent>
          {(visual || clip.type === 'adjustment') && (
            <>
              <TabsContent value="color">
                <ColorSection clip={clip as never} />
              </TabsContent>
              <TabsContent value="fx">
                {clip.type === 'adjustment' && (
                  <Section title="Camada de ajuste">
                    <Slider label="Intensidade" value={clip.opacity} min={0} max={1} onChange={(opacity) => useEditor.getState().dispatch({ type: 'clip.update', clipIds: [clip.id], patch: { opacity } }, { coalesce: `adj:${clip.id}` })} format={(v) => `${Math.round(v * 100)}%`} />
                  </Section>
                )}
                <EffectsSection clip={clip as never} />
              </TabsContent>
            </>
          )}
          {hasAudio && (
            <TabsContent value="audio">
              <AudioSection clip={clip} />
            </TabsContent>
          )}
          <TabsContent value="anim">
            <AnimationSection clip={clip} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function MultiProps({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm font-medium text-fg">{count} elementos selecionados</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={A.groupSelection}>
          Agrupar
        </Button>
        <Button size="sm" onClick={A.ungroupSelection}>
          Desagrupar
        </Button>
        <Button size="sm" onClick={A.duplicateSelection}>
          Duplicar
        </Button>
        <Button size="sm" onClick={() => A.pasteAttributes()} disabled={!useEditor.getState().attributeClipboard}>
          Colar atributos
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => A.deleteSelection()}>
          Excluir
        </Button>
      </div>
      <p className="text-[11px] text-fg-subtle">Arraste qualquer um deles na timeline para mover todos juntos.</p>
    </div>
  );
}

function TransitionProps({ t, fps }: { t: Transition; fps: number }) {
  const upd = (patch: Partial<Transition>, key?: string) => useEditor.getState().dispatch({ type: 'transition.update', transitionId: t.id, patch }, key ? { coalesce: `tr:${t.id}:${key}` } : undefined);
  const def = TRANSITION_DEFS.find((d) => d.type === t.type);
  return (
    <div className="flex flex-col" data-testid="transition-props">
      <div className="border-b border-line px-3 py-2.5">
        <p className="text-sm font-medium text-fg">Transição</p>
        <p className="text-[11px] text-fg-subtle">Centralizada no corte entre os dois clipes.</p>
      </div>
      <Section title="Configuração">
        <Select<TransitionType> value={t.type} onChange={(type) => upd({ type })} ariaLabel="Tipo de transição" options={TRANSITION_DEFS.map((d) => ({ value: d.type, label: d.label }))} />
        <Slider label="Duração" value={t.duration} min={2} max={fps * 4} step={1} onChange={(duration) => upd({ duration }, 'dur')} format={(v) => `${(v / fps).toFixed(2)} s`} onCommit={() => useEditor.getState().seal()} />
        {def?.directional && (
          <Segmented<Direction>
            value={t.direction}
            onChange={(direction) => upd({ direction })}
            options={[
              { value: 'left', label: '←' },
              { value: 'right', label: '→' },
              { value: 'up', label: '↑' },
              { value: 'down', label: '↓' },
            ]}
          />
        )}
        {(t.type === 'blur' || t.type === 'flash') && <Slider label="Intensidade" value={t.intensity} min={0.1} max={2} onChange={(intensity) => upd({ intensity }, 'int')} />}
        <Select<string>
          value={typeof t.easing === 'string' ? t.easing : 'ease-in-out'}
          onChange={(easing) => upd({ easing: easing as Easing })}
          ariaLabel="Curva de animação"
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'ease-in', label: 'Ease in' },
            { value: 'ease-out', label: 'Ease out' },
            { value: 'ease-in-out', label: 'Ease in-out' },
          ]}
        />
        <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => useEditor.getState().dispatch({ type: 'transition.remove', transitionId: t.id })}>
          Remover transição
        </Button>
      </Section>
    </div>
  );
}

function ProjectProps({ project }: { project: Project }) {
  const s = project.settings;
  const dispatch = useEditor.getState().dispatch;
  const [refit, setRefit] = useState<'contain' | 'cover'>('cover');
  const dur = projectDuration(project);
  return (
    <div className="flex flex-col" data-testid="project-props">
      <div className="border-b border-line px-3 py-2.5">
        <p className="text-sm font-medium text-fg">Projeto</p>
        <p className="mt-0.5 font-mono text-[10px] text-fg-subtle">
          {s.width}×{s.height} · {s.fps} fps · {formatTimecode(dur, s.fps)}
        </p>
      </div>
      <Section title="Geral">
        <Field label="Nome">
          <TextInput defaultValue={project.name} key={project.name} onBlur={(e) => e.target.value !== project.name && dispatch({ type: 'project.update', patch: { name: e.target.value } })} />
        </Field>
        <ColorInput label="Fundo" value={s.background} onChange={(background) => dispatch({ type: 'project.update', patch: { background } }, { coalesce: 'bg' })} />
      </Section>
      <Section title="Formato">
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_PRESETS.map((p) => {
            const short = Math.min(s.width, s.height);
            const k = short / Math.min(p.width, p.height);
            const w = Math.round((p.width * k) / 2) * 2;
            const h = Math.round((p.height * k) / 2) * 2;
            const active = Math.abs(s.width / s.height - p.width / p.height) < 0.01;
            return (
              <button
                key={p.id}
                onClick={() => dispatch({ type: 'project.resize', width: w, height: h, refit })}
                className={`rounded-md border px-1 py-1.5 text-[11px] ${active ? 'border-accent bg-accent/10 text-fg' : 'border-line text-fg-muted hover:text-fg'}`}
                data-testid={`aspect-${p.id}`}
              >
                {p.id}
              </button>
            );
          })}
        </div>
        <Segmented
          value={refit}
          onChange={setRefit}
          options={[
            { value: 'cover', label: 'Reenquadrar preenchendo' },
            { value: 'contain', label: 'Manter mídia inteira' },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="L" value={s.width} min={16} max={7680} onChange={(width) => dispatch({ type: 'project.resize', width, height: s.height })} />
          <NumberField label="A" value={s.height} min={16} max={4320} onChange={(height) => dispatch({ type: 'project.resize', width: s.width, height })} />
        </div>
        <Select value={String(s.fps)} onChange={(v) => dispatch({ type: 'project.fps', fps: Number(v) })} ariaLabel="FPS do projeto" options={[...new Set([...FPS_OPTIONS, s.fps])].map((f) => ({ value: String(f), label: `${f} fps` }))} />
      </Section>
      <Section title={`Marcadores (${project.markers.length})`} defaultOpen={project.markers.length > 0}>
        {project.markers.length === 0 && <p className="text-[11px] text-fg-subtle">Pressione M para marcar o playhead.</p>}
        {project.markers.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-xs">
            <button className="font-mono text-accent-soft hover:underline" onClick={() => A.seek(m.frame)}>
              {formatTimecode(m.frame, s.fps)}
            </button>
            <input
              className="min-w-0 flex-1 rounded border border-line bg-bg-2 px-1.5 py-0.5 text-fg outline-none focus:border-accent"
              defaultValue={m.label}
              placeholder="Sem nome"
              onBlur={(e) => e.target.value !== m.label && dispatch({ type: 'marker.update', markerId: m.id, patch: { label: e.target.value } })}
              aria-label="Nome do marcador"
            />
            <button className="text-fg-subtle hover:text-danger" onClick={() => dispatch({ type: 'marker.remove', markerId: m.id })} aria-label="Excluir marcador">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </Section>
    </div>
  );
}
