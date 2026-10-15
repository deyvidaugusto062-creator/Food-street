import type { Project } from '@framestudio/shared';

export interface AutosaveOptions {
  /** Espera após a última alteração antes de gravar (ms). */
  debounceMs?: number;
  /** Intervalo máximo sem gravar enquanto houver alterações contínuas (ms). */
  maxWaitMs?: number;
  save: (p: Project) => Promise<void>;
  onStatus?: (s: AutosaveStatus) => void;
}

export type AutosaveStatus = { state: 'idle' | 'pending' | 'saving' | 'saved'; at?: number } | { state: 'error'; error: string };

/**
 * Salvamento automático com debounce que nunca bloqueia a edição: as gravações são serializadas
 * (uma por vez) e sempre gravam o estado mais recente.
 */
export class Autosaver {
  private latest: Project | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstPendingAt = 0;
  private saving: Promise<void> | null = null;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;

  constructor(private readonly opts: AutosaveOptions) {
    this.debounceMs = opts.debounceMs ?? 1500;
    this.maxWaitMs = opts.maxWaitMs ?? 10000;
  }

  schedule(p: Project): void {
    this.latest = p;
    const now = Date.now();
    if (!this.timer) this.firstPendingAt = now;
    if (this.timer) clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(this.debounceMs, this.firstPendingAt + this.maxWaitMs - now));
    this.opts.onStatus?.({ state: 'pending' });
    this.timer = setTimeout(() => void this.flush(), wait);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.saving) await this.saving;
    const p = this.latest;
    if (!p) return;
    this.latest = null;
    this.opts.onStatus?.({ state: 'saving' });
    this.saving = this.opts
      .save(p)
      .then(() => this.opts.onStatus?.({ state: 'saved', at: Date.now() }))
      .catch((e) => {
        // Mantém o estado para nova tentativa na próxima alteração.
        if (!this.latest) this.latest = p;
        this.opts.onStatus?.({ state: 'error', error: e instanceof Error ? e.message : String(e) });
      })
      .finally(() => {
        this.saving = null;
      });
    await this.saving;
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.latest = null;
  }

  get hasPending(): boolean {
    return this.latest !== null || this.saving !== null;
  }
}
