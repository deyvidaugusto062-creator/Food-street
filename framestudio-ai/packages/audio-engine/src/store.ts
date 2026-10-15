import type { Project } from '@framestudio/shared';
import { decodeAudio, denoiseBuffer, reverseBuffer } from './decode.ts';
import { audibleClips, variantOf, type BufferLookup, type BufferVariant } from './mix.ts';

const variantKey = (assetId: string, v: BufferVariant) => `${assetId}|${v.reverse ? 'r' : 'f'}|${v.denoise.toFixed(2)}`;

/**
 * Cache de áudio decodificado por asset (e variantes: reverso, com redução de ruído).
 * Libera os buffers menos usados quando o limite de memória é atingido.
 */
export class AudioBufferStore {
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | undefined>>();
  private failed = new Set<string>();
  private lastUse = new Map<string, number>();

  constructor(
    private readonly loadBlob: (assetId: string) => Promise<Blob | undefined>,
    private readonly sampleRate = 48000,
    /** Limite aproximado em bytes de PCM em memória (padrão 1,5 GB). */
    private readonly maxBytes = 1.5 * 1024 ** 3,
  ) {}

  readonly lookup: BufferLookup = (assetId, variant) => {
    const k = variantKey(assetId, variant);
    const b = this.buffers.get(k);
    if (b) this.lastUse.set(k, performance.now());
    return b;
  };

  /** Carrega tudo o que o projeto precisa para tocar/exportar. */
  async prepare(project: Project, onProgress?: (done: number, total: number) => void): Promise<string[]> {
    const needed = new Map<string, { assetId: string; v: BufferVariant }>();
    for (const c of audibleClips(project)) {
      const v = variantOf(c);
      needed.set(variantKey(c.assetId, v), { assetId: c.assetId, v });
    }
    const errors: string[] = [];
    let done = 0;
    await Promise.all(
      [...needed.values()].map(async ({ assetId, v }) => {
        const b = await this.get(assetId, v);
        if (!b) errors.push(project.assets[assetId]?.name ?? assetId);
        onProgress?.(++done, needed.size);
      }),
    );
    return errors;
  }

  async get(assetId: string, v: BufferVariant = { reverse: false, denoise: 0 }): Promise<AudioBuffer | undefined> {
    const k = variantKey(assetId, v);
    const hit = this.buffers.get(k);
    if (hit) return hit;
    if (this.failed.has(k)) return undefined;
    let p = this.pending.get(k);
    if (!p) {
      p = (async () => {
        try {
          let b: AudioBuffer | undefined;
          if (v.reverse || v.denoise > 0) {
            const base = await this.get(assetId, { reverse: false, denoise: 0 });
            if (!base) return undefined;
            b = base;
            if (v.denoise > 0) b = denoiseBuffer(b, v.denoise);
            if (v.reverse) b = reverseBuffer(b);
          } else {
            const blob = await this.loadBlob(assetId);
            if (!blob) return undefined;
            b = await decodeAudio(blob, this.sampleRate);
          }
          this.buffers.set(k, b);
          this.lastUse.set(k, performance.now());
          this.evict();
          return b;
        } catch {
          this.failed.add(k);
          return undefined;
        } finally {
          this.pending.delete(k);
        }
      })();
      this.pending.set(k, p);
    }
    return p;
  }

  has(assetId: string): boolean {
    return this.buffers.has(variantKey(assetId, { reverse: false, denoise: 0 }));
  }

  invalidate(assetId: string): void {
    for (const k of [...this.buffers.keys()]) if (k.startsWith(assetId + '|')) this.buffers.delete(k);
    for (const k of [...this.failed]) if (k.startsWith(assetId + '|')) this.failed.delete(k);
  }

  private evict(): void {
    const bytes = () => [...this.buffers.values()].reduce((a, b) => a + b.length * b.numberOfChannels * 4, 0);
    while (bytes() > this.maxBytes && this.buffers.size > 1) {
      const oldest = [...this.lastUse.entries()].filter(([k]) => this.buffers.has(k)).sort((a, b) => a[1] - b[1])[0];
      if (!oldest) break;
      this.buffers.delete(oldest[0]);
      this.lastUse.delete(oldest[0]);
    }
  }

  clear(): void {
    this.buffers.clear();
    this.failed.clear();
  }
}
