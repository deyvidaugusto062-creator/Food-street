import { useMemo, useRef, useState } from 'react';
import { Bot, Captions, Crop, Download, Languages, Lightbulb, Scissors, Search, Sparkles, Volume1, VolumeX, Wand2, Film, ImageOff } from 'lucide-react';
import { Button, Dialog, ProgressBar, Section, Select, Slider, Switch, TextInput, toast, cx } from '@framestudio/ui';
import {
  COMMAND_EXAMPLES,
  WHISPER_MODELS,
  analyzeProject,
  buildCaptionChunks,
  chunksToCaptionOps,
  interpretCommand,
  interpretWithLlm,
  isAudible,
  planDucking,
  reframeKeyframes,
  searchTranscript,
  silenceRemovalOps,
  suggestHighlights,
  suggestSilenceCuts,
  suggestTranscriptCuts,
  translateLines,
  type CommandPlan,
  type Highlight,
  type Suggestion,
  type TimedWord,
  type WhisperLanguage,
} from '@framestudio/ai-engine';
import { normalizationGain } from '@framestudio/audio-engine';
import type { EditOp } from '@framestudio/editor-core';
import { createProject, errorMessage, formatDuration, isCancelled, type AudioClip, type CaptionClip, type Clip, type Project, type VideoClip } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import { estimateStorage } from '@framestudio/project-storage';
import { useEditor } from '../../state/editor.ts';
import { useSettings } from '../../services/settings.ts';
import { analyzeSubject, assetPcm, isModelCached, transcribeProject, type TranscribeProgress } from '../../services/ai.ts';
import { exportCaptions, captionClips } from '../../services/captions.ts';
import { repo } from '../../services/repo.ts';
import { formatBytes } from '../../lib/format.ts';
import { navigate } from '../../lib/route.ts';
import * as A from '../../lib/actions.ts';

const ed = () => useEditor.getState();

function apply(ops: EditOp[], label: string): boolean {
  if (!ops.length) return false;
  return !!ed().dispatch({ type: 'batch', ops, label });
}

export function AiStudioPanel() {
  return (
    <div className="flex flex-col" data-testid="ai-studio">
      <p className="px-3 pt-3 text-[11px] text-fg-muted">
        Ferramentas que sugerem ações — você revisa antes de aplicar. Tudo roda localmente, exceto o provedor de IA opcional (desligado por padrão).
      </p>
      <AssistantSection />
      <CaptionsSection />
      <SilenceSection />
      <SmartCutsSection />
      <ReframeSection />
      <AudioToolsSection />
      <SuggestionsSection />
      <HighlightsSection />
      <Section title={<span className="flex items-center gap-1.5"><ImageOff size={12} /> Remoção de fundo</span>} defaultOpen={false}>
        <p className="text-[11px] text-fg-muted">
          Ainda não disponível: requer um modelo de segmentação compatível e testado. Enquanto isso, use o efeito Chroma key (aba Efeitos) para fundos verdes/azuis.
        </p>
      </Section>
    </div>
  );
}

// ─────────────────────────── IA 5 — Assistente ───────────────────────────

