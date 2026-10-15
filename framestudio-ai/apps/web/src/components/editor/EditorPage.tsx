import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Panel, ResizeHandle, Spinner, toast } from '@framestudio/ui';
import { errorMessage, type MediaAsset, type Project } from '@framestudio/shared';
import { ACCEPT_ATTRIBUTE } from '@framestudio/media-engine';
import { useEditor } from '../../state/editor.ts';
import { repo } from '../../services/repo.ts';
import { bindProject, processAsset, relinkAsset, releaseMediaCaches } from '../../services/media.ts';
import { useSettings } from '../../services/settings.ts';
import { usePreviewSync } from '../../hooks/usePreviewSync.ts';
import { useShortcuts } from '../../hooks/useShortcuts.ts';
import { useIsMobile } from '../../hooks/useIsMobile.ts';
import { navigate } from '../../lib/route.ts';
import { pickFiles } from '../../lib/download.ts';
import { preview } from '../../preview/engine.ts';
import { TopBar } from './TopBar.tsx';
import { PreviewPanel } from './PreviewPanel.tsx';
import { ExportDialog } from './ExportDialog.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { HistoryDialog } from './HistoryDialog.tsx';
import { LibraryPanel } from '../panels/LibraryPanel.tsx';
import { PropertiesPanel } from '../properties/PropertiesPanel.tsx';
import { Timeline } from '../timeline/Timeline.tsx';
import { SettingsDialog } from '../common/SettingsDialog.tsx';
import { MobileEditor } from '../mobile/MobileEditor.tsx';

bindProject(() => useEditor.getState().project);

let generation = 0;

