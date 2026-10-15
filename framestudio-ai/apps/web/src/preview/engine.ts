/**
 * Motor de preview: usa o MESMO Compositor da exportação. Os quadros vêm de elementos <video>
 * (sincronizados ao relógio de áudio durante a reprodução, ou posicionados com seek exato quando
 * pausado) e o áudio vem do mesmo grafo de mixagem usado na exportação.
 */
import { AudioPreviewPlayer } from '@framestudio/audio-engine';
import { seekElement } from '@framestudio/media-engine';
import { Compositor, imageRequests, planFrame, videoRequests, ensureFonts, type FrameSources } from '@framestudio/render-engine';
import type { Project, VideoClip } from '@framestudio/shared';
import { projectDuration, sourceTimeAt } from '@framestudio/timeline';
import { audioStore, getAssetBlob, getAssetUrl } from '../services/media.ts';

interface VideoSlot {
  el: HTMLVideoElement;
  assetId: string;
  proxy: boolean;
  lastUsed: number;
}

export const QUALITY_SCALE = { high: 1, balanced: 0.5, performance: 0.33 } as const;

export interface PreviewStats {
  drawMs: number;
  fps: number;
  droppedFrames: number;
}

export class PreviewEngine {
  private canvas: HTMLCanvasElement | null = null;
  readonly compositor = new Compositor();
  private videos = new Map<string, VideoSlot>();
  private images = new Map<string, ImageBitmap>();
  private imageLoads = new Map<string, Promise<void>>();
  readonly player = new AudioPreviewPlayer();
  private project: Project | null = null;
  private raf = 0;
  private token = 0;
  private rescheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private drawTimes: number[] = [];
  playing = false;
  scale: number = QUALITY_SCALE.balanced;
  useProxies = true;
  hideClipIds: Set<string> = new Set();
  onFrame: (frame: number) => void = () => {};
  onEnded: () => void = () => {};
  onRendered: () => void = () => {};
  stats: PreviewStats = { drawMs: 0, fps: 0, droppedFrames: 0 };

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.resize();
  }

  detach(): void {
    this.pause();
    this.canvas = null;
  }

  setQuality(scale: number): void {
    this.scale = scale;
    this.resize();
  }

  private resize(): void {
    if (!this.canvas || !this.project) return;
    const { width, height } = this.project.settings;
    // Limita a resolução do preview a ~1920 px no maior lado.
    const cap = Math.min(1, 1920 / Math.max(width, height));
    const w = Math.max(2, Math.round(width * this.scale * cap));
    const h = Math.max(2, Math.round(height * this.scale * cap));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setProject(p: Project | null): void {
    const prev = this.project;
    this.project = p;
    if (!p) return;
    if (!prev || prev.settings.width !== p.settings.width || prev.settings.height !== p.settings.height) this.resize();
    void ensureFonts(Object.values(p.clips).flatMap((c) => (c.type === 'text' || c.type === 'caption' ? [c.text] : [])));
    // Libera elementos de clipes removidos.
    for (const [id, slot] of this.videos) {
      if (!p.clips[id]) this.dropVideo(id, slot);
    }
    if (this.playing) {
      if (this.rescheduleTimer) clearTimeout(this.rescheduleTimer);
      this.rescheduleTimer = setTimeout(() => {
        if (this.playing && this.project) {
          void audioStore.prepare(this.project).then(() => this.project && this.player.reschedule(this.project, audioStore.lookup));
        }
      }, 120);
    }
  }

  private dropVideo(id: string, slot: VideoSlot): void {
    slot.el.pause();
    slot.el.removeAttribute('src');
    slot.el.load();
    this.videos.delete(id);
  }

  private video(clip: VideoClip): HTMLVideoElement {
    const wantProxy = this.useProxies && !!this.project?.assets[clip.assetId]?.proxyKey;
    let slot = this.videos.get(clip.id);
    if (slot && (slot.assetId !== clip.assetId || slot.proxy !== wantProxy)) {
      this.dropVideo(clip.id, slot);
      slot = undefined;
    }
    if (!slot) {
      const el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.preload = 'auto';
      el.disablePictureInPicture = true;
      slot = { el, assetId: clip.assetId, proxy: wantProxy, lastUsed: performance.now() };
      this.videos.set(clip.id, slot);
      void getAssetUrl(clip.assetId, { proxy: wantProxy }).then((url) => {
        if (url && this.videos.get(clip.id)?.el === el) {
          el.src = url;
          el.load();
        }
      });
    }
    slot.lastUsed = performance.now();
    return slot.el;
  }

  private ensureImage(assetId: string): Promise<void> {
    if (this.images.has(assetId)) return Promise.resolve();
    let p = this.imageLoads.get(assetId);
    if (!p) {
      p = (async () => {
        const blob = await getAssetBlob(assetId);
        if (blob) this.images.set(assetId, await createImageBitmap(blob, { imageOrientation: 'from-image' }));
      })().finally(() => this.imageLoads.delete(assetId));
      this.imageLoads.set(assetId, p);
    }
    return p;
  }

  private sources: FrameSources = {
    video: (clip) => {
      const el = this.videos.get(clip.id)?.el;
      return el && el.readyState >= 2 && el.videoWidth > 0 ? el : null;
    },
    image: (id) => this.images.get(id) ?? null,
  };

  private draw(frame: number): void {
    if (!this.canvas || !this.project) return;
    const t0 = performance.now();
    this.compositor.render(this.canvas, this.project, frame, this.sources, { hideClipIds: this.hideClipIds });
    const dt = performance.now() - t0;
    this.drawTimes.push(dt);
    if (this.drawTimes.length > 30) this.drawTimes.shift();
    this.stats.drawMs = this.drawTimes.reduce((a, b) => a + b, 0) / this.drawTimes.length;
    this.onRendered();
  }

  /** Renderiza um frame exato (pausado): faz seek dos vídeos e espera os quadros. */
  async renderAt(frame: number): Promise<void> {
    if (this.playing || !this.project) return;
    const token = ++this.token;
    const project = this.project;
    const plan = planFrame(project, frame);
    const reqs = videoRequests(project, plan, frame);
    await Promise.all([
      ...reqs.map(async (r) => {
        const el = this.video(r.clip);
        if (el.readyState < 1) await waitEvent(el, 'loadedmetadata', 8000);
        if (token !== this.token) return;
        if (!el.paused) el.pause();
        await seekElement(el, r.time);
      }),
      ...imageRequests(plan).map((id) => this.ensureImage(id)),
    ]);
    if (token !== this.token || this.playing) return;
    this.draw(frame);
  }

  /** Redesenha sem seek (ex.: mudança de propriedades visuais). */
  redraw(frame: number): void {
    if (this.playing) return;
    void this.renderAt(frame);
  }

  async play(fromFrame: number): Promise<void> {
    const p = this.project;
    if (!p || this.playing) return;
    const fps = p.settings.fps;
    const end = projectDuration(p);
    if (end <= 0) return;
    let start = fromFrame >= end - 1 ? 0 : fromFrame;
    this.playing = true;
    this.token++;
    await audioStore.prepare(p);
    if (!this.playing) return;
    // Pré-posiciona os vídeos do primeiro frame.
    const plan = planFrame(p, start);
    await Promise.all(videoRequests(p, plan, start).map((r) => seekElement(this.video(r.clip), r.time)));
    if (!this.playing) return;
    start = Math.max(0, start);
    await this.player.play(p, audioStore.lookup, start / fps);
    this.lastFrameTime = performance.now();
    this.frameTimes = [];
    const tick = () => {
      if (!this.playing || !this.project) return;
      const proj = this.project;
      const now = performance.now();
      this.frameTimes.push(now - this.lastFrameTime);
      this.lastFrameTime = now;
      if (this.frameTimes.length > 60) this.frameTimes.shift();
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.stats.fps = avg > 0 ? 1000 / avg : 0;
      const frame = this.player.currentTime() * proj.settings.fps;
      const duration = projectDuration(proj);
      if (frame >= duration) {
        this.pause();
        this.onFrame(duration);
        this.onEnded();
        return;
      }
      this.syncVideos(proj, frame);
      this.draw(frame);
      this.onFrame(frame);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private syncVideos(p: Project, frame: number): void {
    const fps = p.settings.fps;
    const plan = planFrame(p, frame);
    const active = new Set<string>();
    for (const r of videoRequests(p, plan, frame)) {
      active.add(r.clip.id);
      const el = this.video(r.clip);
      if (el.readyState < 1) continue;
      const c = r.clip;
      if (!c.reverse && !c.freeze) {
        const rate = Math.max(0.0625, Math.min(16, c.speed));
        if (Math.abs(el.playbackRate - rate) > 1e-3) el.playbackRate = rate;
        const drift = Math.abs(el.currentTime - r.time);
        if (el.paused) {
          if (drift > 0.05) el.currentTime = r.time;
          void el.play().catch(() => {});
        } else if (drift > 0.25 && !el.seeking) {
          el.currentTime = r.time;
        }
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - r.time) > 1 / fps && !el.seeking) el.currentTime = r.time;
      }
    }
    // Pré-carrega clipes que começam no próximo 1,5 s.
    const ahead = frame + fps * 1.5;
    for (const id in p.clips) {
      const c = p.clips[id]!;
      if (c.type !== 'video' || active.has(c.id)) continue;
      if (c.start > frame && c.start <= ahead) {
        const el = this.video(c);
        const t = sourceTimeAt(c, c.start, fps, p.assets[c.assetId]);
        if (el.readyState >= 1 && el.paused && !el.seeking && Math.abs(el.currentTime - t) > 0.05) el.currentTime = t;
        active.add(c.id);
      }
    }
    for (const [id, slot] of this.videos) {
      if (!active.has(id) && !slot.el.paused) slot.el.pause();
    }
    // Libera elementos ociosos há mais de 20 s (memória).
    const now = performance.now();
    for (const [id, slot] of this.videos) if (!active.has(id) && now - slot.lastUsed > 20000) this.dropVideo(id, slot);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.player.stop();
    for (const slot of this.videos.values()) slot.el.pause();
  }

  setVolume(v: number): void {
    this.player.setVolume(v);
  }

  /** Quadro atual como PNG (para miniatura do projeto). */
  async snapshot(maxWidth = 320): Promise<string | null> {
    if (!this.canvas) return null;
    const k = Math.min(1, maxWidth / this.canvas.width);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.canvas.width * k));
    c.height = Math.max(1, Math.round(this.canvas.height * k));
    c.getContext('2d')!.drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }

  dispose(): void {
    this.pause();
    for (const [id, slot] of this.videos) this.dropVideo(id, slot);
    for (const b of this.images.values()) b.close();
    this.images.clear();
    this.compositor.dispose();
    void this.player.dispose();
  }
}

function waitEvent(el: HTMLMediaElement, ev: string, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, timeout);
    function done() {
      clearTimeout(t);
      el.removeEventListener(ev, done);
      el.removeEventListener('error', done);
      resolve();
    }
    el.addEventListener(ev, done);
    el.addEventListener('error', done);
  });
}

/** Instância única (o editor tem um único monitor de preview). */
export const preview = new PreviewEngine();