function AssistantSection() {
  const ai = useSettings((s) => s.ai);
  const [cmd, setCmd] = useState('');
  const [plan, setPlan] = useState<CommandPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toolRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    const s = ed();
    if (!s.project) return;
    const ctx = { project: s.project, selection: s.selection, playhead: Math.round(s.playhead) };
    let p = interpretCommand(cmd, ctx);
    if (!p.ok && ai.enabled && ai.apiKey) {
      setBusy(true);
      try {
        p = await interpretWithLlm(ai, cmd, ctx);
      } catch (e) {
        p = { ok: false, message: `Provedor de IA indisponível: ${errorMessage(e)}`, examples: [] };
      } finally {
        setBusy(false);
      }
    }
    setPlan(p);
    if (p.ok && p.tool) {
      toast({ kind: 'info', title: p.summary, description: 'Abra a ferramenta correspondente abaixo para analisar e revisar.' });
      toolRef.current?.parentElement?.querySelector(`[data-tool="${p.tool}"]`)?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  const doApply = () => {
    if (!plan?.ok || plan.tool) return;
    if (apply(plan.ops, plan.summary)) {
      toast({ kind: 'success', title: 'Comando aplicado', description: `${plan.summary}. Use Ctrl+Z para desfazer.` });
      setPlan(null);
      setCmd('');
    }
    setConfirm(false);
  };
  return (
    <Section title={<span className="flex items-center gap-1.5"><Bot size={12} /> Assistente de edição</span>}>
      <div ref={toolRef} className="flex gap-1.5">
        <TextInput
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') void run();
          }}
          placeholder="Ex.: Corte os primeiros 5 segundos"
          aria-label="Comando para o assistente"
          data-testid="ai-command"
        />
        <Button variant="primary" onClick={() => void run()} loading={busy} disabled={!cmd.trim()} data-testid="ai-run">
          <Wand2 size={14} />
        </Button>
      </div>
      {plan && !plan.ok && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-2 text-[11px] text-fg-muted" role="status">
          {plan.message}
          {plan.examples.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plan.examples.slice(0, 6).map((ex) => (
                <button key={ex} className="rounded bg-panel-3 px-1.5 py-0.5 text-fg hover:bg-accent/30" onClick={() => setCmd(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {plan?.ok && !plan.tool && (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 p-2.5" data-testid="ai-plan">
          <p className="text-xs font-medium text-fg">Prévia: {plan.summary}</p>
          <p className="text-[11px] text-fg-muted">
            {plan.ops.length} operação(ões) · afeta {plan.affected} elemento(s)
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" onClick={() => (plan.requiresConfirmation ? setConfirm(true) : doApply())} data-testid="ai-apply">
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPlan(null)}>
              Descartar
            </Button>
          </div>
        </div>
      )}
      {!plan && (
        <div className="flex flex-wrap gap-1">
          {COMMAND_EXAMPLES.slice(0, 5).map((ex) => (
            <button key={ex} className="rounded bg-bg-2 px-1.5 py-0.5 text-[10px] text-fg-muted hover:text-fg" onClick={() => setCmd(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-fg-subtle">
        Interpretador local por regras (pt/en/es). {ai.enabled ? `Comandos livres usam ${ai.provider === 'anthropic' ? 'Claude' : 'o provedor configurado'} (somente o texto e um resumo do projeto são enviados).` : 'Ative um provedor em Configurações para comandos livres.'}
      </p>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Confirmar alteração"
        description={plan?.ok ? `${plan.summary}. Isso afeta ${plan.affected} elemento(s) e pode ser desfeito com Ctrl+Z.` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={doApply} data-testid="ai-confirm">
              Confirmar
            </Button>
          </>
        }
      />
    </Section>
  );
}

// ─────────────────────────── IA 1/6/9 — Legendas ───────────────────────────

function CaptionsSection() {
  const settings = useSettings();
  const project = useEditor((s) => s.project)!;
  const [lang, setLang] = useState<WhisperLanguage>('portuguese');
  const [voiceOnly, setVoiceOnly] = useState(true);
  const [wordMode, setWordMode] = useState<'phrase' | 'word'>('phrase');
  const [highlight, setHighlight] = useState(true);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [consent, setConsent] = useState<{ free: number | null } | null>(null);
  const [query, setQuery] = useState('');
  const [translating, setTranslating] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const model = WHISPER_MODELS[settings.whisperModel];
  const caps = captionClips(project);
  const words = useMemo<TimedWord[]>(() => {
    const fps = project.settings.fps;
    return caps.flatMap((c) => (c.words.length ? c.words.map((w) => ({ text: w.text, start: c.start / fps + w.start, end: c.start / fps + w.end })) : [{ text: c.text.content, start: c.start / fps, end: (c.start + c.duration) / fps }]));
  }, [caps, project.settings.fps]);
  const results = query ? searchTranscript(words, query) : [];

  const start = async (skipConsent = false) => {
    if (!skipConsent && !(await isModelCached(settings.whisperModel, settings.modelHost))) {
      const est = await estimateStorage();
      setConsent({ free: est ? est.quota - est.usage : null });
      return;
    }
    setConsent(null);
    const ac = new AbortController();
    abort.current = ac;
    setProgress({ stage: 'mix', progress: 0 });
    try {
      const w = await transcribeProject(ed().project!, { model: settings.whisperModel, language: lang, remoteHost: settings.modelHost, voiceOnly, onProgress: setProgress, signal: ac.signal });
      if (!w.length) throw new Error('Nenhuma fala reconhecida.');
      const chunks = buildCaptionChunks(w, { maxChars: project.settings.height > project.settings.width ? 28 : 42, maxDuration: 3.5, maxGap: 0.7, single: wordMode === 'word' });
      const res = ed().dispatch({ type: 'captions.set', captions: chunksToCaptionOps(chunks, project.settings.fps) }, { select: false });
      if (res && highlight) {
        const ids = Object.values(res.project.clips).filter((c) => c.type === 'caption').map((c) => c.id);
        ed().dispatch({ type: 'clip.update', clipIds: ids, patch: { caption: { highlightWords: true } } });
      }
      toast({ kind: 'success', title: `${chunks.length} legenda(s) geradas`, description: 'Edite o texto de cada legenda nas propriedades. Os tempos podem ser ajustados arrastando na timeline.' });
    } catch (e) {
      if (!isCancelled(e)) toast({ kind: 'error', title: 'Não foi possível gerar as legendas', description: `${errorMessage(e)}${/fetch|network|Failed/i.test(errorMessage(e)) ? ' — verifique a conexão para baixar o modelo ou configure um servidor de modelos próprio.' : ''}` });
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const translate = async () => {
    const ai = settings.ai;
    if (!ai.enabled || !ai.apiKey) return;
    const target = prompt('Traduzir para qual idioma? (ex.: inglês, espanhol)', 'inglês');
    if (!target) return;
    setTranslating(true);
    try {
      const list = captionClips(ed().project!);
      const out = await translateLines(ai, list.map((c) => c.text.content), target);
      apply(
        list.map((c, i) => ({ type: 'clip.update' as const, clipIds: [c.id], patch: { text: { content: out[i]! }, words: [] } })),
        'Traduzir legendas',
      );
      toast({ kind: 'success', title: `Legendas traduzidas para ${target}` });
    } catch (e) {
      toast({ kind: 'error', title: 'Falha na tradução', description: errorMessage(e) });
    } finally {
      setTranslating(false);
    }
  };

  const stageLabel = { mix: 'Preparando áudio…', download: 'Baixando modelo…', load: 'Carregando modelo…', transcribe: 'Transcrevendo (isso pode levar alguns minutos)…' };
  return (
    <Section title={<span className="flex items-center gap-1.5" data-tool="captions"><Captions size={12} /> Legendas automáticas</span>}>
      <div className="grid grid-cols-2 gap-2">
        <Select<WhisperLanguage>
          value={lang}
          onChange={setLang}
          ariaLabel="Idioma"
          className="h-8 text-xs"
          options={[
            { value: 'portuguese', label: 'Português (BR)' },
            { value: 'english', label: 'Inglês' },
            { value: 'spanish', label: 'Espanhol' },
            { value: 'auto', label: 'Detectar' },
          ]}
        />
        <Select value={settings.whisperModel} onChange={(whisperModel) => settings.set({ whisperModel })} ariaLabel="Modelo" className="h-8 text-xs" options={Object.entries(WHISPER_MODELS).map(([k, m]) => ({ value: k as 'tiny', label: `${k} · ~${m.approxMB} MB` }))} />
      </div>
      <Select
        value={wordMode}
        onChange={setWordMode}
        ariaLabel="Estilo"
        className="h-8 text-xs"
        options={[
          { value: 'phrase', label: 'Frases curtas' },
          { value: 'word', label: 'Uma palavra por legenda' },
        ]}
      />
      <Switch checked={highlight} onChange={setHighlight} label="Destacar a palavra falada" />
      <Switch checked={voiceOnly} onChange={setVoiceOnly} label="Ignorar faixas de música" />
      {progress ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-fg-muted">
            {stageLabel[progress.stage]} {progress.stage === 'download' && progress.detail ? `(${progress.detail.split('/').pop()})` : ''}
          </p>
          <ProgressBar value={progress.progress} indeterminate={progress.stage === 'transcribe' || progress.stage === 'mix'} />
          <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="sm" icon={<Captions size={13} />} onClick={() => void start()} data-testid="ai-captions">
          {caps.length ? 'Gerar novamente' : 'Gerar legendas'}
        </Button>
      )}
      {caps.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" icon={<Download size={12} />} onClick={() => exportCaptions(ed().project!, 'srt')}>
              SRT
            </Button>
            <Button size="sm" icon={<Download size={12} />} onClick={() => exportCaptions(ed().project!, 'vtt')}>
              VTT
            </Button>
            <Button size="sm" icon={<Languages size={12} />} loading={translating} disabled={!settings.ai.enabled || !settings.ai.apiKey} onClick={() => void translate()} title={settings.ai.enabled ? undefined : 'Requer um provedor de IA nas Configurações'}>
              Traduzir
            </Button>
          </div>
          <div className="relative">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Buscar na transcrição" className="h-8 pl-7 text-xs" aria-label="Buscar na transcrição" />
          </div>
          {query && (
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {results.length === 0 && <p className="text-[11px] text-fg-subtle">Nenhuma ocorrência.</p>}
              {results.map((r, i) => (
                <button key={i} className="flex items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-panel-2" onClick={() => A.seek(Math.round(r.start * project.settings.fps))}>
                  <span className="text-fg">{r.text}</span>
                  <span className="font-mono text-[10px] text-accent-soft">{formatDuration(r.start)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="text-[10px] text-fg-subtle">Whisper roda no seu dispositivo (WebGPU quando disponível, senão WebAssembly). O áudio não é enviado a servidores.</p>
      <Dialog
        open={!!consent}
        onOpenChange={(o) => !o && setConsent(null)}
        title="Baixar modelo de transcrição?"
        description="A transcrição usa o modelo Whisper rodando localmente. Ele precisa ser baixado uma vez e fica guardado no navegador para uso offline."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConsent(null)}>
              Agora não
            </Button>
            <Button variant="primary" onClick={() => void start(true)}>
              Baixar e transcrever
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-1 text-sm text-fg-muted">
          <li>
            Modelo: <span className="text-fg">{model.label}</span>
          </li>
          <li>
            Tamanho do download: <span className="text-fg">~{model.approxMB} MB</span> (mais ~25 MB do runtime ONNX)
          </li>
          <li>
            Espaço livre estimado: <span className="text-fg">{consent?.free != null ? formatBytes(consent.free) : 'desconhecido'}</span>
          </li>
          <li>
            Origem: <span className="text-fg">{settings.modelHost}</span>
          </li>
        </ul>
      </Dialog>
    </Section>
  );
}

// ─────────────────────────── IA 2 — Silêncios ───────────────────────────

function audibleTarget(p: Project, sel: string[]): VideoClip | AudioClip | undefined {
  const fromSel = sel.map((id) => p.clips[id]).find((c): c is VideoClip | AudioClip => !!c && isAudible(c, p));
  if (fromSel) return fromSel;
  return Object.values(p.clips)
    .filter((c): c is VideoClip | AudioClip => isAudible(c, p))
    .sort((a, b) => b.duration - a.duration)[0];
}

function SilenceSection() {
  const [auto, setAuto] = useState(true);
  const [threshold, setThreshold] = useState(-40);
  const [minSilence, setMinSilence] = useState(0.6);
  const [padding, setPadding] = useState(0.15);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ranges: { start: number; end: number }[]; clip: string; thr: number } | null>(null);
  const fps = useEditor((s) => s.project!.settings.fps);
  const analyze = async () => {
    const p = ed().project!;
    const clip = audibleTarget(p, ed().selection);
    if (!clip) {
      toast({ kind: 'info', title: 'Nenhum clipe com áudio na timeline' });
      return;
    }
    setBusy(true);
    try {
      const pcm = await assetPcm(clip.assetId);
      const s = suggestSilenceCuts(p, clip, pcm, { thresholdDb: auto ? 'auto' : threshold, minSilence, padding });
      if (clip.reverse || clip.freeze) toast({ kind: 'warning', title: 'Clipes reversos ou congelados não são analisados' });
      setResult({ ranges: s.ranges, clip: clip.id, thr: s.thresholdDb });
    } catch (e) {
      toast({ kind: 'error', title: 'Falha na análise', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const total = result ? result.ranges.reduce((a, r) => a + r.end - r.start, 0) / fps : 0;
  return (
    <Section title={<span className="flex items-center gap-1.5" data-tool="silence"><VolumeX size={12} /> Remover silêncios</span>} defaultOpen={false}>
      <p className="text-[11px] text-fg-muted">Analisa o clipe selecionado (ou o mais longo com áudio) e remove os trechos silenciosos em todas as faixas, mantendo a sincronia.</p>
      <Switch checked={auto} onChange={setAuto} label="Limiar automático (ruído de fundo + 12 dB)" />
      {!auto && <Slider label="Limiar" value={threshold} min={-70} max={-15} step={1} onChange={setThreshold} format={(v) => `${v} dBFS`} />}
      <Slider label="Silêncio mínimo" value={minSilence} min={0.2} max={3} step={0.1} onChange={setMinSilence} format={(v) => `${v.toFixed(1)} s`} />
      <Slider label="Margem preservada" value={padding} min={0} max={0.5} step={0.05} onChange={setPadding} format={(v) => `${v.toFixed(2)} s`} />
      <Button size="sm" onClick={() => void analyze()} loading={busy} data-testid="ai-silence-analyze">
        Analisar
      </Button>
      {result && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-bg-2 p-2" data-testid="ai-silence-result">
          <p className="text-xs text-fg">
            {result.ranges.length} silêncio(s) · {total.toFixed(1)} s a remover {auto && <span className="text-fg-subtle">(limiar {result.thr.toFixed(0)} dBFS)</span>}
          </p>
          <div className="flex max-h-28 flex-col overflow-y-auto">
            {result.ranges.map((r, i) => (
              <button key={i} className="flex justify-between rounded px-1.5 py-0.5 text-[11px] text-fg-muted hover:bg-panel-2" onClick={() => A.seek(r.start)}>
                <span>
                  {formatDuration(r.start / fps)} → {formatDuration(r.end / fps)}
                </span>
                <span>{((r.end - r.start) / fps).toFixed(2)} s</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              disabled={!result.ranges.length}
              data-testid="ai-silence-apply"
              onClick={() => {
                if (apply(silenceRemovalOps(result.ranges), 'Remover silêncios')) {
                  toast({ kind: 'success', title: `${total.toFixed(1)} s de silêncio removidos`, description: 'Ctrl+Z desfaz.' });
                  setResult(null);
                }
              }}
            >
              Aplicar cortes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────── IA 3 — Cortes inteligentes ───────────────────────────

function SmartCutsSection() {
  const project = useEditor((s) => s.project)!;
  const [cuts, setCuts] = useState<{ start: number; end: number; reason: string; on: boolean }[] | null>(null);
  const fps = project.settings.fps;
  const analyze = () => {
    const caps = captionClips(project).filter((c) => c.words.length);
    if (!caps.length) {
      toast({ kind: 'info', title: 'Gere legendas primeiro', description: 'Os cortes inteligentes usam os tempos das palavras da transcrição.' });
      return;
    }
    const words = caps.flatMap((c: CaptionClip) => c.words.map((w) => ({ text: w.text, start: c.start / fps + w.start, end: c.start / fps + w.end })));
    setCuts(suggestTranscriptCuts(words, 'pt').map((c) => ({ ...c, on: true })));
  };
  return (
    <Section title={<span className="flex items-center gap-1.5"><Scissors size={12} /> Cortes inteligentes</span>} defaultOpen={false}>
      <p className="text-[11px] text-fg-muted">Sugere cortes em pausas longas entre frases e em palavras de preenchimento (“é”, “hã”, “tipo”), a partir da transcrição. Não avalia o significado do conteúdo.</p>
      <Button size="sm" onClick={analyze}>
        Sugerir cortes
      </Button>
      {cuts && (
        <div className="flex flex-col gap-1">
          {cuts.length === 0 && <p className="text-[11px] text-fg-subtle">Nenhuma pausa longa ou palavra de preenchimento encontrada.</p>}
          {cuts.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-[11px] text-fg-muted">
              <input type="checkbox" checked={c.on} onChange={() => setCuts(cuts.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
              <button className="font-mono text-accent-soft" onClick={() => A.seek(Math.round(c.start * fps))}>
                {formatDuration(c.start)}
              </button>
              <span className="truncate">{c.reason}</span>
            </label>
          ))}
          {cuts.some((c) => c.on) && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const ranges = cuts.filter((c) => c.on).map((c) => ({ start: Math.round(c.start * fps), end: Math.round(c.end * fps) })).filter((r) => r.end > r.start);
                if (apply(silenceRemovalOps(ranges), 'Cortes inteligentes')) setCuts(null);
              }}
            >
              Aplicar {cuts.filter((c) => c.on).length} corte(s)
            </Button>
          )}
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────── IA 4 — Reenquadramento ───────────────────────────

function ReframeSection() {
  const [target, setTarget] = useState<'9:16' | '1:1' | '4:5' | 'keep'>('9:16');
  const [progress, setProgress] = useState<number | null>(null);
  const run = async () => {
    const s = ed();
    const p0 = s.project!;
    const clips = (s.selection.length ? s.selection.map((id) => p0.clips[id]) : Object.values(p0.clips)).filter((c): c is VideoClip => c?.type === 'video');
    if (!clips.length) {
      toast({ kind: 'info', title: 'Selecione um clipe de vídeo (ou adicione vídeos à timeline)' });
      return;
    }
    setProgress(0);
    try {
      const ops: EditOp[] = [];
      let dst = { width: p0.settings.width, height: p0.settings.height };
      if (target !== 'keep') {
        const [a, b] = target.split(':').map(Number) as [number, number];
        const short = Math.min(p0.settings.width, p0.settings.height);
        const k = short / Math.min(a, b);
        dst = { width: Math.round((a * k) / 2) * 2, height: Math.round((b * k) / 2) * 2 };
        ops.push({ type: 'project.resize', width: dst.width, height: dst.height, refit: 'cover' });
      }
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i]!;
        const asset = p0.assets[c.assetId];
        if (!asset?.width || !asset.height) continue;
        const samples = await analyzeSubject(p0, c, (pr) => setProgress((i + pr) / clips.length));
        ops.push(...reframeKeyframes({ ...c, transform: { ...c.transform, x: 0 } }, samples, { width: asset.width, height: asset.height }, dst));
      }
      if (apply(ops, 'Reenquadramento automático')) toast({ kind: 'success', title: 'Reenquadramento aplicado', description: 'A posição X foi animada para acompanhar o assunto. Ajuste os keyframes se precisar.' });
    } catch (e) {
      toast({ kind: 'error', title: 'Falha no reenquadramento', description: errorMessage(e) });
    } finally {
      setProgress(null);
    }
  };
  return (
    <Section title={<span className="flex items-center gap-1.5" data-tool="reframe"><Crop size={12} /> Reenquadramento automático</span>} defaultOpen={false}>
      <p className="text-[11px] text-fg-muted">Detecta a região de maior interesse (bordas e movimento) quadro a quadro e anima o enquadramento para mantê-la centralizada. Heurística visual — não reconhece pessoas ou objetos específicos.</p>
      <Select
        value={target}
        onChange={setTarget}
        ariaLabel="Formato de destino"
        className="h-8 text-xs"
        options={[
          { value: '9:16', label: 'Converter para vertical 9:16' },
          { value: '1:1', label: 'Converter para quadrado 1:1' },
          { value: '4:5', label: 'Converter para 4:5' },
          { value: 'keep', label: 'Manter formato atual' },
        ]}
      />
      {progress !== null ? <ProgressBar value={progress} /> : <Button size="sm" onClick={() => void run()}>Analisar e reenquadrar</Button>}
    </Section>
  );
}

// ─────────────────────────── Ferramentas de áudio (ducking/normalização) ───────────────────────────

function AudioToolsSection() {
  const [reduction, setReduction] = useState(-14);
  const [busy, setBusy] = useState<string | null>(null);
  const duck = async () => {
    const p = ed().project!;
    const musics = Object.values(p.clips).filter((c): c is AudioClip => c.type === 'audio' && !/narra|voz|voice|fala/i.test(c.name));
    const voices = Object.values(p.clips).filter((c): c is VideoClip | AudioClip => isAudible(c, p) && !musics.includes(c as AudioClip));
    if (!musics.length || !voices.length) {
      toast({ kind: 'info', title: 'É preciso ter música e voz', description: 'Clipes de áudio são tratados como música; vídeos com som e áudios com “narração/voz” no nome, como voz.' });
      return;
    }
    setBusy('duck');
    try {
      const voiceData = await Promise.all(voices.map(async (clip) => ({ clip, pcm: await assetPcm(clip.assetId) })));
      const ops = musics.flatMap((m) => planDucking(p, m, voiceData, { reductionDb: reduction, thresholdDb: -38, attack: 0.25, release: 0.5 }));
      if (apply(ops, 'Ducking automático')) toast({ kind: 'success', title: 'Ducking aplicado', description: 'Keyframes de volume criados na música.' });
      else toast({ kind: 'info', title: 'Nenhuma fala detectada sobre a música' });
    } catch (e) {
      toast({ kind: 'error', title: 'Falha no ducking', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  const normalizeAll = async () => {
    const p = ed().project!;
    const list = Object.values(p.clips).filter((c): c is VideoClip | AudioClip => isAudible(c, p));
    setBusy('norm');
    try {
      const ops: EditOp[] = [];
      for (const c of list) {
        const pcm = await assetPcm(c.assetId);
        const s = Math.floor(c.sourceIn * pcm.sampleRate);
        const e = Math.ceil((c.sourceIn + (c.duration / p.settings.fps) * c.speed) * pcm.sampleRate);
        const gain = normalizationGain({ sampleRate: pcm.sampleRate, channels: pcm.channels.map((ch) => ch.subarray(s, e)) }, -14, -1);
        ops.push({ type: 'clip.update', clipIds: [c.id], patch: { audio: { normalizeGainDb: Math.round(gain * 10) / 10 } } });
      }
      if (apply(ops, 'Normalizar áudio')) toast({ kind: 'success', title: `${ops.length} clipe(s) normalizados para −14 LUFS` });
    } catch (e) {
      toast({ kind: 'error', title: 'Falha na normalização', description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section title={<span className="flex items-center gap-1.5" data-tool="ducking"><Volume1 size={12} /> Ducking e normalização</span>} defaultOpen={false}>
      <Slider label="Redução da música durante a fala" value={reduction} min={-30} max={-3} step={1} onChange={setReduction} format={(v) => `${v} dB`} />
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => void duck()} loading={busy === 'duck'}>
          Aplicar ducking
        </Button>
        <Button size="sm" onClick={() => void normalizeAll()} loading={busy === 'norm'} data-tool="normalize">
          Normalizar tudo (LUFS)
        </Button>
      </div>
    </Section>
  );
}

// ─────────────────────────── IA 7 — Sugestões ───────────────────────────

function SuggestionsSection() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  return (
    <Section title={<span className="flex items-center gap-1.5" data-tool="suggestions"><Lightbulb size={12} /> Sugestões de melhoria</span>} defaultOpen={false}>
      <Button size="sm" onClick={() => setItems(analyzeProject(ed().project!))} data-testid="ai-suggest">
        Analisar projeto
      </Button>
      {items?.length === 0 && <p className="text-[11px] text-success">Nada a sugerir — bom trabalho!</p>}
      {items?.map((s) => (
        <div key={s.id} className={cx('rounded-lg border p-2', s.severity === 'aviso' ? 'border-warning/40 bg-warning/5' : 'border-line bg-bg-2')}>
          <p className="text-xs font-medium text-fg">{s.title}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">{s.detail}</p>
          {s.fix && s.fix.ops.length > 0 && (
            <Button
              size="sm"
              className="mt-1.5"
              onClick={() => {
                if (apply(s.fix!.ops, s.fix!.label)) setItems(analyzeProject(ed().project!));
              }}
            >
              {s.fix.label}
            </Button>
          )}
        </div>
      ))}
    </Section>
  );
}

// ─────────────────────────── IA 10 — Clipes curtos ───────────────────────────

function HighlightsSection() {
  const [items, setItems] = useState<{ h: Highlight; clip: Clip & { assetId: string } }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [len, setLen] = useState(30);
  const analyze = async () => {
    const p = ed().project!;
    const clip = audibleTarget(p, ed().selection);
    if (!clip) {
      toast({ kind: 'info', title: 'Selecione uma gravação longa com áudio' });
      return;
    }
    setBusy(true);
    try {
      const pcm = await assetPcm(clip.assetId);
      const hs = suggestHighlights(pcm, { minLen: len * 0.6, maxLen: len * 1.3, count: 3 });
      setItems(hs.map((h) => ({ h, clip })));
    } catch (e) {
      toast({ kind: 'error', title: 'Falha na análise', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const createShort = async (h: Highlight, clip: Clip & { assetId: string }) => {
    const p = ed().project!;
    const asset = p.assets[clip.assetId]!;
    const base = createProject({ name: `${p.name} — corte ${formatDuration(h.start)}`, width: 1080, height: 1920, fps: p.settings.fps });
    let short: Project = { ...base, assets: { [asset.id]: asset } };
    const { applyOp } = await import('@framestudio/editor-core');
    const r = applyOp(short, { type: 'clip.addAsset', assetId: asset.id, start: 0 });
    short = r.project;
    const id = r.created[0]!;
    const fps = p.settings.fps;
    short = applyOp(short, { type: 'clip.trim', clipId: id, edge: 'end', frame: Math.round((h.end - h.start) * fps) }).project;
    short = applyOp(short, { type: 'clip.slip', clipId: id, deltaSeconds: h.start }).project;
    short = applyOp(short, { type: 'clip.update', clipIds: [id], patch: { transform: { fit: 'cover' } } }).project;
    await repo.save(short);
    toast({ kind: 'success', title: 'Projeto curto criado', description: short.name, action: { label: 'Abrir', onClick: () => void ed().close().then(() => navigate({ name: 'editor', projectId: short.id })) } });
  };
  return (
    <Section title={<span className="flex items-center gap-1.5" data-tool="highlights"><Film size={12} /> Clipes curtos</span>} defaultOpen={false}>
      <p className="text-[11px] text-fg-muted">Encontra trechos com mais atividade de fala/som numa gravação longa e cria projetos verticais com eles. Heurística de áudio — revise antes de publicar.</p>
      <Slider label="Duração alvo" value={len} min={10} max={90} step={5} onChange={setLen} format={(v) => `${v} s`} />
      <Button size="sm" onClick={() => void analyze()} loading={busy}>
        <Sparkles size={13} /> Sugerir trechos
      </Button>
      {items?.map(({ h, clip }, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-bg-2 p-2 text-[11px]">
          <div>
            <p className="font-medium text-fg">
              {formatDuration(h.start)} → {formatDuration(h.end)} ({(h.end - h.start).toFixed(0)} s)
            </p>
            <p className="text-fg-subtle">{h.reason}</p>
          </div>
          <Button size="sm" onClick={() => void createShort(h, clip)}>
            Criar
          </Button>
        </div>
      ))}
      {items && items.length === 0 && <p className="text-[11px] text-fg-subtle">Gravação curta demais para sugerir trechos.</p>}
      <p className="text-[10px] text-fg-subtle">Projeto atual: {formatDuration(projectDuration(useEditor.getState().project!) / useEditor.getState().project!.settings.fps)}</p>
    </Section>
  );
}
