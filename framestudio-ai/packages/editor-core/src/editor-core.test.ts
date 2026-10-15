import { describe, expect, it } from 'vitest';
import { createProject, type MediaAsset, type Project, type TextClip, type VideoClip } from '@framestudio/shared';
import { applyOp, History, sanitizeClip, type EditOp } from './index.ts';

const asset: MediaAsset = {
  id: 'a1',
  name: 'a.webm',
  kind: 'video',
  mimeType: 'video/webm',
  size: 1,
  storageKey: 'k',
  duration: 10,
  width: 1280,
  height: 720,
  hasVideo: true,
  hasAudio: true,
  fingerprint: 'f',
  createdAt: 0,
};

function base(): Project {
  let p = createProject({ name: 'P', width: 1920, height: 1080, fps: 30 });
  p = applyOp(p, { type: 'asset.add', asset }).project;
  return p;
}

describe('applyOp', () => {
  it('é atômico: um erro no meio de um batch não altera o projeto', () => {
    const p = base();
    const op: EditOp = {
      type: 'batch',
      ops: [
        { type: 'clip.addAsset', assetId: 'a1', start: 0 },
        { type: 'clip.remove', clipIds: ['inexistente'] },
      ],
    };
    expect(() => applyOp(p, op)).toThrow(/não encontrado/);
    expect(Object.keys(p.clips)).toHaveLength(0);
  });

  it('não muta o projeto original (imutabilidade estrutural)', () => {
    const p = base();
    const r = applyOp(p, { type: 'clip.addAsset', assetId: 'a1', start: 0 });
    expect(Object.keys(p.clips)).toHaveLength(0);
    expect(Object.keys(r.project.clips)).toHaveLength(1);
    expect(r.project.assets).toBe(p.assets);
  });

  it('valida patches: rejeita chaves proibidas, desconhecidas e tipos errados', () => {
    let p = base();
    const r = applyOp(p, { type: 'clip.addAsset', assetId: 'a1', start: 0 });
    p = r.project;
    const id = r.created[0]!;
    expect(() => applyOp(p, { type: 'clip.update', clipIds: [id], patch: { start: 5 } })).toThrow(/não pode/);
    expect(() => applyOp(p, { type: 'clip.update', clipIds: [id], patch: { hacker: 1 } })).toThrow(/desconhecida/);
    expect(() => applyOp(p, { type: 'clip.update', clipIds: [id], patch: { opacity: 'x' } })).toThrow(/Tipo/);
    // JSON com "__proto__" (vindo de IA/arquivo) cria uma chave própria: deve ser rejeitada.
    expect(() => applyOp(p, { type: 'clip.update', clipIds: [id], patch: JSON.parse('{"__proto__": {"polluted": true}}') })).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const ok = applyOp(p, { type: 'clip.update', clipIds: [id], patch: { opacity: 5, transform: { x: 10 } } }).project;
    const c = ok.clips[id] as VideoClip;
    expect(c.opacity).toBe(1); // limitado
    expect(c.transform.x).toBe(10);
    expect(c.transform.scale).toBe(1); // merge profundo preserva o resto
  });

  it('efeitos, keyframes e transições', () => {
    let p = base();
    const a = applyOp(p, { type: 'clip.addAsset', assetId: 'a1', start: 0 });
    p = a.project;
    const b = applyOp(p, { type: 'clip.addAsset', assetId: 'a1', start: 300 });
    p = b.project;
    const [ida] = a.created;
    const [idb] = b.created;
    p = applyOp(p, { type: 'effect.add', clipIds: [ida!], effect: 'blur' }).project;
    const fx = (p.clips[ida!] as VideoClip).effects[0]!;
    expect(fx.params.radius).toBe(8);
    p = applyOp(p, { type: 'keyframe.set', clipId: ida!, prop: `effect:${fx.id}:radius`, frame: 10, value: 20 }).project;
    expect(() => applyOp(p, { type: 'keyframe.set', clipId: ida!, prop: 'effect:nada:radius', frame: 0, value: 1 })).toThrow();
    p = applyOp(p, { type: 'transition.add', fromClipId: ida!, toClipId: idb!, transition: 'wipe', duration: 20 }).project;
    expect(Object.values(p.transitions)[0]!.type).toBe('wipe');
    p = applyOp(p, { type: 'effect.remove', clipId: ida!, effectId: fx.id }).project;
    expect(Object.keys(p.clips[ida!]!.keyframes)).toHaveLength(0);
  });

  it('cria legendas numa faixa própria', () => {
    const p = applyOp(base(), {
      type: 'captions.set',
      captions: [
        { start: 0, duration: 30, content: 'Olá', words: [{ text: 'Olá', start: 0, end: 0.5 }] },
        { start: 30, duration: 30, content: 'mundo' },
      ],
    }).project;
    const track = p.tracks.find((t) => t.kind === 'caption')!;
    const caps = Object.values(p.clips).filter((c) => c.trackId === track.id);
    expect(caps).toHaveLength(2);
  });

  it('adiciona texto com estilo e nome', () => {
    const r = applyOp(base(), { type: 'clip.addText', start: 0, duration: 60, style: { content: 'Meu título\nlinha 2' } });
    const t = r.project.clips[r.created[0]!] as TextClip;
    expect(t.text.content).toBe('Meu título\nlinha 2');
    expect(t.name).toBe('Meu título\nlinha 2'.slice(0, 32));
  });
});

describe('History', () => {
  it('desfaz, refaz e agrupa alterações contínuas', () => {
    const h = new History();
    const p0 = base();
    const p1 = applyOp(p0, { type: 'clip.addAsset', assetId: 'a1', start: 0 });
    h.push({ label: 'add', before: p0, after: p1.project, time: 0 });
    const id = p1.created[0]!;
    const p2 = applyOp(p1.project, { type: 'clip.update', clipIds: [id], patch: { opacity: 0.5 } }).project;
    h.push({ label: 'op', before: p1.project, after: p2, coalesceKey: 'op', time: 100 });
    const p3 = applyOp(p2, { type: 'clip.update', clipIds: [id], patch: { opacity: 0.2 } }).project;
    h.push({ label: 'op', before: p2, after: p3, coalesceKey: 'op', time: 200 });
    expect(h.entries).toHaveLength(2);
    expect(h.undo()!.before).toBe(p1.project);
    expect(h.undo()!.before).toBe(p0);
    expect(h.canUndo).toBe(false);
    expect(h.redo()!.after).toBe(p1.project);
  });
});

describe('sanitizeClip', () => {
  it('limita valores fora do intervalo', () => {
    const p = applyOp(base(), { type: 'clip.addText', start: 0, duration: 10 }).project;
    const t = structuredClone(Object.values(p.clips)[0]!) as TextClip;
    t.text.fontSize = 99999;
    t.text.fontWeight = 450;
    t.transform.scale = -2;
    sanitizeClip(t);
    expect(t.text.fontSize).toBe(1000);
    expect(t.text.fontWeight).toBe(500);
    expect(t.transform.scale).toBe(0.01);
  });
});
