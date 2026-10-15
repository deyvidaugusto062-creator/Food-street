import { describe, expect, it } from 'vitest';
import { createProject, type MediaAsset, type Project, type TextClip } from '@framestudio/shared';
import { applyOp } from '@framestudio/editor-core';
import { planFrame, transitionWindow } from './plan.ts';
import { resolveVisual } from './resolve.ts';
import { outputSize, videoBitrate, estimateExportBytes } from './export.ts';

const asset: MediaAsset = { id: 'a', name: 'a', kind: 'video', mimeType: 'video/webm', size: 1, storageKey: 'k', duration: 4, width: 640, height: 360, hasVideo: true, hasAudio: true, fingerprint: 'f', createdAt: 0 };

function twoClips(): { p: Project; a: string; b: string } {
  let p = createProject({ name: 'x', width: 1920, height: 1080, fps: 30 });
  p = applyOp(p, { type: 'asset.add', asset }).project;
  const ra = applyOp(p, { type: 'clip.addAsset', assetId: 'a', start: 0 });
  const rb = applyOp(ra.project, { type: 'clip.addAsset', assetId: 'a', start: 120 });
  return { p: rb.project, a: ra.created[0]!, b: rb.created[0]! };
}

describe('planFrame', () => {
  it('usa a transição centrada no corte', () => {
    const { p: p0, a, b } = twoClips();
    const p = applyOp(p0, { type: 'transition.add', fromClipId: a, toClipId: b, transition: 'dissolve', duration: 30 }).project;
    const t = Object.values(p.transitions)[0]!;
    expect(transitionWindow(t, p.clips[b]!)).toEqual([105, 135]);
    expect(planFrame(p, 104).find((x) => x.clip)?.clip?.id).toBe(a);
    const mid = planFrame(p, 120).find((x) => x.transition);
    expect(mid?.transition?.progress).toBeCloseTo(0.5, 1);
    expect(planFrame(p, 135).find((x) => x.clip)?.clip?.id).toBe(b);
  });

  it('respeita faixas ocultas e ordem de composição', () => {
    const { p } = twoClips();
    const withText = applyOp(p, { type: 'clip.addText', start: 0, duration: 30 }).project;
    const plan = planFrame(withText, 10);
    expect(plan.map((x) => x.track.kind)).toEqual(['video', 'text']); // de baixo para cima
    const textTrack = withText.tracks.find((t) => t.kind === 'text')!;
    const hidden = applyOp(withText, { type: 'track.update', trackId: textTrack.id, patch: { hidden: true } }).project;
    expect(planFrame(hidden, 10).map((x) => x.track.kind)).toEqual(['video']);
  });
});

describe('resolveVisual', () => {
  it('interpola keyframes e aplica animação de texto', () => {
    let p = createProject({ name: 'x', width: 1920, height: 1080, fps: 30 });
    const r = applyOp(p, { type: 'clip.addText', start: 0, duration: 100, style: { animationIn: 'fade', animationDuration: 10 } });
    p = r.project;
    const id = r.created[0]!;
    p = applyOp(p, { type: 'keyframe.set', clipId: id, prop: 'x', frame: 0, value: -100, easing: 'linear' }).project;
    p = applyOp(p, { type: 'keyframe.set', clipId: id, prop: 'x', frame: 50, value: 100, easing: 'linear' }).project;
    const c = p.clips[id] as TextClip;
    expect(resolveVisual(p, c, 25).x).toBeCloseTo(0);
    expect(resolveVisual(p, c, 0).opacity).toBeCloseTo(0);
    expect(resolveVisual(p, c, 50).opacity).toBeCloseTo(1);
  });

  it('efeito zoom e tremor são determinísticos', () => {
    let p = createProject({ name: 'x', width: 1920, height: 1080, fps: 30 });
    const r = applyOp(p, { type: 'clip.addText', start: 0, duration: 101 });
    p = applyOp(r.project, { type: 'effect.add', clipIds: [r.created[0]!], effect: 'zoom', params: { from: 1, to: 2 } }).project;
    p = applyOp(p, { type: 'effect.add', clipIds: [r.created[0]!], effect: 'shake' }).project;
    const c = p.clips[r.created[0]!] as TextClip;
    expect(resolveVisual(p, c, 50).extraScale).toBeCloseTo(1.5);
    expect(resolveVisual(p, c, 33).x).toBe(resolveVisual(p, c, 33).x);
  });
});

describe('exportação: tamanho e bitrate', () => {
  it('calcula a saída pelo menor lado e mantém dimensões pares', () => {
    const p = createProject({ name: 'v', width: 1080, height: 1920, fps: 30 });
    expect(outputSize(p, 720)).toEqual({ width: 720, height: 1280 });
    const h = createProject({ name: 'h', width: 2560, height: 1080, fps: 30 });
    expect(outputSize(h, 1080)).toEqual({ width: 2560, height: 1080 });
    expect(outputSize(h, 0)).toEqual({ width: 2560, height: 1080 });
  });
  it('estimativa coerente com o bitrate', () => {
    const { p } = twoClips();
    const s = { ...p.exportSettings, quality: 'custom' as const, videoBitrate: 4_000_000, audioBitrate: 128_000 };
    const bytes = estimateExportBytes(p, s);
    const secs = 8; // dois clipes de 4 s
    expect(bytes).toBeGreaterThan(((4_000_000 + 128_000) * secs) / 8);
    expect(bytes).toBeLessThan((((4_000_000 + 128_000) * secs) / 8) * 1.05);
    expect(videoBitrate({ ...s, quality: 'high', videoCodec: 'av1' }, 1920, 1080)).toBeLessThan(videoBitrate({ ...s, quality: 'high', videoCodec: 'avc' }, 1920, 1080));
  });
});
