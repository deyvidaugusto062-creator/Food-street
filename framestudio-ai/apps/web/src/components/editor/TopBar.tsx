import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CloudOff, Download, Keyboard, Loader2, MoreHorizontal, Redo2, Save, Settings, Undo2, Upload, History as HistoryIcon, Activity } from 'lucide-react';
import { Button, DropdownMenu, IconButton, Tooltip, toast } from '@framestudio/ui';
import { writeFstudio, FSTUDIO_EXT } from '@framestudio/project-storage';
import { errorMessage } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { navigate } from '../../lib/route.ts';
import { downloadBlob, sanitizeFileName } from '../../lib/download.ts';
import { repo } from '../../services/repo.ts';
import { preview } from '../../preview/engine.ts';
import { LogoMark } from '../common/Logo.tsx';
import { exportCaptions } from '../../services/captions.ts';

export function TopBar({ onExport, onSettings, onShortcuts, onHistory, compact = false }: { onExport: () => void; onSettings: () => void; onShortcuts: () => void; onHistory: () => void; compact?: boolean }) {
  const project = useEditor((s) => s.project)!;
  const dirty = useEditor((s) => s.project !== s.savedProject);
  const status = useEditor((s) => s.saveStatus);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const undoLabel = useEditor((s) => s.undoLabel);
  const redoLabel = useEditor((s) => s.redoLabel);
  const [name, setName] = useState(project.name);
  const [perf, setPerf] = useState(false);
  useEffect(() => setName(project.name), [project.name]);

  const saveAs = async (withMedia: boolean) => {
    try {
      let media: Map<string, Blob> | undefined;
      if (withMedia) {
        media = new Map();
        for (const a of Object.values(project.assets)) {
          const b = await repo.getMedia(a.storageKey);
          if (b) media.set(a.storageKey, b);
        }
      }
      downloadBlob(await writeFstudio(project, media), `${sanitizeFileName(project.name)}${FSTUDIO_EXT}`);
    } catch (e) {
      toast({ kind: 'error', title: 'Falha ao gerar o arquivo .fstudio', description: errorMessage(e) });
    }
  };

  const statusEl =
    status.state === 'saving' ? (
      <span className="flex items-center gap-1">
        <Loader2 size={12} className="animate-spin" /> Salvando…
      </span>
    ) : status.state === 'error' ? (
      <span className="flex items-center gap-1 text-danger" title={status.error}>
        <CloudOff size={12} /> Erro ao salvar
      </span>
    ) : dirty ? (
      <span title="As alterações são guardadas automaticamente como rascunho de recuperação. Ctrl+S salva o projeto.">● Rascunho salvo automaticamente</span>
    ) : (
      <span className="flex items-center gap-1">
        <Check size={12} /> Salvo
      </span>
    );

  return (
    <header className="safe-top flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
      <IconButton
        label="Voltar aos projetos"
        onClick={async () => {
          await useEditor.getState().close();
          navigate({ name: 'home' });
        }}
        data-testid="back-home"
      >
        <ArrowLeft size={17} />
      </IconButton>
      {!compact && <LogoMark size={22} />}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== project.name && useEditor.getState().dispatch({ type: 'project.update', patch: { name } })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="min-w-0 max-w-[40vw] rounded-md bg-transparent px-1.5 py-1 text-sm font-medium text-fg outline-none hover:bg-panel-2 focus:bg-panel-2 focus:ring-1 focus:ring-accent"
        aria-label="Nome do projeto"
      />
      {!compact && <div className="hidden text-[11px] text-fg-subtle md:block" data-testid="save-status">{statusEl}</div>}
      <div className="ml-auto flex items-center gap-1">
        {!compact && (
          <>
            <IconButton label={undoLabel ? `Desfazer: ${undoLabel}` : 'Desfazer'} shortcut="Ctrl+Z" disabled={!canUndo} onClick={() => useEditor.getState().undo()}>
              <Undo2 size={16} />
            </IconButton>
            <IconButton label={redoLabel ? `Refazer: ${redoLabel}` : 'Refazer'} shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => useEditor.getState().redo()}>
              <Redo2 size={16} />
            </IconButton>
            <IconButton label="Histórico de operações" onClick={onHistory}>
              <HistoryIcon size={16} />
            </IconButton>
            {perf && <PerfBadge />}
          </>
        )}
        <Tooltip content="Salvar (Ctrl+S)">
          <Button size="sm" variant="ghost" icon={<Save size={14} />} onClick={() => void useEditor.getState().save()} data-testid="save-project">
            {!compact && 'Salvar'}
          </Button>
        </Tooltip>
        <DropdownMenu
          align="end"
          items={[
            { label: 'Salvar como .fstudio', icon: <Download size={14} />, onSelect: () => void saveAs(false) },
            { label: 'Empacotar projeto com mídias', icon: <Download size={14} />, onSelect: () => void saveAs(true) },
            { label: 'Exportar legendas (.srt)', icon: <Upload size={14} />, onSelect: () => exportCaptions(project, 'srt') },
            { label: 'Exportar legendas (.vtt)', icon: <Upload size={14} />, onSelect: () => exportCaptions(project, 'vtt') },
            { separator: true, label: '' },
            { label: 'Atalhos de teclado', icon: <Keyboard size={14} />, onSelect: onShortcuts },
            { label: perf ? 'Ocultar monitor de desempenho' : 'Monitor de desempenho', icon: <Activity size={14} />, onSelect: () => setPerf(!perf) },
            { label: 'Configurações', icon: <Settings size={14} />, onSelect: onSettings },
          ]}
        >
          <IconButton label="Mais opções">
            <MoreHorizontal size={17} />
          </IconButton>
        </DropdownMenu>
        <Button variant="primary" size="sm" icon={<Download size={14} />} onClick={onExport} data-testid="open-export">
          Exportar
        </Button>
      </div>
    </header>
  );
}

function PerfBadge() {
  const [s, setS] = useState(preview.stats);
  const [mem, setMem] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => {
      setS({ ...preview.stats });
      const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setMem(m ? m.usedJSHeapSize / 1024 ** 2 : null);
    }, 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden items-center gap-2 rounded-md bg-bg-2 px-2 py-1 font-mono text-[10px] text-fg-muted lg:flex" title="Tempo de composição por quadro, taxa de atualização do preview e memória JS (quando disponível)">
      <span>{s.drawMs.toFixed(1)} ms/quadro</span>
      {s.fps > 0 && <span>{s.fps.toFixed(0)} fps</span>}
      {mem !== null && <span>{mem.toFixed(0)} MB</span>}
    </div>
  );
}