export default function EditorPage({ projectId }: { projectId: string }) {
  const project = useEditor((s) => s.project);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<{ project: Project; savedAt: number } | null>(null);
  const [missing, setMissing] = useState<MediaAsset[]>([]);
  const [missingOpen, setMissingOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const mobile = useIsMobile();

  const checkMissing = useCallback(async (p: Project) => {
    const m = await repo.missingAssets(p);
    setMissing(m);
    if (m.length) setMissingOpen(true);
    for (const a of Object.values(p.assets)) if (!m.some((x) => x.id === a.id)) void processAsset(a);
  }, []);

  useEffect(() => {
    let alive = true;
    const myGen = ++generation;
    (async () => {
      try {
        const p = await repo.load(projectId);
        const rec = await repo.loadRecovery(projectId);
        if (!alive) return;
        useEditor.getState().open(p);
        if (rec && rec.savedAt > p.updatedAt) setRecovery(rec);
        else if (rec) await repo.discardRecovery(projectId);
        await checkMissing(p);
      } catch (e) {
        if (alive) setError(errorMessage(e));
      }
    })();
    return () => {
      alive = false;
      // Captura a miniatura antes de fechar.
      void (async () => {
        const thumb = await preview.snapshot().catch(() => null);
        // Uma nova montagem (ex.: StrictMode) já assumiu o editor: não fecha.
        if (myGen !== generation) return;
        if (thumb) useEditor.getState().dispatch({ type: 'project.update', patch: { thumbnail: thumb } }, { silent: true });
        await useEditor.getState().close();
        if (myGen === generation) releaseMediaCaches();
      })();
    };
  }, [projectId, checkMissing]);

  usePreviewSync();
  useShortcuts(!!project && !exportOpen);

  // Atualiza a miniatura do projeto periodicamente (sem gerar histórico).
  useEffect(() => {
    const t = setInterval(async () => {
      const s = useEditor.getState();
      if (!s.project || s.playing) return;
      const thumb = await preview.snapshot();
      if (thumb && thumb !== s.project.thumbnail) useEditor.setState({ project: { ...s.project, thumbnail: thumb } });
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium text-fg">Não foi possível abrir o projeto</p>
        <p className="max-w-md text-sm text-fg-muted">{error}</p>
        <Button onClick={() => navigate({ name: 'home' })}>Voltar aos projetos</Button>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-fg-muted">
        <Spinner /> Abrindo projeto…
      </div>
    );
  }

  const dialogs = (
    <>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <Dialog
        open={!!recovery}
        onOpenChange={(o) => !o && setRecovery(null)}
        title="Recuperar alterações não salvas?"
        description={recovery ? `Encontramos uma versão salva automaticamente em ${new Date(recovery.savedAt).toLocaleString('pt-BR')}, mais recente que a última versão salva.` : ''}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={async () => {
                await repo.discardRecovery(projectId);
                setRecovery(null);
              }}
            >
              Descartar
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!recovery) return;
                useEditor.getState().open(recovery.project);
                await useEditor.getState().save();
                setRecovery(null);
                await checkMissing(recovery.project);
                toast({ kind: 'success', title: 'Alterações recuperadas' });
              }}
            >
              Recuperar
            </Button>
          </>
        }
      />
      <Dialog
        open={missingOpen}
        onOpenChange={setMissingOpen}
        title="Mídias ausentes"
        description="Estes arquivos não estão no armazenamento deste dispositivo (por exemplo, ao abrir um .fstudio sem mídias). Localize-os para continuar editando; os clipes aparecem em vermelho até lá."
        footer={<Button onClick={() => setMissingOpen(false)}>Continuar</Button>}
      >
        <ul className="flex flex-col gap-2">
          {missing.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
              <span className="min-w-0 truncate text-fg">{a.name}</span>
              <Button
                size="sm"
                onClick={async () => {
                  const [file] = await pickFiles(ACCEPT_ATTRIBUTE, false);
                  if (!file) return;
                  try {
                    const patch = await relinkAsset(a, file);
                    useEditor.getState().dispatch({ type: 'asset.update', assetId: a.id, patch });
                    const rest = missing.filter((m) => m.id !== a.id);
                    setMissing(rest);
                    if (!rest.length) setMissingOpen(false);
                    void processAsset({ ...a, ...patch });
                  } catch (e) {
                    toast({ kind: 'error', title: 'Arquivo incompatível', description: errorMessage(e) });
                  }
                }}
              >
                Localizar…
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );

  if (mobile) {
    return (
      <>
        <MobileEditor onExport={() => setExportOpen(true)} onSettings={() => setSettingsOpen(true)} missing={new Set(missing.map((m) => m.id))} />
        {dialogs}
      </>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="editor">
      <TopBar onExport={() => setExportOpen(true)} onSettings={() => setSettingsOpen(true)} onShortcuts={() => setShortcutsOpen(true)} onHistory={() => setHistoryOpen(true)} />
      <DesktopLayout missing={new Set(missing.map((m) => m.id))} />
      {dialogs}
    </div>
  );
}

function DesktopLayout({ missing }: { missing: Set<string> }) {
  const layout = useSettings((s) => s.layout);
  const [live, setLive] = useState(layout);
  const [base, setBase] = useState(layout);
  useEffect(() => {
    setLive(layout);
    setBase(layout);
  }, [layout]);
  const commit = () => useSettings.getState().set({ layout: live });
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <Panel className="shrink-0 border-r border-line" >
          <div style={{ width: live.left }} className="flex h-full min-h-0 flex-col">
            <LibraryPanel missing={missing} />
          </div>
        </Panel>
        <ResizeHandle direction="horizontal" onResize={(d) => setLive({ ...live, left: clamp(base.left + d, 220, 560) })} onEnd={() => (commit(), setBase(live))} />
        <div className="min-w-0 flex-1">
          <PreviewPanel />
        </div>
        <ResizeHandle direction="horizontal" onResize={(d) => setLive({ ...live, right: clamp(base.right - d, 260, 560) })} onEnd={() => (commit(), setBase(live))} />
        <Panel className="shrink-0 border-l border-line">
          <div style={{ width: live.right }} className="flex h-full min-h-0 flex-col">
            <PropertiesPanel />
          </div>
        </Panel>
      </div>
      <ResizeHandle direction="vertical" onResize={(d) => setLive({ ...live, timeline: clamp(base.timeline - d, 160, 640) })} onEnd={() => (commit(), setBase(live))} />
      <div style={{ height: live.timeline }} className="shrink-0 border-t border-line">
        <Timeline />
      </div>
    </div>
  );
}
