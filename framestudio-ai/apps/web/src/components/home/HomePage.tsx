import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Cpu,
  Download,
  FileUp,
  FolderOpen,
  HardDrive,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Smartphone,
  Star,
  Trash2,
  Film,
} from 'lucide-react';
import { Button, Dialog, DropdownMenu, EmptyState, IconButton, ProgressBar, Spinner, TextInput, useToast, cx } from '@framestudio/ui';
import { errorMessage, formatDuration, type Project, type ProjectSummary } from '@framestudio/shared';
import { detectDevice, detectExportCapabilities, VIDEO_CODEC_LABEL, type ExportCapabilities } from '@framestudio/media-engine';
import { estimateStorage, readFstudio, requestPersistence, writeFstudio, FSTUDIO_EXT, type StorageEstimate } from '@framestudio/project-storage';
import { repo } from '../../services/repo.ts';
import { TEMPLATES, createFromTemplate, type TemplateDef } from '../../services/templates.ts';
import { navigate } from '../../lib/route.ts';
import { downloadBlob, pickFiles, sanitizeFileName } from '../../lib/download.ts';
import { aspectLabel, formatBytes, formatRelative } from '../../lib/format.ts';
import { canInstall, onInstallAvailable, promptInstall } from '../../lib/pwa.ts';
import { Logo } from '../common/Logo.tsx';
import { SettingsDialog } from '../common/SettingsDialog.tsx';
import { NewProjectDialog } from './NewProjectDialog.tsx';

