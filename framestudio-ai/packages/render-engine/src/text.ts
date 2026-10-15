import type { CaptionWord, TextStyle } from '@framestudio/shared';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface TextRenderOptions {
  /** Escala de px do projeto → px do canvas gerado (nitidez). */
  scale: number;
  /** Quantos caracteres exibir (animação máquina de escrever). */
  visibleChars?: number;
  /** Palavras temporizadas (legendas). */
  words?: CaptionWord[];
  /** Tempo local (s) para destaque de palavras. */
  localTime?: number;
  highlightWords?: boolean;
  highlightColor?: string;
  wordByWord?: boolean;
}

export interface RenderedText {
  canvas: AnyCanvas;
  /** Tamanho em px do projeto. */
  width: number;
  height: number;
}

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

let measureCtx: Ctx | null = null;
function mctx(): Ctx {
  if (!measureCtx) measureCtx = makeCanvas(8, 8).getContext('2d') as Ctx;
  return measureCtx;
}

export function fontString(s: TextStyle, scale = 1): string {
  return `${s.italic ? 'italic ' : ''}${s.fontWeight} ${Math.max(1, s.fontSize * scale)}px ${s.fontFamily}`;
}

interface Token {
  text: string;
  wordIndex: number; // -1 para texto livre
}

function measure(ctx: Ctx, text: string, spacing: number): number {
  if (!text) return 0;
  return ctx.measureText(text).width + spacing * Math.max(0, [...text].length - 1);
}

