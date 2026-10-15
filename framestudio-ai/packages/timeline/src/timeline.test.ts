import { describe, expect, it } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
import { createProject, type MediaAsset, type Project, type VideoClip } from '@framestudio/shared';
import {
  addTransition,
  clipEnd,
  createMediaClipFromAsset,
  createTextClip,
  detachAudio,
  duplicateClips,
  evaluateKeyframes,
  freezeFrame,
  getTrackClips,
  insertClip,
  moveClips,
  placeClip,
  projectDuration,
  removeClips,
  setClipSpeed,
  setProjectFps,
  slipClip,
  snapRange,
  sourceTimeAt,
  splitClip,
  trimClip,
  upsertKeyframe,
} from './index.ts';

setAutoFreeze(false);

function asset(id: string, duration = 10, kind: MediaAsset['kind'] = 'video'): MediaAsset {
  return {
    id,
    name: `${id}.webm`,
    kind,
    mimeType: 'video/webm',
    size: 1000,
    storageKey: id,
    duration,
    width: 1280,
    height: 720,
    fps: 30,
    hasVideo: kind !== 'audio',
    hasAudio: kind !== 'image',
    fingerprint: id,
    createdAt: 0,
  };
}

function setup(): { p: Project; video: string; audio: string; text: string } {
  const p = createProject({ name: 't', width: 1920, height: 1080, fps: 30 });
  p.assets.a = asset('a', 10);
  p.assets.b = asset('b', 4);
  const [text, video, audio] = p.tracks.map((t) => t.id) as [string, string, string];
  return { p, video, audio, text };
}

const mut = (p: Project, fn: (d: Project) => void) => produce(p, fn);

