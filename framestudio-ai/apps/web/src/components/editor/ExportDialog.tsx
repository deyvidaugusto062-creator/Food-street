import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FolderOpen, Film, AlertTriangle } from 'lucide-react';
import { Button, Dialog, Field, NumberField, ProgressBar, Select, Spinner, Switch, TextInput } from '@framestudio/ui';
import { AUDIO_CODEC_LABEL, VIDEO_CODEC_LABEL, detectExportCapabilities, type ExportCapabilities } from '@framestudio/media-engine';
import { estimateExportBytes, exportProject, outputSize, type ExportProgress } from '@framestudio/render-engine';
import { hasAudibleAudio } from '@framestudio/audio-engine';
import { errorMessage, isCancelled, type ExportFormat, type ExportSettings } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import { useEditor } from '../../state/editor.ts';
import { audioStore, getAssetBlob } from '../../services/media.ts';
import { canPickSaveFile, downloadBlob, pickSaveFile, sanitizeFileName } from '../../lib/download.ts';
import { formatBytes } from '../../lib/format.ts';
import * as A from '../../lib/actions.ts';

const HEIGHTS = [480, 720, 1080, 1440, 2160];
const FPS = [24, 25, 30, 50, 60];

type Phase = { kind: 'config' } | { kind: 'running'; progress: ExportProgress } | { kind: 'done'; url?: string; bytes: number; name: string; warnings: string[]; savedToDisk: boolean; seconds: number } | { kind: 'error'; message: string };

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const project = useEditor((s) => s.project)!;
  const [caps, setCaps] = useState<ExportCapabilities | null>(null);
  const [s, setS] = useState<ExportSettings>(project.exportSettings);
  const [phase, setPhase] = useState<Phase>({ kind: 'config' });
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const abort = useRef<AbortController | null>(null);
  const resultBlob = useRef<Blob | null>(null);
  const aspect = project.settings.width / project.settings.height;
  const hasCaptions = Object.values(project.clips).some((c) => c.type === 'caption');
  const withAudio = hasAudibleAudio(project);

  useEffect(() => {
    if (!open) return;
    setPhase({ kind: 'config' });
    setS({ ...project.exportSettings, fileName: project.exportSettings.fileName || project.name });
    setHandle(null);
    let alive = true;
    detectExportCapabilities(aspect)
      .then((c) => alive && setCaps(c))
      .catch(() => alive && setCaps({ formats: [], maxHeight: {} }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Ajusta as escolhas ao que o dispositivo suporta.
  useEffect(() => {
    if (!caps || caps.formats.length === 0) return;
    setS((cur) => {
      const fmt = caps.formats.find((f) => f.format === cur.format) ?? caps.formats[0]!;
      const videoCodec = fmt.videoCodecs.includes(cur.videoCodec) ? cur.videoCodec : fmt.videoCodecs[0]!;
      const audioCodec = fmt.audioCodecs.includes(cur.audioCodec) ? cur.audioCodec : (fmt.audioCodecs[0] ?? cur.audioCodec);
      const maxH = caps.maxHeight[videoCodec] ?? 1080;
      const height = cur.height && cur.height > maxH ? maxH : cur.height;
      if (fmt.format === cur.format && videoCodec === cur.videoCodec && audioCodec === cur.audioCodec && height === cur.height) return cur;
      return { ...cur, format: fmt.format, videoCodec, audioCodec, height };
    });
  }, [caps, s.format, s.videoCodec]);

  const fmtCap = caps?.formats.find((f) => f.format === s.format);
  const maxH = caps?.maxHeight[s.videoCodec] ?? 1080;
  const projectShort = Math.min(project.settings.width, project.settings.height);
  const out = outputSize(project, s.height);
  const estimate = useMemo(() => estimateExportBytes(project, s), [project, s]);
  const durationSec = projectDuration(project) / project.settings.fps;
  const audioBlocked = withAudio && fmtCap && fmtCap.audioCodecs.length === 0;
  const empty = durationSec <= 0;

  const start = async () => {
    const name = `${sanitizeFileName(s.fileName || project.name)}.${s.format}`;
    useEditor.getState().dispatch({ type: 'project.exportSettings', patch: s }, { silent: true });
    A.pause();
    const ac = new AbortController();
    abort.current = ac;
    const began = performance.now();
    setPhase({ kind: 'running', progress: { phase: 'preparing', progress: 0, frame: 0, totalFrames: 0, renderFps: 0, etaSeconds: null } });
    let writable: FileSystemWritableFileStream | undefined;
    try {
      if (handle) writable = await handle.createWritable();
      const res = await exportProject({
        project: useEditor.getState().project!,
        settings: s,
        loadBlob: (id) => getAssetBlob(id),
        audio: audioStore,
        writable: writable as unknown as WritableStream | undefined,
        signal: ac.signal,
        onProgress: (progress) => setPhase({ kind: 'running', progress }),
      });
      if (writable) await writable.close();
      resultBlob.current = res.blob ?? null;
      const url = res.blob ? URL.createObjectURL(res.blob) : undefined;
      setPhase({ kind: 'done', url, bytes: res.blob?.size ?? (handle ? (await handle.getFile()).size : 0), name: handle?.name ?? name, warnings: res.warnings, savedToDisk: !!handle, seconds: (performance.now() - began) / 1000 });
      if (res.blob && !handle) downloadBlob(res.blob, name);
    } catch (e) {
      await writable?.abort().catch(() => {});
      if (isCancelled(e)) setPhase({ kind: 'config' });
      else setPhase({ kind: 'error', message: errorMessage(e) });
    } finally {
      abort.current = null;
    }
  };

  const close = (o: boolean) => {
    if (!o && phase.kind === 'running') return;
    if (!o && phase.kind === 'done' && phase.url) URL.revokeObjectURL(phase.url);
    onOpenChange(o);
  };

  const qualityLabel = { low: 'Baixa', medium: 'Média', high: 'Alta', 'very-high': 'Muito alta', custom: 'Personalizada (bitrate)' };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Exportar vídeo"
      description="Renderização local, quadro a quadro, com o mesmo motor do preview."
      size="lg"
      footer={
        phase.kind === 'running' ? (
          <Button variant="danger" onClick={() => abort.current?.abort()} data-testid="export-cancel">
            Cancelar exportação
          </Button>
        ) : phase.kind === 'done' ? (
          <>
            {resultBlob.current && (
              <Button icon={<Download size={14} />} onClick={() => downloadBlob(resultBlob.current!, phase.name)}>
                Baixar novamente
              </Button>
            )}
            <Button variant="primary" onClick={() => close(false)}>
              Concluir
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant="primary" icon={<Film size={14} />} onClick={() => void start()} disabled={!caps || !fmtCap || empty || !!audioBlocked} data-testid="export-start">
              Exportar
            </Button>
          </>
        )
      }
    >
      {phase.kind === 'running' ? (
        <RunningView p={phase.progress} />
      ) : phase.kind === 'done' ? (
        <div className="flex flex-col gap-4" data-testid="export-done">
          <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
            <CheckCircle2 className="text-success" />
            <div>
              <p className="text-sm font-medium text-fg">Exportação concluída</p>
              <p className="text-xs text-fg-muted">
                {phase.name} · {formatBytes(phase.bytes)} · {phase.seconds.toFixed(1)} s {phase.savedToDisk ? '· salvo no arquivo escolhido' : '· enviado para Downloads'}
              </p>
            </div>
          </div>
          {phase.url && <video src={phase.url} controls className="max-h-72 w-full rounded-lg bg-black" data-testid="export-result" />}
          {phase.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {phase.kind === 'error' && (
            <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger" role="alert">
              {phase.message}
            </p>
          )}
          {!caps ? (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <Spinner /> Verificando o que este dispositivo consegue exportar…
            </div>
          ) : caps.formats.length === 0 ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              Este navegador não oferece codificação de vídeo (WebCodecs). Use Chrome, Edge ou Safari recentes, ou o app desktop.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nome do arquivo">
                  <TextInput value={s.fileName} onChange={(e) => setS({ ...s, fileName: e.target.value })} data-testid="export-name" />
                </Field>
                <Field label="Destino" hint={canPickSaveFile() ? 'Grava direto no disco durante a exportação.' : 'O arquivo será baixado ao final.'}>
                  {canPickSaveFile() ? (
                    <Button
                      icon={<FolderOpen size={14} />}
                      onClick={async () => {
                        try {
                          const h = await pickSaveFile(`${sanitizeFileName(s.fileName || project.name)}.${s.format}`, `video/${s.format === 'mov' ? 'quicktime' : s.format}`, s.format);
                          setHandle(h);
                        } catch {
                          /* cancelado */
                        }
                      }}
                    >
                      {handle ? handle.name : 'Escolher arquivo…'}
                    </Button>
                  ) : (
                    <div className="flex h-9 items-center rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg-muted">Downloads</div>
                  )}
                </Field>
                <Field label="Formato">
                  <Select<ExportFormat>
                    value={s.format}
                    onChange={(format) => {
                      setS({ ...s, format });
                      setHandle(null);
                    }}
                    ariaLabel="Formato"
                    options={caps.formats.map((f) => ({ value: f.format, label: f.format.toUpperCase() }))}
                  />
                </Field>
                <Field label="Codec de vídeo">
                  <Select value={s.videoCodec} onChange={(videoCodec) => setS({ ...s, videoCodec })} ariaLabel="Codec de vídeo" options={(fmtCap?.videoCodecs ?? []).map((c) => ({ value: c, label: VIDEO_CODEC_LABEL[c] }))} />
                </Field>
                <Field label="Resolução">
                  <Select
                    value={String(s.height)}
                    onChange={(v) => setS({ ...s, height: Number(v) })}
                    ariaLabel="Resolução"
                    options={[
                      { value: '0', label: `Do projeto (${project.settings.width}×${project.settings.height})`, disabled: projectShort > maxH },
                      ...HEIGHTS.map((h) => ({ value: String(h), label: h === 2160 ? '4K (2160p)' : `${h}p`, disabled: h > maxH })),
                    ]}
                  />
                </Field>
                <Field label="Taxa de quadros">
                  <Select value={String(s.fps)} onChange={(v) => setS({ ...s, fps: Number(v) })} ariaLabel="FPS" options={FPS.map((f) => ({ value: String(f), label: `${f} fps` }))} />
                </Field>
                <Field label="Qualidade">
                  <Select value={s.quality} onChange={(quality) => setS({ ...s, quality })} ariaLabel="Qualidade" options={Object.entries(qualityLabel).map(([value, label]) => ({ value: value as ExportSettings['quality'], label }))} />
                </Field>
                {s.quality === 'custom' ? (
                  <Field label="Bitrate de vídeo">
                    <NumberField value={s.videoBitrate / 1e6} onChange={(v) => setS({ ...s, videoBitrate: Math.round(v * 1e6) })} min={0.2} max={200} step={0.5} suffix="Mbps" />
                  </Field>
                ) : (
                  <Field label="Áudio">
                    <Select
                      value={s.audioCodec}
                      onChange={(audioCodec) => setS({ ...s, audioCodec })}
                      ariaLabel="Codec de áudio"
                      disabled={!withAudio}
                      options={(fmtCap?.audioCodecs ?? []).map((c) => ({ value: c, label: `${AUDIO_CODEC_LABEL[c]} · ${Math.round(s.audioBitrate / 1000)} kbps` }))}
                    />
                  </Field>
                )}
              </div>
              {hasCaptions && <Switch checked={s.burnCaptions} onChange={(burnCaptions) => setS({ ...s, burnCaptions })} label="Incorporar legendas ao vídeo" />}
              {audioBlocked && <p className="text-xs text-warning">Este formato não tem codec de áudio disponível neste dispositivo. Escolha outro formato.</p>}
              {empty && <p className="text-xs text-warning">Adicione clipes à timeline antes de exportar.</p>}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg-2 p-3 text-xs sm:grid-cols-4">
                <Info label="Saída" value={`${out.width}×${out.height}`} />
                <Info label="Duração" value={`${durationSec.toFixed(1)} s`} />
                <Info label="Áudio" value={withAudio ? AUDIO_CODEC_LABEL[s.audioCodec] : 'Sem áudio'} />
                <Info label="Tamanho estimado" value={`~${formatBytes(estimate)}`} />
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg-subtle">{label}</p>
      <p className="font-medium text-fg">{value}</p>
    </div>
  );
}

function RunningView({ p }: { p: ExportProgress }) {
  const label = { preparing: 'Preparando…', audio: 'Mixando áudio…', video: 'Renderizando e codificando…', finalizing: 'Finalizando arquivo…', done: 'Concluído' }[p.phase];
  return (
    <div className="flex flex-col gap-3" data-testid="export-progress">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="font-mono text-sm text-fg">{Math.round(p.progress * 100)}%</p>
      </div>
      <ProgressBar value={p.progress} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-fg-muted">
        <span>
          Quadro {p.frame} de {p.totalFrames || '…'}
        </span>
        <span>{p.renderFps ? `${p.renderFps.toFixed(1)} quadros/s` : ''}</span>
        <span>{p.etaSeconds !== null ? `~${Math.ceil(p.etaSeconds)} s restantes` : ''}</span>
      </div>
      <p className="text-[11px] text-fg-subtle">Você pode continuar navegando; mantenha esta aba aberta até o fim.</p>
    </div>
  );
}
