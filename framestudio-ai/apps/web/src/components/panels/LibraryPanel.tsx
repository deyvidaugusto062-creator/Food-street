import { useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Blend,
  Film,
  Image as ImageIcon,
  Import,
  Layers,
  Mic,
  MoreVertical,
  Music,
  Palette,
  Plus,
  Shapes,
  Sparkles,
  Square,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import { Button, ColorInput, DropdownMenu, EmptyState, IconButton, ProgressBar, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, toast, cx } from '@framestudio/ui';
import { EFFECT_DEFS, TRANSITION_DEFS } from '@framestudio/editor-core';
import { createAdjustmentClip } from '@framestudio/timeline';
import { AiStudioPanel } from './AiStudioPanel.tsx';
import { parseCubeLut } from '@framestudio/render-engine';
import { ACCEPT_ATTRIBUTE } from '@framestudio/media-engine';
import { errorMessage, formatDuration, type EffectType, type MediaAsset } from '@framestudio/shared';
import { useEditor } from '../../state/editor.ts';
import { createProxy, importFiles, relinkAsset, useMediaCache } from '../../services/media.ts';
import { COLOR_PRESETS, STICKERS, TEXT_PRESETS } from '../../services/presets.ts';
import { GRAPHICS, createGraphicAsset } from '../../services/graphics.ts';
import { dragState } from '../../lib/dnd.ts';
import { pickFiles } from '../../lib/download.ts';
import * as A from '../../lib/actions.ts';

type LibTab = 'media' | 'text' | 'audio' | 'elements' | 'effects' | 'transitions' | 'filters' | 'ai';

const TAB_DEFS: { id: LibTab; label: string; icon: React.ReactNode }[] = [
  { id: 'media', label: 'Mídia', icon: <Film size={13} /> },
  { id: 'text', label: 'Texto', icon: <Type size={13} /> },
  { id: 'audio', label: 'Áudio', icon: <Music size={13} /> },
  { id: 'elements', label: 'Elementos', icon: <Shapes size={13} /> },
  { id: 'effects', label: 'Efeitos', icon: <Sparkles size={13} /> },
  { id: 'transitions', label: 'Transições', icon: <Blend size={13} /> },
  { id: 'filters', label: 'Filtros', icon: <Palette size={13} /> },
  { id: 'ai', label: 'AI Studio', icon: <Wand2 size={13} /> },
];

export function LibraryPanel({ missing }: { missing: Set<string> }) {
  return <LibraryTabs initial="media" missing={missing} />;
}

/** Abas da biblioteca (também usadas nas folhas da interface mobile, com `only`). */
export function LibraryTabs({ initial, only, missing }: { initial: LibTab; only?: LibTab[]; missing: Set<string> }) {
  const [tab, setTab] = useState<string>(initial);
  const tabs = TAB_DEFS.filter((t) => !only || only.includes(t.id));
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col">
      {tabs.length > 1 && (
        <TabsList className="flex shrink-0 flex-wrap gap-0.5 border-b border-line p-1.5">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.icon} {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tabs.some((t) => t.id === 'media') && (
          <TabsContent value="media">
            <MediaTab missing={missing} />
          </TabsContent>
        )}
        <TabsContent value="text">
          <TextTab />
        </TabsContent>
        <TabsContent value="audio">
          <AudioTab />
        </TabsContent>
        <TabsContent value="elements">
          <ElementsTab />
        </TabsContent>
        <TabsContent value="effects">
          <EffectsTab />
        </TabsContent>
        <TabsContent value="transitions">
          <TransitionsTab />
        </TabsContent>
        <TabsContent value="filters">
          <FiltersTab />
        </TabsContent>
        <TabsContent value="ai">
          <AiStudioPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export async function importAndAdd(files: File[], addToTimeline = false): Promise<void> {
  const added: string[] = [];
  await importFiles(files, (asset) => {
    useEditor.getState().dispatch({ type: 'asset.add', asset });
    added.push(asset.id);
  });
  if (addToTimeline) for (const id of added) A.appendAsset(id);
}

function MediaTab({ missing }: { missing: Set<string> }) {
  const project = useEditor((s) => s.project)!;
  const importing = useMediaCache((s) => s.importing);
  const [filter, setFilter] = useState<'all' | 'video' | 'image' | 'audio'>('all');
  const [over, setOver] = useState(false);
  const assets = useMemo(
    () =>
      Object.values(project.assets)
        .filter((a) => filter === 'all' || a.kind === filter)
        .sort((a, b) => b.createdAt - a.createdAt),
    [project.assets, filter],
  );
  const onFiles = (files: File[]) => files.length && void importAndAdd(files);
  return (
    <div
      className={cx('flex min-h-full flex-col gap-3 p-3', over && 'bg-accent/5 outline-2 -outline-offset-4 outline-dashed outline-accent')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <Button variant="primary" icon={<Upload size={15} />} onClick={() => void pickFiles(ACCEPT_ATTRIBUTE).then(onFiles)} data-testid="import-media">
        Importar mídia
      </Button>
      {importing.map((i) => (
        <div key={i.name} className="rounded-lg border border-line bg-bg-2 p-2 text-xs text-fg-muted">
          <div className="mb-1.5 flex items-center gap-2">
            <Spinner size={12} /> <span className="truncate">Analisando {i.name}…</span>
          </div>
          <ProgressBar value={0} indeterminate />
        </div>
      ))}
      <div className="flex gap-1">
        {(['all', 'video', 'image', 'audio'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cx('rounded-md px-2 py-1 text-[11px] font-medium', filter === f ? 'bg-panel-3 text-fg' : 'text-fg-muted hover:text-fg')}>
            {{ all: 'Todos', video: 'Vídeos', image: 'Fotos', audio: 'Áudios' }[f]}
          </button>
        ))}
      </div>
      {assets.length === 0 ? (
        <EmptyState icon={<Import size={26} />} title="Arraste arquivos para cá">
          MP4, MOV, WebM, MKV, MP3, WAV, AAC, PNG, JPG, WebP e GIF. Os arquivos originais não são alterados.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-2" data-testid="media-grid">
          {assets.map((a) => (
            <AssetCard key={a.id} asset={a} missing={missing.has(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset, missing }: { asset: MediaAsset; missing: boolean }) {
  const thumb = useMediaCache((s) => s.thumbs[asset.id]?.[0]);
  const status = useMediaCache((s) => s.status[asset.id]);
  const proxy = useMediaCache((s) => s.proxy[asset.id]);
  const used = useEditor((s) => Object.values(s.project!.clips).some((c) => 'assetId' in c && c.assetId === asset.id));
  const relink = async () => {
    const [file] = await pickFiles(ACCEPT_ATTRIBUTE, false);
    if (!file) return;
    try {
      const patch = await relinkAsset(asset, file);
      useEditor.getState().dispatch({ type: 'asset.update', assetId: asset.id, patch });
      toast({ kind: 'success', title: `Mídia “${asset.name}” localizada` });
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível vincular', description: errorMessage(e) });
    }
  };
  const items = [
    { label: 'Adicionar no playhead', onSelect: () => A.addAsset(asset.id), disabled: missing },
    { label: 'Adicionar ao final', onSelect: () => A.appendAsset(asset.id), disabled: missing },
    ...(asset.kind === 'video'
      ? [
          {
            label: asset.proxyKey ? 'Proxy pronto' : 'Gerar proxy (edição leve)',
            disabled: !!asset.proxyKey || typeof proxy === 'number' || missing,
            onSelect: () =>
              void createProxy(asset)
                .then((key) => {
                  useEditor.getState().dispatch({ type: 'asset.update', assetId: asset.id, patch: { proxyKey: key } });
                  toast({ kind: 'success', title: 'Proxy gerado', description: asset.name });
                })
                .catch((e) => toast({ kind: 'error', title: 'Falha ao gerar proxy', description: errorMessage(e) })),
          },
        ]
      : []),
    { label: missing ? 'Localizar arquivo…' : 'Substituir arquivo…', onSelect: () => void relink() },
    { separator: true, label: '' },
    { label: used ? 'Remover (e seus clipes)' : 'Remover do projeto', danger: true, onSelect: () => useEditor.getState().dispatch({ type: 'asset.remove', assetId: asset.id }) },
  ];
  return (
    <div
      className={cx('group relative overflow-hidden rounded-lg border bg-bg-2', missing ? 'border-danger' : 'border-line hover:border-accent/60')}
      draggable={!missing}
      onDragStart={(e) => {
        dragState.kind = 'asset';
        dragState.payload = asset.id;
        e.dataTransfer.setData('text/plain', asset.name);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => (dragState.kind = null)}
      onDoubleClick={() => !missing && A.addAsset(asset.id)}
      data-testid="asset-card"
      data-asset-kind={asset.kind}
    >
      <div className="relative flex aspect-video items-center justify-center bg-black/40">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : asset.kind === 'audio' ? (
          <AudioLines size={22} className="text-clip-audio" />
        ) : status === 'processing' ? (
          <Spinner size={14} className="text-fg-subtle" />
        ) : asset.kind === 'image' ? (
          <ImageIcon size={20} className="text-fg-subtle" />
        ) : (
          <Film size={20} className="text-fg-subtle" />
        )}
        {asset.duration > 0 && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white">{formatDuration(asset.duration)}</span>}
        {missing && <span className="absolute left-1 top-1 rounded bg-danger px-1 text-[9px] font-semibold text-white">AUSENTE</span>}
        {asset.proxyKey && <span className="absolute left-1 top-1 rounded bg-blue px-1 text-[9px] font-semibold text-white">PROXY</span>}
        {typeof proxy === 'number' && <ProgressBar value={proxy} className="absolute inset-x-1 bottom-1 h-1" />}
        <button
          className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded-md bg-accent text-white shadow group-hover:flex"
          onClick={() => A.appendAsset(asset.id)}
          aria-label={`Adicionar ${asset.name} à timeline`}
          data-testid="asset-add"
          disabled={missing}
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted" title={`${asset.name}\n${asset.width ? `${asset.width}×${asset.height} · ` : ''}${asset.videoCodec ?? ''} ${asset.audioCodec ?? ''}`}>
          {asset.name}
        </span>
        <DropdownMenu items={items} align="end">
          <IconButton label="Ações da mídia" size="sm" tooltip={false} className="size-5">
            <MoreVertical size={12} />
          </IconButton>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Draggable({ kind, payload, children, onClick, className, testId }: { kind: 'text' | 'effect' | 'transition'; payload: string; children: React.ReactNode; onClick: () => void; className?: string; testId?: string }) {
  return (
    <button
      draggable
      onDragStart={(e) => {
        dragState.kind = kind;
        dragState.payload = payload;
        e.dataTransfer.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => (dragState.kind = null)}
      onClick={onClick}
      className={cx('rounded-lg border border-line bg-bg-2 text-left transition-colors hover:border-accent/60 hover:bg-panel-2', className)}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function TextTab() {
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {TEXT_PRESETS.map((p) => (
        <Draggable key={p.id} kind="text" payload={JSON.stringify(p.style)} onClick={() => A.addText(p.style)} className="flex h-20 flex-col items-center justify-center gap-1 p-2" testId={`text-preset-${p.id}`}>
          <span
            className="max-w-full truncate text-lg leading-none"
            style={{ fontFamily: p.style.fontFamily, fontWeight: p.style.fontWeight, fontStyle: p.style.italic ? 'italic' : undefined, color: p.style.color && p.style.color !== '#101014' ? p.style.color : undefined }}
          >
            {p.label === 'Texto livre' ? 'Aa' : p.label}
          </span>
          <span className="text-[10px] text-fg-subtle">{p.label}</span>
        </Draggable>
      ))}
    </div>
  );
}

function AudioTab() {
  const [rec, setRec] = useState<{ recorder: MediaRecorder; start: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const assets = useEditor((s) => Object.values(s.project!.assets).filter((a) => a.kind === 'audio' || (a.kind === 'video' && a.hasAudio)));

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File(chunks, `Narração ${new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-')}.${ext}`, { type: type.includes('mp4') ? 'audio/mp4' : 'audio/webm' });
        void importFiles([file], (asset) => {
          useEditor.getState().dispatch({ type: 'asset.add', asset });
          A.addAsset(asset.id, A.playheadFrame());
        });
      };
      recorder.start(250);
      const start = Date.now();
      setRec({ recorder, start });
      timer.current = setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    } catch (e) {
      toast({ kind: 'error', title: 'Microfone indisponível', description: errorMessage(e) });
    }
  };
  const stopRec = () => {
    rec?.recorder.stop();
    setRec(null);
    if (timer.current) clearInterval(timer.current);
    setElapsed(0);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <Button icon={<Upload size={15} />} onClick={() => void pickFiles('.mp3,.wav,.aac,.m4a,.ogg,.opus,.flac,audio/*').then((f) => { if (f.length) void importAndAdd(f); })}>
        Importar música ou narração
      </Button>
      <div className="rounded-xl border border-line bg-bg-2 p-3">
        <p className="text-xs font-medium text-fg">Gravar narração</p>
        <p className="mt-1 text-[11px] text-fg-muted">Grava do microfone e insere no playhead numa faixa de áudio. O áudio fica só neste dispositivo.</p>
        {rec ? (
          <Button className="mt-3 w-full" variant="danger" icon={<Square size={13} fill="currentColor" />} onClick={stopRec}>
            Parar ({formatDuration(elapsed)})
          </Button>
        ) : (
          <Button className="mt-3 w-full" icon={<Mic size={14} />} onClick={() => void startRec()}>
            Iniciar gravação
          </Button>
        )}
      </div>
      <p className="text-[11px] text-fg-subtle">
        O FrameStudio não inclui músicas de terceiros. Use apenas áudios com licença adequada.
      </p>
      {assets.length > 0 && (
        <div className="flex flex-col gap-1">
          {assets.map((a) => (
            <button key={a.id} onClick={() => A.addAsset(a.id)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-panel-2 hover:text-fg">
              <AudioLines size={13} className="text-clip-audio" />
              <span className="flex-1 truncate">{a.name}</span>
              <span className="font-mono text-[10px]">{formatDuration(a.duration)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ElementsTab() {
  const [color, setColor] = useState('#8257FF');
  const [busy, setBusy] = useState<string | null>(null);
  const addGraphic = async (id: string) => {
    const def = GRAPHICS.find((g) => g.id === id)!;
    setBusy(id);
    try {
      const asset = await createGraphicAsset(def, color);
      const s = useEditor.getState();
      s.dispatch({ type: 'asset.add', asset });
      const overlay = s.project!.tracks.find((t) => t.kind === 'text' && !t.locked);
      const clipId = A.addAsset(asset.id, A.playheadFrame(), overlay?.id);
      if (clipId) s.dispatch({ type: 'clip.update', clipIds: [clipId], patch: { transform: { scale: 0.4 } } }, { coalesce: `graphic:${clipId}` });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-4 p-3">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Stickers</p>
        <div className="grid grid-cols-5 gap-1.5">
          {STICKERS.map((s) => (
            <button
              key={s}
              className="flex aspect-square items-center justify-center rounded-lg border border-line bg-bg-2 text-2xl hover:border-accent/60"
              onClick={() => A.addText({ content: s, fontSize: 200, shadow: { enabled: false, color: '#000', blur: 0, x: 0, y: 0 }, animationIn: 'pop' }, 3)}
              aria-label={`Sticker ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Formas</p>
          <div className="w-32">
            <ColorInput value={color} onChange={setColor} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {GRAPHICS.map((g) => (
            <button key={g.id} onClick={() => void addGraphic(g.id)} disabled={!!busy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-line bg-bg-2 text-[10px] text-fg-muted hover:border-accent/60">
              {busy === g.id ? <Spinner size={14} /> : <Layers size={16} style={{ color }} />}
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const s = useEditor.getState();
          const p = s.project!;
          const overlay = p.tracks.find((t) => t.kind === 'text' && !t.locked) ?? p.tracks.find((t) => t.kind === 'video' && !t.locked);
          if (overlay) s.dispatch({ type: 'clip.insert', clip: createAdjustmentClip(overlay.id, A.playheadFrame(), p.settings.fps * 5) }, { select: true });
        }}
      >
        Camada de ajuste (cor/efeitos em tudo abaixo)
      </Button>
    </div>
  );
}

function EffectsTab() {
  const selection = useEditor((s) => s.selection);
  const groups = useMemo(() => {
    const g: Record<string, (typeof EFFECT_DEFS)[EffectType][]> = {};
    for (const d of Object.values(EFFECT_DEFS)) (g[d.category] ??= []).push(d);
    return g;
  }, []);
  const apply = (type: EffectType) => {
    const s = useEditor.getState();
    const targets = selection.filter((id) => 'effects' in (s.project!.clips[id] ?? {}));
    if (!targets.length) {
      toast({ kind: 'info', title: 'Selecione um clipe visual', description: 'Ou arraste o efeito até um clipe na timeline.' });
      return;
    }
    s.dispatch({ type: 'effect.add', clipIds: targets, effect: type });
  };
  return (
    <div className="flex flex-col gap-4 p-3">
      {Object.entries(groups).map(([cat, defs]) => (
        <div key={cat}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{cat}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {defs.map((d) => (
              <Draggable key={d.type} kind="effect" payload={d.type} onClick={() => apply(d.type)} className="p-2" testId={`effect-${d.type}`}>
                <p className="text-xs font-medium text-fg">{d.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-fg-subtle">{d.description}</p>
              </Draggable>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransitionsTab() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-[11px] text-fg-muted">Selecione um clipe e clique numa transição, ou arraste-a até o corte entre dois clipes encostados.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {TRANSITION_DEFS.map((t) => (
          <Draggable key={t.type} kind="transition" payload={t.type} onClick={() => A.addTransitionToSelection(t.type)} className="flex items-center gap-2 p-2.5" testId={`transition-${t.type}`}>
            <Blend size={14} className="text-accent-soft" />
            <span className="text-xs font-medium text-fg">{t.label}</span>
          </Draggable>
        ))}
      </div>
    </div>
  );
}

function FiltersTab() {
  const selection = useEditor((s) => s.selection);
  const apply = (color: object) => {
    const s = useEditor.getState();
    const targets = selection.filter((id) => 'color' in (s.project!.clips[id] ?? {}));
    if (!targets.length) {
      toast({ kind: 'info', title: 'Selecione um clipe visual para aplicar o filtro' });
      return;
    }
    const neutral = { exposure: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, hue: 0, shadows: 0, highlights: 0, blacks: 0, whites: 0, gamma: 1, vibrance: 0, hsl: undefined };
    s.dispatch({ type: 'clip.update', clipIds: targets, patch: { color: { ...neutral, ...color } } });
  };
  const importLut = async () => {
    const [file] = await pickFiles('.cube', false);
    if (!file) return;
    try {
      const lut = parseCubeLut(await file.text(), file.name.replace(/\.cube$/i, ''));
      const s = useEditor.getState();
      s.dispatch({ type: 'lut.add', lut });
      const targets = selection.filter((id) => 'color' in (s.project!.clips[id] ?? {}));
      if (targets.length) s.dispatch({ type: 'clip.update', clipIds: targets, patch: { color: { lutId: lut.id, lutIntensity: 1 } } });
      toast({ kind: 'success', title: `LUT “${lut.name}” importado`, description: targets.length ? 'Aplicado aos clipes selecionados.' : 'Selecione um clipe e escolha o LUT em Cor.' });
    } catch (e) {
      toast({ kind: 'error', title: 'LUT inválido', description: errorMessage(e) });
    }
  };
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-3 gap-2">
        {COLOR_PRESETS.map((p) => (
          <button key={p.id} onClick={() => apply(p.color)} className="flex flex-col items-center gap-1 text-[10px] text-fg-muted hover:text-fg" data-testid={`filter-${p.id}`}>
            <span className="aspect-square w-full rounded-lg border border-line" style={{ background: p.swatch }} />
            {p.label}
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" icon={<Upload size={13} />} onClick={() => void importLut()}>
        Importar LUT (.cube)
      </Button>
    </div>
  );
}
