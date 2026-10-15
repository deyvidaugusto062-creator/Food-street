/// <reference lib="webworker" />
/**
 * Transcrição local com Whisper (transformers.js + ONNX Runtime Web) num Web Worker:
 * a interface não trava e o áudio nunca sai do dispositivo. O modelo é baixado apenas após
 * consentimento do usuário e fica no cache do navegador para uso offline.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { WHISPER_MODELS, type WorkerRequest, type WorkerResponse } from '@framestudio/ai-engine';

declare const self: DedicatedWorkerGlobalScope;

let current: { key: string; pipe: AutomaticSpeechRecognitionPipeline } | null = null;
const cancelled = new Set<number>();

const post = (m: WorkerResponse) => self.postMessage(m);

async function load(id: number, size: keyof typeof WHISPER_MODELS, remoteHost?: string): Promise<AutomaticSpeechRecognitionPipeline> {
  const repo = WHISPER_MODELS[size].repo;
  const key = `${remoteHost ?? ''}|${repo}`;
  if (current?.key === key) return current.pipe;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  if (remoteHost) env.remoteHost = remoteHost.replace(/\/?$/, '/');
  const webgpu = 'gpu' in navigator && !!(await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter().catch(() => null));
  const pipe = (await pipeline('automatic-speech-recognition', repo, {
    device: webgpu ? 'webgpu' : 'wasm',
    dtype: webgpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (p: { status: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
      if (p.status === 'progress') post({ type: 'progress', id, stage: 'download', progress: (p.progress ?? 0) / 100, file: p.file, loaded: p.loaded, total: p.total });
      else if (p.status === 'ready') post({ type: 'progress', id, stage: 'load', progress: 1 });
    },
  })) as AutomaticSpeechRecognitionPipeline;
  current = { key, pipe };
  return pipe;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled.add(msg.id);
    return;
  }
  const { id } = msg;
  try {
    const pipe = await load(id, msg.model, msg.remoteHost);
    if (cancelled.has(id)) return;
    post({ type: 'progress', id, stage: 'transcribe', progress: 0 });
    const opts = {
      task: 'transcribe' as const,
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(msg.language !== 'auto' ? { language: msg.language } : {}),
    };
    let words: { text: string; start: number; end: number }[] = [];
    let text = '';
    try {
      const out = (await pipe(msg.audio, { ...opts, return_timestamps: 'word' })) as { text: string; chunks?: { text: string; timestamp: [number, number | null] }[] };
      text = out.text;
      words = (out.chunks ?? []).map((c) => ({ text: c.text.trim(), start: c.timestamp[0] + msg.offset, end: (c.timestamp[1] ?? c.timestamp[0] + 0.3) + msg.offset }));
    } catch {
      // Modelo sem suporte a tempos por palavra: usa segmentos e distribui as palavras pelo tamanho.
      const out = (await pipe(msg.audio, { ...opts, return_timestamps: true })) as { text: string; chunks?: { text: string; timestamp: [number, number | null] }[] };
      text = out.text;
      for (const seg of out.chunks ?? []) {
        const s = seg.timestamp[0];
        const en = seg.timestamp[1] ?? s + 2;
        const ws = seg.text.trim().split(/\s+/).filter(Boolean);
        const totalChars = ws.reduce((a, w) => a + w.length, 0) || 1;
        let t = s;
        for (const w of ws) {
          const d = ((en - s) * w.length) / totalChars;
          words.push({ text: w, start: t + msg.offset, end: t + d + msg.offset });
          t += d;
        }
      }
    }
    if (cancelled.has(id)) return;
    post({ type: 'result', id, words: words.filter((w) => w.text), text });
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};
