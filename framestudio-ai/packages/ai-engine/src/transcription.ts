/**
 * Contratos da transcrição local (Whisper). A execução fica num Web Worker do app
 * (apps/web/src/workers/whisper.worker.ts) usando transformers.js + ONNX Runtime Web.
 */
export type WhisperSize = 'tiny' | 'base' | 'small';
export type WhisperLanguage = 'portuguese' | 'english' | 'spanish' | 'auto';

export const WHISPER_MODELS: Record<WhisperSize, { repo: string; approxMB: number; label: string }> = {
  tiny: { repo: 'onnx-community/whisper-tiny', approxMB: 41, label: 'Tiny — rápido, menos preciso' },
  base: { repo: 'onnx-community/whisper-base', approxMB: 80, label: 'Base — equilíbrio' },
  small: { repo: 'onnx-community/whisper-small', approxMB: 250, label: 'Small — mais preciso, mais lento' },
};

export const LANG_CODE: Record<Exclude<WhisperLanguage, 'auto'>, 'pt' | 'en' | 'es'> = { portuguese: 'pt', english: 'en', spanish: 'es' };

export type WorkerRequest =
  | { type: 'transcribe'; id: number; audio: Float32Array; model: WhisperSize; language: WhisperLanguage; remoteHost?: string; offset: number }
  | { type: 'cancel'; id: number };

export type WorkerResponse =
  | { type: 'progress'; id: number; stage: 'download' | 'load' | 'transcribe'; progress: number; file?: string; loaded?: number; total?: number }
  | { type: 'result'; id: number; words: { text: string; start: number; end: number }[]; text: string }
  | { type: 'error'; id: number; message: string };

/** Reamostra PCM mono para 16 kHz (entrada do Whisper) por interpolação linear com filtro simples. */
export function resampleTo16k(input: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) return input;
  const ratio = sampleRate / 16000;
  const out = new Float32Array(Math.floor(input.length / ratio));
  // Média em caixa (anti-aliasing simples) + interpolação linear.
  const half = Math.max(1, Math.floor(ratio / 2));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    let acc = 0;
    let n = 0;
    for (let k = -half; k <= half; k++) {
      const v = input[i0 + k];
      if (v !== undefined) {
        acc += v;
        n++;
      }
    }
    out[i] = n ? acc / n : 0;
  }
  return out;
}
