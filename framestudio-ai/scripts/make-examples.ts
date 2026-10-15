// Gera projetos de exemplo .fstudio (com mídias empacotadas) usando os pacotes do editor.
// Uso: node --experimental-strip-types scripts/make-examples.ts   (requer `npm run fixtures` antes)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyOp, type EditOp } from '@framestudio/editor-core';
import { createProject, type MediaAsset, type Project } from '@framestudio/shared';
import { writeFstudio } from '@framestudio/project-storage';

const FIX = join(import.meta.dirname, '../tests/fixtures');
const OUT = join(import.meta.dirname, '../examples');

function asset(id: string, file: string, kind: MediaAsset['kind'], meta: Partial<MediaAsset>): MediaAsset {
  const size = readFileSync(join(FIX, file)).length;
  return { id, name: file, kind, mimeType: kind === 'audio' ? 'audio/wav' : kind === 'image' ? 'image/png' : 'video/webm', size, storageKey: `media_${id}`, duration: 0, hasVideo: kind !== 'audio', hasAudio: kind !== 'image', fingerprint: `${file}|${size}|0`, createdAt: Date.now(), ...meta };
}

async function save(p: Project, files: Record<string, string>, name: string) {
  const media = new Map<string, Blob>();
  for (const a of Object.values(p.assets)) media.set(a.storageKey, new Blob([readFileSync(join(FIX, files[a.id]!))], { type: a.mimeType }));
  const blob = await writeFstudio(p, media);
  writeFileSync(join(OUT, name), Buffer.from(await blob.arrayBuffer()));
  console.log('exemplo', name, `${(blob.size / 1024).toFixed(0)} KB`);
}

function run(p: Project, ops: EditOp[]): { p: Project; ids: string[] } {
  const ids: string[] = [];
  for (const op of ops) {
    const r = applyOp(p, op);
    p = r.project;
    ids.push(...r.created);
  }
  return { p, ids };
}

// 1. Horizontal: dois clipes com transição, título animado, música com fade e cor.
{
  let p = createProject({ name: 'Exemplo — Vídeo horizontal', width: 1920, height: 1080, fps: 30 });
  const a = asset('ex_a', 'clip-a.webm', 'video', { duration: 4, width: 640, height: 360, fps: 30, videoCodec: 'vp09', audioCodec: 'opus', audioChannels: 2, sampleRate: 48000 });
  const b = asset('ex_b', 'clip-b.webm', 'video', { duration: 3, width: 640, height: 360, fps: 30, videoCodec: 'vp09', audioCodec: 'opus', audioChannels: 2, sampleRate: 48000 });
  const m = asset('ex_m', 'music.wav', 'audio', { duration: 6, audioChannels: 2, sampleRate: 48000 });
  let r = run(p, [{ type: 'asset.add', asset: a }, { type: 'asset.add', asset: b }, { type: 'asset.add', asset: m }]);
  p = r.p;
  r = run(p, [{ type: 'clip.addAsset', assetId: 'ex_a', start: 0 }, { type: 'clip.addAsset', assetId: 'ex_b', start: 120 }, { type: 'clip.addAsset', assetId: 'ex_m', start: 0 }]);
  p = r.p;
  const [ca, cb, cm] = r.ids as [string, string, string];
  p = run(p, [
    { type: 'transition.add', fromClipId: ca, toClipId: cb, transition: 'dissolve', duration: 24 },
    { type: 'clip.update', clipIds: [ca], patch: { color: { saturation: 0.3, contrast: 0.1 } } },
    { type: 'effect.add', clipIds: [cb], effect: 'vignette' },
    { type: 'clip.trim', clipId: cm, edge: 'end', frame: 210 },
    { type: 'clip.update', clipIds: [cm], patch: { audio: { volume: 0.35, fadeOut: 1.5 } } },
    { type: 'clip.addText', start: 10, duration: 90, style: { content: 'FrameStudio AI', fontSize: 130, animationIn: 'pop', animationOut: 'fade' } },
    { type: 'marker.add', frame: 120, label: 'Transição' },
  ]).p;
  await save(p, { ex_a: 'clip-a.webm', ex_b: 'clip-b.webm', ex_m: 'music.wav' }, 'horizontal-transicao.fstudio');
}

// 2. Vertical 9:16 com foto (zoom), legendas palavra a palavra e narração.
{
  let p = createProject({ name: 'Exemplo — Reels com legendas', width: 1080, height: 1920, fps: 30 });
  const ph = asset('ex_p', 'photo.png', 'image', { width: 800, height: 600 });
  const sp = asset('ex_s', 'speech.wav', 'audio', { duration: 6, audioChannels: 1, sampleRate: 48000 });
  p = run(p, [{ type: 'asset.add', asset: ph }, { type: 'asset.add', asset: sp }]).p;
  const r = run(p, [{ type: 'clip.addAsset', assetId: 'ex_p', start: 0 }, { type: 'clip.addAsset', assetId: 'ex_s', start: 0 }]);
  p = r.p;
  const [photo] = r.ids as [string];
  p = run(p, [
    { type: 'clip.trim', clipId: photo, edge: 'end', frame: 180 },
    { type: 'clip.update', clipIds: [photo], patch: { transform: { fit: 'cover' } } },
    { type: 'effect.add', clipIds: [photo], effect: 'zoom', params: { from: 1, to: 1.25 } },
    {
      type: 'captions.set',
      captions: [
        { start: 0, duration: 30, content: 'Fala número um', words: [{ text: 'Fala', start: 0, end: 0.3 }, { text: 'número', start: 0.3, end: 0.7 }, { text: 'um', start: 0.7, end: 1 }] },
        { start: 75, duration: 30, content: 'Segunda fala', words: [{ text: 'Segunda', start: 0, end: 0.5 }, { text: 'fala', start: 0.5, end: 1 }] },
        { start: 150, duration: 30, content: 'E a última!', words: [{ text: 'E', start: 0, end: 0.2 }, { text: 'a', start: 0.2, end: 0.4 }, { text: 'última!', start: 0.4, end: 1 }] },
      ],
    },
  ]).p;
  const capIds = Object.values(p.clips).filter((c) => c.type === 'caption').map((c) => c.id);
  p = run(p, [{ type: 'clip.update', clipIds: capIds, patch: { caption: { highlightWords: true } } }]).p;
  await save(p, { ex_p: 'photo.png', ex_s: 'speech.wav' }, 'reels-legendas.fstudio');
}
