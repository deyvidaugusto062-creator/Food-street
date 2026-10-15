/**
 * Transcrição → legendas: agrupamento de palavras temporizadas em blocos legíveis, cortes
 * inteligentes baseados em pausas/palavras de preenchimento e busca por palavra.
 */
import type { CaptionWord } from '@framestudio/shared';

export interface TimedWord {
  text: string;
  /** Segundos absolutos na timeline. */
  start: number;
  end: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: TimedWord[];
}

export interface CaptionChunk {
  start: number;
  end: number;
  text: string;
  words: CaptionWord[];
}

export interface ChunkOptions {
  maxChars: number;
  maxDuration: number;
  maxGap: number;
  /** Uma palavra por legenda (estilo "word-by-word"). */
  single?: boolean;
}

/** Agrupa palavras em legendas, quebrando por pontuação, pausas, tamanho e duração. */
export function buildCaptionChunks(words: TimedWord[], opts: ChunkOptions = { maxChars: 42, maxDuration: 3.5, maxGap: 0.7 }): CaptionChunk[] {
  const clean = words.map((w) => ({ ...w, text: w.text.trim() })).filter((w) => w.text && w.end > w.start - 1e-3);
  const chunks: CaptionChunk[] = [];
  let cur: TimedWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    const start = cur[0]!.start;
    const end = Math.max(cur[cur.length - 1]!.end, start + 0.3);
    chunks.push({
      start,
      end,
      text: cur.map((w) => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1'),
      words: cur.map((w) => ({ text: w.text, start: Math.max(0, w.start - start), end: Math.max(0, w.end - start) })),
    });
    cur = [];
  };
  for (const w of clean) {
    if (opts.single) {
      cur = [w];
      flush();
      continue;
    }
    if (cur.length) {
      const last = cur[cur.length - 1]!;
      const len = cur.map((x) => x.text).join(' ').length + 1 + w.text.length;
      if (w.start - last.end > opts.maxGap || len > opts.maxChars || w.end - cur[0]!.start > opts.maxDuration) flush();
    }
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) flush();
  }
  flush();
  // Evita sobreposição entre legendas consecutivas.
  for (let i = 1; i < chunks.length; i++) if (chunks[i - 1]!.end > chunks[i]!.start) chunks[i - 1]!.end = chunks[i]!.start;
  return chunks;
}

/** Converte blocos (segundos) no formato da operação `captions.set` (frames). */
export function chunksToCaptionOps(chunks: CaptionChunk[], fps: number) {
  return chunks
    .map((c) => {
      const start = Math.round(c.start * fps);
      const duration = Math.max(1, Math.round(c.end * fps) - start);
      return { start, duration, content: c.text, words: c.words };
    })
    .filter((c) => c.duration > 0);
}

const FILLERS: Record<string, string[]> = {
  pt: ['é', 'éé', 'hã', 'ã', 'hum', 'hmm', 'tipo', 'né', 'então', 'ahn', 'eh', 'ah'],
  en: ['um', 'uh', 'erm', 'er', 'ah', 'like', 'hmm', 'you know'],
  es: ['eh', 'este', 'em', 'mmm', 'o sea', 'pues', 'ah'],
};

/**
 * Cortes inteligentes: sugere remover palavras de preenchimento isoladas e pausas longas entre
 * frases. Baseia-se apenas na transcrição e nos tempos — não avalia o significado do conteúdo.
 */
export function suggestTranscriptCuts(words: TimedWord[], lang: 'pt' | 'en' | 'es', opts: { minPause?: number; keepPause?: number } = {}): { start: number; end: number; reason: string }[] {
  const minPause = opts.minPause ?? 0.8;
  const keep = opts.keepPause ?? 0.25;
  const fillers = new Set(FILLERS[lang] ?? []);
  const out: { start: number; end: number; reason: string }[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const norm = w.text.toLowerCase().replace(/[^\p{L}\s]/gu, '').trim();
    if (fillers.has(norm)) out.push({ start: w.start, end: w.end, reason: `Palavra de preenchimento: “${w.text}”` });
    const next = words[i + 1];
    if (next && next.start - w.end > minPause) out.push({ start: w.end + keep / 2, end: next.start - keep / 2, reason: `Pausa de ${(next.start - w.end).toFixed(1)} s` });
  }
  return out.filter((c) => c.end - c.start > 0.05);
}

/** Localiza ocorrências de um termo na transcrição (busca sem acentos). */
export function searchTranscript(words: TimedWord[], query: string): TimedWord[] {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
  const q = n(query).trim();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const out: TimedWord[] = [];
  for (let i = 0; i + terms.length <= words.length; i++) {
    if (terms.every((t, k) => n(words[i + k]!.text).startsWith(t))) out.push({ text: words.slice(i, i + terms.length).map((w) => w.text).join(' '), start: words[i]!.start, end: words[i + terms.length - 1]!.end });
  }
  return out;
}
