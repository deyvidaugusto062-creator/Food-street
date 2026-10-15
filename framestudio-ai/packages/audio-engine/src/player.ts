import type { Project } from '@framestudio/shared';
import { buildMix, type BufferLookup, type ScheduledMix } from './mix.ts';

/**
 * Relógio mestre do preview: o áudio é a referência de tempo e o vídeo segue.
 * Sem áudio audível, usa performance.now().
 */
export class AudioPreviewPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mix: ScheduledMix | null = null;
  private startCtxTime = 0;
  private startPerf = 0;
  private fromSec = 0;
  private rate = 1;
  playing = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  get context(): AudioContext {
    return this.ensure();
  }

  setVolume(v: number): void {
    this.ensure();
    this.master!.gain.value = v;
  }

  async play(project: Project, lookup: BufferLookup, fromSec: number): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    this.stopNodes();
    const when = ctx.currentTime + 0.06;
    this.mix = buildMix(ctx, project, lookup, { from: fromSec, when, destination: this.master! });
    this.startCtxTime = when;
    this.startPerf = performance.now() + 60;
    this.fromSec = fromSec;
    this.playing = true;
  }

  /** Reagenda a mixagem sem saltar o relógio (ex.: projeto alterado durante a reprodução). */
  reschedule(project: Project, lookup: BufferLookup): void {
    if (!this.playing || !this.ctx) return;
    const now = this.currentTime();
    this.stopNodes();
    const when = this.ctx.currentTime + 0.03;
    this.mix = buildMix(this.ctx, project, lookup, { from: now + 0.03, when, destination: this.master! });
  }

  stop(): void {
    this.stopNodes();
    this.playing = false;
  }

  private stopNodes(): void {
    this.mix?.stop();
    this.mix = null;
  }

  /** Tempo atual do projeto (s) segundo o relógio de áudio. */
  currentTime(): number {
    if (!this.playing) return this.fromSec;
    if (this.ctx && this.ctx.state === 'running') return this.fromSec + Math.max(0, this.ctx.currentTime - this.startCtxTime) * this.rate;
    return this.fromSec + Math.max(0, performance.now() - this.startPerf) / 1000;
  }

  async dispose(): Promise<void> {
    this.stop();
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
