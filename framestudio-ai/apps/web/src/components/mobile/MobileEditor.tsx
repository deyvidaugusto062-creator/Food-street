import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  AudioLines,
  Copy,
  Download,
  Gauge,
  Palette,
  Plus,
  Redo2,
  Scissors,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  X,
  Wand2,
  Captions,
  PencilRuler,
} from 'lucide-react';
import { Button, IconButton, cx } from '@framestudio/ui';
import { ACCEPT_ATTRIBUTE } from '@framestudio/media-engine';
import type { Clip } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import * as A from '../../lib/actions.ts';
import { pickFiles } from '../../lib/download.ts';
import { navigate } from '../../lib/route.ts';
import { PreviewPanel } from '../editor/PreviewPanel.tsx';
import { Timeline } from '../timeline/Timeline.tsx';
import { importAndAdd, LibraryTabs } from '../panels/LibraryPanel.tsx';
import { PropertiesPanel } from '../properties/PropertiesPanel.tsx';
import { SpeedSection, TransformSection } from '../properties/BasicSection.tsx';
import { AudioSection } from '../properties/AudioSection.tsx';
import { TextSection } from '../properties/TextSection.tsx';
import { ColorSection } from '../properties/ColorSection.tsx';
import { EffectsSection } from '../properties/EffectsSection.tsx';

type Tool = 'edit' | 'cut' | 'audio' | 'text' | 'captions' | 'effects' | 'filters' | 'speed' | 'adjust' | 'ai' | null;

const haptic = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* sem suporte */
  }
};

const TOOLS: { id: Exclude<Tool, null>; label: string; icon: ReactNode }[] = [
  { id: 'edit', label: 'Editar', icon: <PencilRuler size={20} /> },
  { id: 'cut', label: 'Cortar', icon: <Scissors size={20} /> },
  { id: 'audio', label: 'Áudio', icon: <AudioLines size={20} /> },
  { id: 'text', label: 'Texto', icon: <Type size={20} /> },
  { id: 'captions', label: 'Legendas', icon: <Captions size={20} /> },
  { id: 'effects', label: 'Efeitos', icon: <Sparkles size={20} /> },
  { id: 'filters', label: 'Filtros', icon: <Palette size={20} /> },
  { id: 'speed', label: 'Velocidade', icon: <Gauge size={20} /> },
  { id: 'adjust', label: 'Ajustar', icon: <SlidersHorizontal size={20} /> },
  { id: 'ai', label: 'AI Studio', icon: <Wand2 size={20} /> },
];