describe('timeline', () => {
  it('adiciona clipe com duração da mídia', () => {
    const { p, video } = setup();
    const c = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    const p2 = mut(p, (d) => void insertClip(d, c));
    expect(p2.clips[c.id]!.duration).toBe(300);
    expect(projectDuration(p2)).toBe(300);
  });

  it('impede sobreposição e placeClip cria nova faixa quando necessário', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    const b = createMediaClipFromAsset(p.assets.b!, video, 100, 30);
    let s = mut(p, (d) => void insertClip(d, a));
    expect(() => mut(s, (d) => void insertClip(d, structuredClone(b)))).toThrow(/intervalo/);
    s = mut(s, (d) => void placeClip(d, b, video));
    expect(s.clips[b.id]!.trackId).not.toBe(video);
    expect(s.tracks.filter((t) => t.kind === 'video')).toHaveLength(2);
  });

  it('divide preservando a continuidade da mídia', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 30, 30);
    let s = mut(p, (d) => void insertClip(d, a));
    let rightId = '';
    s = mut(s, (d) => {
      rightId = splitClip(d, a.id, 120);
    });
    const left = s.clips[a.id] as VideoClip;
    const right = s.clips[rightId] as VideoClip;
    expect(left.duration).toBe(90);
    expect(right.start).toBe(120);
    expect(right.duration).toBe(210);
    expect(right.sourceIn).toBeCloseTo(3);
    // O mesmo frame mostra o mesmo tempo de origem antes e depois da divisão.
    expect(sourceTimeAt(right, 150, 30)).toBeCloseTo(sourceTimeAt(a, 150, 30));
    expect(() => mut(s, (d) => void splitClip(d, a.id, 30))).toThrow();
  });

  it('divide clipe reverso corretamente', () => {
    const { p, video } = setup();
    const a = { ...createMediaClipFromAsset(p.assets.a!, video, 0, 30), reverse: true } as VideoClip;
    let s = mut(p, (d) => void insertClip(d, a));
    let rightId = '';
    s = mut(s, (d) => {
      rightId = splitClip(d, a.id, 90);
    });
    const left = s.clips[a.id] as VideoClip;
    const right = s.clips[rightId] as VideoClip;
    for (const f of [0, 45, 89]) expect(sourceTimeAt(left, f, 30)).toBeCloseTo(sourceTimeAt(a, f, 30));
    for (const f of [90, 200, 299]) expect(sourceTimeAt(right, f, 30)).toBeCloseTo(sourceTimeAt(a, f, 30));
  });

  it('apara início e fim respeitando a mídia e vizinhos', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.b!, video, 0, 30); // 120 frames
    const b = createMediaClipFromAsset(p.assets.a!, video, 200, 30);
    b.duration = 30;
    let s = mut(p, (d) => {
      insertClip(d, a);
      insertClip(d, b);
    });
    s = mut(s, (d) => slipClip(d, b.id, 5));
    s = mut(s, (d) => trimClip(d, a.id, 'start', 30));
    expect(s.clips[a.id]!.start).toBe(30);
    expect((s.clips[a.id] as VideoClip).sourceIn).toBeCloseTo(1);
    // Não pode estender além do fim da mídia.
    s = mut(s, (d) => trimClip(d, a.id, 'end', 1000));
    expect(clipEnd(s.clips[a.id]!)).toBe(120);
    // Estender o início de volta até o início da mídia.
    s = mut(s, (d) => trimClip(d, a.id, 'start', -50));
    expect(s.clips[a.id]!.start).toBe(0);
    expect((s.clips[a.id] as VideoClip).sourceIn).toBeCloseTo(0);
    // Não invade o clipe seguinte.
    s = mut(s, (d) => trimClip(d, b.id, 'start', 50));
    expect(s.clips[b.id]!.start).toBe(120);
  });

  it('ripple trim desloca clipes seguintes', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    const b = createMediaClipFromAsset(p.assets.b!, video, 300, 30);
    let s = mut(p, (d) => {
      insertClip(d, a);
      insertClip(d, b);
    });
    s = mut(s, (d) => trimClip(d, a.id, 'end', 200, true));
    expect(s.clips[b.id]!.start).toBe(200);
  });

  it('remove com ripple fecha o espaço', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.b!, video, 0, 30);
    const b = createMediaClipFromAsset(p.assets.b!, video, 120, 30);
    let s = mut(p, (d) => {
      insertClip(d, a);
      insertClip(d, b);
    });
    s = mut(s, (d) => removeClips(d, [a.id], true));
    expect(s.clips[b.id]!.start).toBe(0);
  });

  it('move clipes e rejeita sobreposição', () => {
    const { p, video, text } = setup();
    const a = createMediaClipFromAsset(p.assets.b!, video, 0, 30);
    const b = createMediaClipFromAsset(p.assets.b!, video, 200, 30);
    const t = createTextClip(text, 0, 60);
    let s = mut(p, (d) => {
      insertClip(d, a);
      insertClip(d, b);
      insertClip(d, t);
    });
    s = mut(s, (d) => moveClips(d, [a.id], 30));
    expect(s.clips[a.id]!.start).toBe(30);
    expect(() => mut(s, (d) => moveClips(d, [a.id], 100))).toThrow(/Sobreposição/);
    // Mover os dois juntos não colide entre si.
    s = mut(s, (d) => moveClips(d, [a.id, b.id], 10));
    expect(s.clips[b.id]!.start).toBe(210);
    // Texto não pode ir para faixa de áudio.
    const audioTrack = s.tracks.find((x) => x.kind === 'audio')!.id;
    expect(() => mut(s, (d) => moveClips(d, [t.id], 0, audioTrack))).toThrow();
    // Delta negativo é limitado ao zero.
    s = mut(s, (d) => moveClips(d, [t.id], -500));
    expect(s.clips[t.id]!.start).toBe(0);
  });

  it('slip mantém posição e muda o ponto de entrada dentro dos limites', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    a.duration = 90;
    let s = mut(p, (d) => void insertClip(d, a));
    s = mut(s, (d) => slipClip(d, a.id, 2.5));
    expect((s.clips[a.id] as VideoClip).sourceIn).toBeCloseTo(2.5);
    s = mut(s, (d) => slipClip(d, a.id, 100));
    expect((s.clips[a.id] as VideoClip).sourceIn).toBeCloseTo(7);
    expect(s.clips[a.id]!.start).toBe(0);
  });

  it('velocidade altera a duração e respeita a mídia', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    let s = mut(p, (d) => void insertClip(d, a));
    s = mut(s, (d) => setClipSpeed(d, a.id, 2));
    expect(s.clips[a.id]!.duration).toBe(150);
    s = mut(s, (d) => setClipSpeed(d, a.id, 0.5));
    expect(s.clips[a.id]!.duration).toBe(600);
    expect(() => mut(s, (d) => setClipSpeed(d, a.id, 100))).toThrow();
  });

  it('transições exigem clipes adjacentes e são removidas ao separar', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.b!, video, 0, 30);
    const b = createMediaClipFromAsset(p.assets.b!, video, 120, 30);
    let s = mut(p, (d) => {
      insertClip(d, a);
      insertClip(d, b);
      addTransition(d, a.id, b.id, { type: 'dissolve', duration: 30 });
    });
    expect(Object.keys(s.transitions)).toHaveLength(1);
    s = mut(s, (d) => moveClips(d, [b.id], 10));
    expect(Object.keys(s.transitions)).toHaveLength(0);
    expect(() => mut(s, (d) => void addTransition(d, a.id, b.id, { type: 'wipe', duration: 30 }))).toThrow(/encostados/);
  });

  it('duplica após a seleção', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.b!, video, 0, 30);
    let ids: string[] = [];
    const s = mut(mut(p, (d) => void insertClip(d, a)), (d) => {
      ids = duplicateClips(d, [a.id]);
    });
    expect(s.clips[ids[0]!]!.start).toBe(120);
    expect(s.clips[ids[0]!]!.trackId).toBe(video);
  });

  it('congela frame e empurra o restante', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    let fid = '';
    const s = mut(mut(p, (d) => void insertClip(d, a)), (d) => {
      fid = freezeFrame(d, a.id, 60, 45);
    });
    const list = getTrackClips(s, video);
    expect(list.map((c) => [c.start, c.duration])).toEqual([
      [0, 60],
      [60, 45],
      [105, 240],
    ]);
    const fr = s.clips[fid] as VideoClip;
    expect(fr.freeze).toBe(true);
    expect(fr.sourceIn).toBeCloseTo(2);
  });

  it('separa o áudio do vídeo', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    let id = '';
    const s = mut(mut(p, (d) => void insertClip(d, a)), (d) => {
      id = detachAudio(d, a.id);
    });
    expect(s.clips[id]!.type).toBe('audio');
    expect((s.clips[a.id] as VideoClip).audio.muted).toBe(true);
  });

  it('keyframes interpolam e sobrevivem à divisão', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 0, 30);
    let s = mut(p, (d) => void insertClip(d, a));
    s = mut(s, (d) => {
      const c = d.clips[a.id]!;
      upsertKeyframe(c, 'opacity', 0, 0, 'linear');
      upsertKeyframe(c, 'opacity', 100, 1, 'linear');
    });
    expect(evaluateKeyframes(s.clips[a.id]!.keyframes.opacity, 50, 1)).toBeCloseTo(0.5);
    let r = '';
    s = mut(s, (d) => {
      r = splitClip(d, a.id, 50);
    });
    expect(evaluateKeyframes(s.clips[r]!.keyframes.opacity, 0, 1)).toBeCloseTo(0.5);
    expect(evaluateKeyframes(s.clips[r]!.keyframes.opacity, 50, 1)).toBeCloseTo(1);
    expect(evaluateKeyframes(s.clips[a.id]!.keyframes.opacity, 25, 1)).toBeCloseTo(0.25);
  });

  it('mudar FPS preserva o tempo real', () => {
    const { p, video } = setup();
    const a = createMediaClipFromAsset(p.assets.a!, video, 30, 30);
    const s = mut(mut(p, (d) => void insertClip(d, a)), (d) => setProjectFps(d, 60));
    expect(s.clips[a.id]!.start).toBe(60);
    expect(s.clips[a.id]!.duration).toBe(600);
  });

  it('snap magnético', () => {
    expect(snapRange(97, 50, [0, 100, 200], 5)).toEqual({ start: 100, snappedTo: 100 });
    expect(snapRange(152, 50, [0, 100, 200], 5)).toEqual({ start: 150, snappedTo: 200 });
    expect(snapRange(120, 50, [0, 100, 200], 5).snappedTo).toBeNull();
  });
});