/** Quebra em linhas respeitando \n e a largura máxima. */
export function layoutLines(ctx: Ctx, tokens: Token[][], maxWidth: number, spacing: number): Token[][] {
  if (maxWidth <= 0) return tokens;
  const out: Token[][] = [];
  const space = measure(ctx, ' ', 0) + spacing;
  for (const para of tokens) {
    let line: Token[] = [];
    let w = 0;
    for (const t of para) {
      const tw = measure(ctx, t.text, spacing);
      if (line.length > 0 && w + space + tw > maxWidth) {
        out.push(line);
        line = [];
        w = 0;
      }
      w += (line.length ? space : 0) + tw;
      line.push(t);
    }
    out.push(line);
  }
  return out;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSpaced(ctx: Ctx, text: string, x: number, y: number, spacing: number, mode: 'fill' | 'stroke'): void {
  if (spacing === 0) {
    if (mode === 'fill') ctx.fillText(text, x, y);
    else ctx.strokeText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    if (mode === 'fill') ctx.fillText(ch, cx, y);
    else ctx.strokeText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

export function activeWordIndex(words: CaptionWord[], t: number): number {
  let idx = -1;
  for (let i = 0; i < words.length; i++) if (t >= words[i]!.start) idx = i;
  return idx;
}

const cache = new Map<string, RenderedText>();
const MAX_CACHE = 48;

/** Rasteriza um bloco de texto (com contorno, sombra e fundo) num canvas próprio. */
export function renderText(style: TextStyle, opts: TextRenderOptions): RenderedText {
  const scale = Math.max(0.05, Math.min(opts.scale, 4));
  const useWords = !!opts.words && opts.words.length > 0;
  const active = useWords && opts.localTime !== undefined ? activeWordIndex(opts.words!, opts.localTime) : -1;
  const key = JSON.stringify([style, scale.toFixed(3), opts.visibleChars ?? -1, useWords ? opts.words!.length : 0, active, opts.highlightWords, opts.highlightColor, opts.wordByWord]);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const ctx = mctx();
  ctx.font = fontString(style, scale);
  const spacing = style.letterSpacing * scale;

  let paragraphs: Token[][];
  if (useWords) {
    const words = opts.words!;
    if (opts.wordByWord) {
      const i = Math.max(0, active);
      paragraphs = [[{ text: words[i]!.text, wordIndex: i }]];
    } else paragraphs = [words.map((w, i) => ({ text: w.text, wordIndex: i }))];
  } else {
    let content = style.content;
    if (opts.visibleChars !== undefined) content = [...content].slice(0, Math.max(0, Math.floor(opts.visibleChars))).join('');
    paragraphs = content.split('\n').map((line) => line.split(/ +/).map((t) => ({ text: t, wordIndex: -1 })));
  }
  const lines = layoutLines(ctx, paragraphs, style.boxWidth * scale, spacing);
  const space = measure(ctx, ' ', 0) + spacing;
  const lineWidths = lines.map((l) => l.reduce((acc, t, i) => acc + (i ? space : 0) + measure(ctx, t.text, spacing), 0));
  const fontPx = style.fontSize * scale;
  const lh = fontPx * style.lineHeight;
  const textW = Math.max(1, ...lineWidths, style.boxWidth > 0 && style.background.enabled ? 0 : 1);
  const blockW = style.boxWidth > 0 ? Math.max(textW, 1) : textW;
  const blockH = Math.max(lh, lines.length * lh);
  const bgPad = style.background.enabled ? style.background.padding * scale : 0;
  const strokeW = style.stroke.enabled ? style.stroke.width * scale : 0;
  const sh = style.shadow.enabled ? (style.shadow.blur + Math.max(Math.abs(style.shadow.x), Math.abs(style.shadow.y))) * scale : 0;
  const margin = Math.ceil(bgPad + strokeW + sh + 4 * scale);
  const cw = Math.ceil(blockW + margin * 2);
  const ch = Math.ceil(blockH + margin * 2);
  const canvas = makeCanvas(Math.max(1, cw), Math.max(1, ch));
  const c = canvas.getContext('2d') as Ctx;
  c.font = fontString(style, scale);
  c.textBaseline = 'middle';
  c.textAlign = 'left';

  if (style.background.enabled) {
    c.fillStyle = style.background.color;
    roundRect(c, margin - bgPad, margin - bgPad, blockW + bgPad * 2, blockH + bgPad * 2, style.background.radius * scale);
    c.fill();
  }

  const lineX = (i: number) => {
    const w = lineWidths[i]!;
    if (style.align === 'left') return margin;
    if (style.align === 'right') return margin + blockW - w;
    return margin + (blockW - w) / 2;
  };

  const drawPass = (mode: 'fill' | 'stroke') => {
    lines.forEach((line, li) => {
      let x = lineX(li);
      const y = margin + lh * li + lh / 2;
      line.forEach((tok, ti) => {
        if (ti > 0) x += space;
        if (mode === 'fill') {
          const highlight = opts.highlightWords && tok.wordIndex >= 0 && tok.wordIndex === active;
          c.fillStyle = highlight ? (opts.highlightColor ?? '#8257FF') : style.color;
        }
        drawSpaced(c, tok.text, x, y, spacing, mode);
        x += measure(c, tok.text, spacing);
      });
    });
  };

  if (style.shadow.enabled) {
    c.shadowColor = style.shadow.color;
    c.shadowBlur = style.shadow.blur * scale;
    c.shadowOffsetX = style.shadow.x * scale;
    c.shadowOffsetY = style.shadow.y * scale;
  }
  if (style.stroke.enabled && strokeW > 0) {
    c.lineJoin = 'round';
    c.miterLimit = 2;
    c.strokeStyle = style.stroke.color;
    c.lineWidth = strokeW * 2;
    drawPass('stroke');
    // Sombra só uma vez (no contorno), para não escurecer o preenchimento.
    c.shadowColor = 'transparent';
  }
  drawPass('fill');

  const result: RenderedText = { canvas, width: cw / scale, height: ch / scale };
  cache.set(key, result);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  return result;
}

/** Fontes usadas no projeto, para carregar antes de renderizar/exportar. */
export async function ensureFonts(styles: TextStyle[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const fonts = new Set(styles.map((s) => fontString({ ...s, fontSize: 32 }, 1)));
  await Promise.all([...fonts].map((f) => document.fonts.load(f).catch(() => [])));
}
