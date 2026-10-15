import type { Project } from '@framestudio/shared';

export interface HistoryEntry {
  label: string;
  before: Project;
  after: Project;
  /** Chave para agrupar alterações contínuas (ex.: arrastar um slider) em uma única entrada. */
  coalesceKey?: string;
  time: number;
}

/**
 * Histórico de desfazer/refazer baseado em snapshots imutáveis. Como o projeto é atualizado com
 * compartilhamento estrutural (immer), cada snapshot custa apenas os nós alterados.
 */
export class History {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  constructor(private readonly limit = 300, private readonly coalesceMs = 1200) {}

  push(entry: Omit<HistoryEntry, 'time'> & { time?: number }): void {
    const time = entry.time ?? Date.now();
    const last = this.past[this.past.length - 1];
    if (entry.coalesceKey && last && last.coalesceKey === entry.coalesceKey && time - last.time < this.coalesceMs && last.after === entry.before) {
      last.after = entry.after;
      last.time = time;
    } else {
      this.past.push({ ...entry, time });
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
  }

  undo(): HistoryEntry | undefined {
    const e = this.past.pop();
    if (e) this.future.push(e);
    return e;
  }

  redo(): HistoryEntry | undefined {
    const e = this.future.pop();
    if (e) this.past.push(e);
    return e;
  }

  /** Interrompe a junção da última entrada (ex.: ao soltar o slider). */
  seal(): void {
    const last = this.past[this.past.length - 1];
    if (last) last.coalesceKey = undefined;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get entries(): readonly HistoryEntry[] {
    return this.past;
  }
  get redoEntries(): readonly HistoryEntry[] {
    return this.future;
  }
  clear(): void {
    this.past = [];
    this.future = [];
  }
}