export function MobileEditor({ onExport, onSettings, missing }: { onExport: () => void; onSettings: () => void; missing: Set<string> }) {
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const [tool, setTool] = useState<Tool>(null);
  const clip: Clip | undefined = selection.length === 1 ? project.clips[selection[0]!] : undefined;

  const open = (t: Tool) => {
    haptic();
    setTool(tool === t ? null : t);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg" data-testid="mobile-editor">
      <header className="safe-top flex h-12 shrink-0 items-center gap-1 border-b border-line bg-panel px-1">
        <IconButton
          label="Voltar"
          size="lg"
          onClick={async () => {
            await useEditor.getState().close();
            navigate({ name: 'home' });
          }}
        >
          <ArrowLeft size={20} />
        </IconButton>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{project.name}</p>
        <IconButton label="Desfazer" size="lg" disabled={!canUndo} onClick={() => (haptic(), useEditor.getState().undo())}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Refazer" size="lg" disabled={!canRedo} onClick={() => (haptic(), useEditor.getState().redo())}>
          <Redo2 size={18} />
        </IconButton>
        <IconButton label="Configurações" size="lg" onClick={onSettings}>
          <Settings size={18} />
        </IconButton>
        <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={onExport} className="mr-1">
          Exportar
        </Button>
      </header>

      <div className="min-h-0 flex-[1.15]">
        <PreviewPanel compact />
      </div>

      <div className="relative min-h-[150px] flex-1 border-t border-line">
        <Timeline compact />
        <button
          onClick={() => {
            haptic();
            void pickFiles(ACCEPT_ATTRIBUTE).then((f) => { if (f.length) void importAndAdd(f, true); });
          }}
          className="absolute bottom-3 right-3 z-50 flex size-12 items-center justify-center rounded-full bg-accent text-white shadow-xl active:scale-95"
          aria-label="Adicionar mídia"
          data-testid="mobile-add-media"
        >
          <Plus size={22} />
        </button>
      </div>

      {tool && (
        <div className="fs-sheet absolute inset-x-0 bottom-[76px] z-40 flex max-h-[55dvh] flex-col rounded-t-2xl border-t border-line bg-panel shadow-2xl" role="dialog" aria-label={TOOLS.find((t) => t.id === tool)?.label}>
          <div className="flex shrink-0 items-center justify-between px-4 pt-2">
            <div className="mx-auto h-1 w-10 rounded-full bg-panel-3" />
          </div>
          <div className="flex shrink-0 items-center justify-between px-3 pb-1">
            <p className="text-sm font-semibold text-fg">{TOOLS.find((t) => t.id === tool)?.label}</p>
            <IconButton label="Fechar" onClick={() => setTool(null)}>
              <X size={18} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            <ToolSheet tool={tool} clip={clip} missing={missing} />
          </div>
        </div>
      )}

      <nav className="safe-bottom shrink-0 border-t border-line bg-panel" aria-label="Ferramentas">
        <div className="flex h-[76px] items-stretch overflow-x-auto px-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => open(t.id)}
              className={cx('flex min-w-[68px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] transition-colors', tool === t.id ? 'text-accent-soft' : 'text-fg-muted active:bg-panel-2')}
              aria-pressed={tool === t.id}
              data-testid={`mtool-${t.id}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function NeedClip({ children }: { children?: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-fg-muted">{children ?? 'Toque em um clipe na timeline para selecioná-lo.'}</p>;
}

function ActionGrid({ actions }: { actions: { label: string; icon: ReactNode; run: () => void; disabled?: boolean; danger?: boolean }[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 px-3 py-2">
      {actions.map((a) => (
        <button
          key={a.label}
          disabled={a.disabled}
          onClick={() => {
            haptic();
            a.run();
          }}
          className={cx('flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl bg-bg-2 text-[11px] active:scale-95 disabled:opacity-40', a.danger ? 'text-danger' : 'text-fg')}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

function ToolSheet({ tool, clip, missing }: { tool: Exclude<Tool, null>; clip?: Clip; missing: Set<string> }) {
  switch (tool) {
    case 'edit':
      return (
        <>
          <ActionGrid
            actions={[
              { label: 'Dividir', icon: <Scissors size={18} />, run: A.splitAtPlayhead },
              { label: 'Duplicar', icon: <Copy size={18} />, run: A.duplicateSelection, disabled: !clip },
              { label: 'Copiar', icon: <Copy size={18} />, run: () => void A.copySelection(), disabled: !clip },
              { label: 'Colar', icon: <Copy size={18} />, run: A.paste },
              { label: 'Separar áudio', icon: <AudioLines size={18} />, run: A.detachAudio, disabled: clip?.type !== 'video' },
              { label: 'Congelar', icon: <SlidersHorizontal size={18} />, run: () => A.freezeFrame(2), disabled: clip?.type !== 'video' },
              { label: 'Transição', icon: <Sparkles size={18} />, run: () => A.addTransitionToSelection('dissolve'), disabled: !clip },
              { label: 'Excluir', icon: <Trash2 size={18} />, run: () => A.deleteSelection(), disabled: !clip, danger: true },
            ]}
          />
          {clip && 'transform' in clip && <TransformSection clip={clip} />}
        </>
      );
    case 'cut':
      return (
        <>
          <ActionGrid
            actions={[
              { label: 'Dividir aqui', icon: <Scissors size={18} />, run: A.splitAtPlayhead },
              {
                label: 'Cortar início',
                icon: <Scissors size={18} />,
                disabled: !clip,
                run: () => clip && useEditor.getState().dispatch({ type: 'clip.trim', clipId: clip.id, edge: 'start', frame: A.playheadFrame() }),
              },
              {
                label: 'Cortar fim',
                icon: <Scissors size={18} />,
                disabled: !clip,
                run: () => clip && useEditor.getState().dispatch({ type: 'clip.trim', clipId: clip.id, edge: 'end', frame: A.playheadFrame() }),
              },
              { label: 'Excluir e fechar', icon: <Trash2 size={18} />, run: () => A.deleteSelection(true), disabled: !clip, danger: true },
            ]}
          />
          <p className="px-4 text-[11px] text-fg-subtle">Arraste as bordas do clipe na timeline para aparar. Use dois dedos para dar zoom.</p>
        </>
      );
    case 'audio':
      return clip && (clip.type === 'audio' || clip.type === 'video') ? <AudioSection clip={clip} /> : <LibraryTabs initial="audio" only={['audio']} missing={missing} />;
    case 'text':
      return clip && (clip.type === 'text' || clip.type === 'caption') ? <TextSection clip={clip} /> : <LibraryTabs initial="text" only={['text', 'elements']} missing={missing} />;
    case 'captions':
    case 'ai':
      return <LibraryTabs initial="ai" only={['ai']} missing={missing} />;
    case 'effects':
      return clip && 'effects' in clip ? (
        <>
          <EffectsSection clip={clip as never} />
          <LibraryTabs initial="effects" only={['effects', 'transitions']} missing={missing} />
        </>
      ) : (
        <LibraryTabs initial="effects" only={['effects', 'transitions']} missing={missing} />
      );
    case 'filters':
      return <LibraryTabs initial="filters" only={['filters']} missing={missing} />;
    case 'speed':
      return clip && (clip.type === 'video' || clip.type === 'audio') ? <SpeedSection clip={clip} /> : <NeedClip>Selecione um vídeo ou áudio.</NeedClip>;
    case 'adjust':
      return clip && 'color' in clip ? <ColorSection clip={clip as never} /> : clip ? <PropertiesPanel /> : <NeedClip />;
  }
}