export function HomePage() {
  const push = useToast();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [installable, setInstallable] = useState(canInstall());

  const refresh = useCallback(async () => {
    try {
      setProjects(await repo.list());
    } catch (e) {
      push({ kind: 'error', title: 'Não foi possível abrir o armazenamento local', description: errorMessage(e) });
      setProjects([]);
    }
  }, [push]);

  useEffect(() => {
    void refresh();
    return onInstallAvailable(() => setInstallable(true));
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [projects, query]);
  const favorites = filtered.filter((p) => p.favorite);
  const recovery = (projects ?? []).filter((p) => p.hasRecovery);

  const createAndOpen = async (p: Project) => {
    try {
      await repo.save(p);
      navigate({ name: 'editor', projectId: p.id });
    } catch (e) {
      push({ kind: 'error', title: 'Falha ao criar projeto', description: errorMessage(e) });
    }
  };

  const fromTemplate = async (t: TemplateDef) => {
    setBusy(t.id);
    try {
      await createAndOpen(await createFromTemplate(t));
    } catch (e) {
      push({ kind: 'error', title: 'Falha ao criar a partir do template', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const importProject = async () => {
    const [file] = await pickFiles(`${FSTUDIO_EXT},application/zip`, false);
    if (!file) return;
    setBusy('import');
    try {
      const { project, media, manifest } = await readFstudio(file, { newId: true });
      for (const [key, blob] of media) await repo.putMedia(key, blob);
      await repo.save(project);
      const missing = await repo.missingAssets(project);
      push({
        kind: missing.length ? 'warning' : 'success',
        title: `Projeto "${project.name}" importado`,
        description: missing.length ? `${missing.length} mídia(s) não incluída(s) no arquivo — você poderá localizá-las ao abrir.` : manifest.packaged ? 'Mídias incluídas no pacote.' : undefined,
      });
      await refresh();
    } catch (e) {
      push({ kind: 'error', title: 'Não foi possível importar o projeto', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const exportFstudio = async (s: ProjectSummary, withMedia: boolean) => {
    setBusy(s.id);
    try {
      const p = await repo.load(s.id);
      let media: Map<string, Blob> | undefined;
      if (withMedia) {
        media = new Map();
        for (const a of Object.values(p.assets)) {
          const b = await repo.getMedia(a.storageKey);
          if (b) media.set(a.storageKey, b);
        }
      }
      downloadBlob(await writeFstudio(p, media), `${sanitizeFileName(p.name)}${FSTUDIO_EXT}`);
    } catch (e) {
      push({ kind: 'error', title: 'Falha ao exportar o projeto', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const projectMenu = (s: ProjectSummary) => [
    { label: 'Abrir', icon: <FolderOpen size={14} />, onSelect: () => navigate({ name: 'editor', projectId: s.id }) },
    { label: s.favorite ? 'Remover dos favoritos' : 'Favoritar', icon: <Star size={14} />, onSelect: () => void repo.setFavorite(s.id, !s.favorite).then(refresh) },
    { label: 'Renomear', icon: <Pencil size={14} />, onSelect: () => setRenaming(s) },
    {
      label: 'Duplicar',
      icon: <Copy size={14} />,
      onSelect: () =>
        void repo
          .duplicate(s.id)
          .then(refresh)
          .catch((e) => push({ kind: 'error', title: 'Falha ao duplicar', description: errorMessage(e) })),
    },
    { separator: true, label: '' },
    { label: 'Salvar .fstudio (só projeto)', icon: <Download size={14} />, onSelect: () => void exportFstudio(s, false) },
    { label: 'Empacotar com mídias', icon: <Download size={14} />, onSelect: () => void exportFstudio(s, true) },
    { separator: true, label: '' },
    { label: 'Excluir', icon: <Trash2 size={14} />, danger: true, onSelect: () => setDeleting(s) },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar projetos" className="w-64 pl-8" aria-label="Pesquisar projetos" />
            </div>
            {installable && (
              <Button size="sm" variant="ghost" icon={<Smartphone size={14} />} onClick={() => void promptInstall().then(() => setInstallable(false))}>
                Instalar app
              </Button>
            )}
            <IconButton label="Configurações" onClick={() => setSettingsOpen(true)}>
              <Settings size={18} />
            </IconButton>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">O que vamos criar hoje?</h1>
            <p className="mt-2 text-sm text-fg-muted">Edição profissional direto no seu dispositivo. Seus vídeos não saem daqui sem a sua autorização.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" icon={<Plus size={16} />} onClick={() => setNewOpen(true)} data-testid="new-project">
              Novo projeto
            </Button>
            <Button size="lg" icon={busy === 'import' ? <Spinner size={14} /> : <FileUp size={16} />} onClick={importProject} disabled={busy === 'import'}>
              Importar projeto
            </Button>
          </div>
        </section>

        <div className="sm:hidden">
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar projetos" aria-label="Pesquisar projetos" />
        </div>

        {recovery.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <RotateCcw size={16} className="text-warning" /> Alterações não finalizadas encontradas
            </p>
            <p className="text-xs text-fg-muted">Abra o projeto para recuperar a versão salva automaticamente ou descartá-la.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {recovery.map((p) => (
                <Button key={p.id} size="sm" onClick={() => navigate({ name: 'editor', projectId: p.id })}>
                  Recuperar “{p.name}”
                </Button>
              ))}
            </div>
          </section>
        )}

        {favorites.length > 0 && (
          <section>
            <SectionTitle icon={<Star size={15} />} title="Favoritos" />
            <ProjectGrid items={favorites} menu={projectMenu} busy={busy} />
          </section>
        )}

        <section>
          <SectionTitle icon={<Film size={15} />} title="Projetos recentes" />
          {projects === null ? (
            <div className="flex items-center gap-2 py-10 text-sm text-fg-muted">
              <Spinner /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line">
              <EmptyState icon={<Film size={28} />} title={query ? 'Nenhum projeto encontrado' : 'Nenhum projeto ainda'}>
                {query ? 'Tente outro termo de busca.' : 'Crie um projeto ou comece por um template.'}
              </EmptyState>
            </div>
          ) : (
            <ProjectGrid items={filtered} menu={projectMenu} busy={busy} />
          )}
        </section>

        <section>
          <SectionTitle icon={<LayoutTemplate size={15} />} title="Templates" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => void fromTemplate(t)}
                disabled={!!busy}
                className="group flex flex-col overflow-hidden rounded-xl border border-line bg-panel text-left transition-all hover:-translate-y-0.5 hover:border-accent/60 disabled:opacity-60"
              >
                <div className="relative flex h-28 items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}>
                  <div className="rounded-[3px] border-2 border-white/70" style={{ width: t.width >= t.height ? 56 : (56 * t.width) / t.height, height: t.width >= t.height ? (56 * t.height) / t.width : 56 }} />
                  {busy === t.id && <Spinner className="absolute text-white" />}
                </div>
                <div className="p-3">
                  <p className="text-[13px] font-medium text-fg">{t.name}</p>
                  <p className="mt-0.5 text-[11px] text-fg-subtle">
                    {t.platform} · {aspectLabel(t.width, t.height)} · {t.seconds}s
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 pb-10 md:grid-cols-2">
          <StorageCard onCleaned={refresh} />
          <DeviceCard />
        </section>
      </main>

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} onCreate={(p) => void createAndOpen(p)} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RenameDialog
        project={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (renaming) await repo.rename(renaming.id, name);
          setRenaming(null);
          await refresh();
        }}
      />
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir projeto?"
        description={`“${deleting?.name}” e as mídias usadas somente por ele serão removidos deste dispositivo. Esta ação não pode ser desfeita. Seus arquivos originais não são afetados.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleting) await repo.delete(deleting.id);
                setDeleting(null);
                await refresh();
              }}
            >
              Excluir
            </Button>
          </>
        }
      />
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg-muted">
      {icon}
      {title}
    </h2>
  );
}

function ProjectGrid({ items, menu, busy }: { items: ProjectSummary[]; menu: (s: ProjectSummary) => Parameters<typeof DropdownMenu>[0]['items']; busy: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((p) => (
        <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-panel transition-all hover:-translate-y-0.5 hover:border-accent/60" data-testid="project-card">
          <button className="relative aspect-video w-full overflow-hidden bg-bg-2" onClick={() => navigate({ name: 'editor', projectId: p.id })} aria-label={`Abrir ${p.name}`}>
            {p.thumbnail ? (
              <img src={p.thumbnail} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-fg-subtle">
                <Film size={24} />
              </div>
            )}
            {busy === p.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Spinner className="text-white" />
              </div>
            )}
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatDuration(p.durationFrames / p.fps)}</span>
            {p.hasRecovery && <span className="absolute left-1.5 top-1.5 rounded bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-black">Não salvo</span>}
          </button>
          <div className="flex items-start gap-1 p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-fg">
                {p.favorite && <Star size={11} className="mr-1 inline fill-warning text-warning" />}
                {p.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
                {aspectLabel(p.width, p.height)} · {p.width}×{p.height} · {p.fps}fps · {formatRelative(p.updatedAt)}
              </p>
            </div>
            <DropdownMenu items={menu(p)} align="end">
              <IconButton label="Mais ações" size="sm" tooltip={false}>
                <MoreHorizontal size={16} />
              </IconButton>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}

function RenameDialog({ project, onClose, onSave }: { project: ProjectSummary | null; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  useEffect(() => setName(project?.name ?? ''), [project]);
  return (
    <Dialog
      open={!!project}
      onOpenChange={(o) => !o && onClose()}
      title="Renomear projeto"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void onSave(name)}>
            Salvar
          </Button>
        </>
      }
    >
      <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && void onSave(name)} aria-label="Nome do projeto" />
    </Dialog>
  );
}

function StorageCard({ onCleaned }: { onCleaned: () => void }) {
  const [est, setEst] = useState<StorageEstimate | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const push = useToast();
  const load = useCallback(() => void estimateStorage().then(setEst), []);
  useEffect(load, [load]);
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <HardDrive size={16} className="text-accent-soft" /> Armazenamento local
      </p>
      {est ? (
        <>
          <div className="mt-4 flex items-baseline justify-between text-xs">
            <span className="text-fg-muted">
              {formatBytes(est.usage)} usados de {formatBytes(est.quota)}
            </span>
            <span className="text-fg-subtle">{est.persisted ? 'Persistente' : 'Pode ser limpo pelo navegador'}</span>
          </div>
          <ProgressBar value={est.quota ? est.usage / est.quota : 0} className="mt-2" />
        </>
      ) : (
        <p className="mt-3 text-xs text-fg-muted">Estimativa de espaço indisponível neste navegador.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {est && !est.persisted && (
          <Button size="sm" onClick={() => void requestPersistence().then((ok) => (push({ kind: ok ? 'success' : 'warning', title: ok ? 'Armazenamento persistente ativado' : 'O navegador recusou a persistência' }), load()))}>
            Tornar persistente
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          loading={cleaning}
          onClick={async () => {
            setCleaning(true);
            try {
              const n = await repo.collectGarbage();
              push({ kind: 'success', title: n ? `${n} arquivo(s) de mídia sem uso removido(s)` : 'Nenhuma mídia órfã encontrada' });
              load();
              onCleaned();
            } finally {
              setCleaning(false);
            }
          }}
        >
          Limpar mídias sem uso
        </Button>
      </div>
    </div>
  );
}

function DeviceCard() {
  const dev = useMemo(() => detectDevice(), []);
  const [caps, setCaps] = useState<ExportCapabilities | null>(null);
  useEffect(() => void detectExportCapabilities().then(setCaps).catch(() => setCaps({ formats: [], maxHeight: {} })), []);
  const Row = ({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) => (
    <li className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-fg-muted">{label}</span>
      <span className={cx('font-medium', ok ? 'text-success' : 'text-fg-subtle')}>{detail ?? (ok ? 'Disponível' : 'Indisponível')}</span>
    </li>
  );
  const codecs = caps ? [...new Set(caps.formats.flatMap((f) => f.videoCodecs))] : [];
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Cpu size={16} className="text-blue" /> Recursos deste dispositivo
      </p>
      <ul className="mt-3 divide-y divide-line">
        <Row label="Processadores lógicos" ok detail={String(dev.cores)} />
        <Row label="Memória (aprox.)" ok={dev.memoryGb !== null} detail={dev.memoryGb ? `${dev.memoryGb} GB+` : 'Não informado'} />
        <Row label="WebCodecs (codificação acelerada)" ok={dev.webCodecs} />
        <Row label="WebGL2 (efeitos por GPU)" ok={dev.webgl2} />
        <Row label="Armazenamento OPFS" ok={dev.opfs} />
        <Row
          label="Exportação de vídeo"
          ok={codecs.length > 0}
          detail={caps === null ? 'Verificando…' : codecs.length ? codecs.map((c) => `${VIDEO_CODEC_LABEL[c]}${caps.maxHeight[c] ? ` (até ${caps.maxHeight[c]}p)` : ''}`).join(', ') : 'Nenhum codec disponível'}
        />
      </ul>
    </div>
  );
}
