import { ALL_FORMATS, BlobSource, CanvasSink, Input, type InputVideoTrack, type WrappedCanvas } from 'mediabunny';
import { FrameStudioError } from '@framestudio/shared';

/**
 * Leitor de quadros de vídeo para renderização exata (exportação, miniaturas e scrubbing preciso).
 * Otimizado para acesso sequencial crescente, mas aceita saltos e retrocessos.
 */
export interface FrameReader {
  frameAt(time: number): Promise<CanvasImageSource | null>;
  readonly width: number;
  readonly height: number;
  readonly kind: 'webcodecs' | 'element';
  dispose(): void;
}

export interface FrameReaderOptions {
  /** Limita a resolução decodificada (economia de memória). */
  maxWidth?: number;
  maxHeight?: number;
}

/** Decodificação via WebCodecs (Mediabunny). */
export class WebCodecsFrameReader implements FrameReader {
  readonly kind = 'webcodecs' as const;
  private it: AsyncGenerator<WrappedCanvas, void, unknown> | null = null;
  private current: WrappedCanvas | null = null;
  private ahead: WrappedCanvas | null = null;
  private ended = false;
  private busy: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly input: Input,
    private readonly sink: CanvasSink,
    readonly width: number,
    readonly height: number,
    private readonly offset: number,
  ) {}

  static async open(blob: Blob, opts: FrameReaderOptions = {}): Promise<WebCodecsFrameReader | null> {
    if (typeof VideoDecoder === 'undefined') return null;
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) {
        input.dispose();
        return null;
      }
      const { width, height } = await fitSize(track, opts);
      const sink = new CanvasSink(track, { width, height, fit: 'fill', poolSize: 4 });
      const first = await input.getFirstTimestamp([track]).catch(() => 0);
      return new WebCodecsFrameReader(input, sink, width, height, first > 0 && first < 1 ? first : 0);
    } catch (e) {
      input.dispose();
      throw e;
    }
  }

  frameAt(time: number): Promise<CanvasImageSource | null> {
    // Serializa as chamadas: o iterador não é reentrante.
    const run = this.busy.then(() => this.frameAtInner(time + this.offset));
    this.busy = run.catch(() => {});
    return run;
  }

  private covers(w: WrappedCanvas | null, t: number): boolean {
    return !!w && t >= w.timestamp - 1e-4 && t < w.timestamp + Math.max(w.duration, 1e-3) - 1e-4;
  }

  private async frameAtInner(t: number): Promise<CanvasImageSource | null> {
    if (this.covers(this.current, t)) return this.current!.canvas;
    const canAdvance = this.it && this.current && t > this.current.timestamp && t - this.current.timestamp < 3;
    if (!canAdvance) await this.restart(t);
    // Avança até o quadro que cobre t.
    for (;;) {
      if (this.covers(this.current, t)) return this.current!.canvas;
      if (this.current && t < this.current.timestamp) return this.current.canvas; // antes do 1º quadro
      const next = this.ahead ?? (this.ended ? null : await this.pull());
      this.ahead = null;
      if (!next) return this.current?.canvas ?? null; // fim do arquivo: mantém o último quadro
      if (next.timestamp > t + 1e-4 && this.current) {
        this.ahead = next;
        return this.current.canvas;
      }
      this.current = next;
    }
  }

  private async pull(): Promise<WrappedCanvas | null> {
    if (!this.it) return null;
    const r = await this.it.next();
    if (r.done) {
      this.ended = true;
      return null;
    }
    return r.value;
  }

  private async restart(t: number): Promise<void> {
    await this.it?.return();
    this.ended = false;
    this.ahead = null;
    this.current = null;
    this.it = this.sink.canvases(Math.max(0, t));
    this.current = await this.pull();
  }

  dispose(): void {
    void this.it?.return();
    this.it = null;
    this.current = null;
    this.ahead = null;
    this.input.dispose();
  }
}

async function fitSize(track: InputVideoTrack, opts: FrameReaderOptions): Promise<{ width: number; height: number }> {
  const w = await track.getDisplayWidth();
  const h = await track.getDisplayHeight();
  const k = Math.min(1, (opts.maxWidth ?? Infinity) / w, (opts.maxHeight ?? Infinity) / h);
  return { width: Math.max(2, Math.round(w * k)), height: Math.max(2, Math.round(h * k)) };
}

/** Fallback: busca por `currentTime` num elemento <video>. Mais lento, mas funciona em qualquer navegador. */
export class ElementFrameReader implements FrameReader {
  readonly kind = 'element' as const;
  private busy: Promise<unknown> = Promise.resolve();
  private constructor(
    private readonly el: HTMLVideoElement,
    private readonly url: string,
  ) {}

  get width(): number {
    return this.el.videoWidth;
  }
  get height(): number {
    return this.el.videoHeight;
  }

  static open(blob: Blob): Promise<ElementFrameReader> {
    return new Promise((resolve, reject) => {
      const el = document.createElement('video');
      const url = URL.createObjectURL(blob);
      el.muted = true;
      el.playsInline = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.onloadeddata = () => resolve(new ElementFrameReader(el, url));
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new FrameStudioError('UNSUPPORTED_CODEC', 'O navegador não conseguiu decodificar este vídeo.'));
      };
      el.src = url;
    });
  }

  frameAt(time: number): Promise<CanvasImageSource | null> {
    const run = this.busy.then(() => seekElement(this.el, time).then(() => this.el));
    this.busy = run.catch(() => {});
    return run;
  }

  dispose(): void {
    this.el.removeAttribute('src');
    this.el.load();
    URL.revokeObjectURL(this.url);
  }
}

/** Faz o seek e espera o quadro estar realmente pronto para desenho. */
export function seekElement(el: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, Math.min(time, (el.duration || Infinity) - 0.001));
  if (Math.abs(el.currentTime - target) < 0.0005 && el.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener('seeked', onSeeked);
      resolve();
    };
    const onSeeked = () => {
      const v = el as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      if (v.requestVideoFrameCallback && !el.paused) v.requestVideoFrameCallback(() => finish());
      else finish();
    };
    const timer = setTimeout(finish, 3000);
    el.addEventListener('seeked', onSeeked);
    el.currentTime = target;
  });
}

/** Abre o melhor leitor disponível para o blob. */
export async function openFrameReader(blob: Blob, opts: FrameReaderOptions = {}): Promise<FrameReader> {
  const wc = await WebCodecsFrameReader.open(blob, opts).catch(() => null);
  if (wc) return wc;
  return ElementFrameReader.open(blob);
}
