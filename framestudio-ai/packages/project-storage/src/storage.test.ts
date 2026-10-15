import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, PROJECT_FORMAT_VERSION, type MediaAsset } from '@framestudio/shared';
import { createTextClip } from '@framestudio/timeline';
import { Autosaver, Idb, IdbBlobStore, migrateProject, ProjectRepository, readFstudio, writeFstudio } from './index.ts';

let repo: ProjectRepository;
beforeEach(() => {
  const db = new Idb('test-' + Math.random(), new IDBFactory());
  repo = new ProjectRepository({ db, blobs: new IdbBlobStore(db) });
});

const asset = (id: string): MediaAsset => ({
  id,
  name: 'clip.webm',
  kind: 'video',
  mimeType: 'video/webm',
  size: 3,
  storageKey: 'media_' + id,
  duration: 2,
  hasVideo: true,
  hasAudio: false,
  fingerprint: 'f',
  createdAt: 0,
});

describe('ProjectRepository', () => {
  it('salva, lista, recarrega, renomeia, duplica e exclui', async () => {
    const p = createProject({ name: 'Meu vídeo', width: 1080, height: 1920, fps: 30 });
    const t = createTextClip(p.tracks[0]!.id, 0, 90);
    p.clips[t.id] = t;
    await repo.save(p);
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.durationFrames).toBe(90);
    const loaded = await repo.load(p.id);
    expect(loaded.clips[t.id]).toEqual(t);
    await repo.rename(p.id, 'Novo nome');
    expect((await repo.load(p.id)).name).toBe('Novo nome');
    const copy = await repo.duplicate(p.id);
    expect((await repo.list()).map((s) => s.id).sort()).toEqual([p.id, copy.id].sort());
    await repo.delete(p.id);
    expect((await repo.list()).map((s) => s.id)).toEqual([copy.id]);
  });

  it('mantém ponto de recuperação até o salvamento explícito', async () => {
    const p = createProject({ name: 'R', width: 640, height: 360, fps: 25 });
    await repo.save(p);
    await repo.saveRecovery({ ...p, name: 'R editado' });
    expect((await repo.list())[0]!.hasRecovery).toBe(true);
    expect((await repo.loadRecovery(p.id))!.project.name).toBe('R editado');
    await repo.save(p);
    expect(await repo.loadRecovery(p.id)).toBeUndefined();
  });

  it('remove mídia órfã ao excluir projeto', async () => {
    const p = createProject({ name: 'M', width: 640, height: 360, fps: 25 });
    p.assets.a = asset('a');
    await repo.putMedia('media_a', new Blob([new Uint8Array([1, 2, 3])]));
    await repo.save(p);
    expect(await repo.missingAssets(p)).toHaveLength(0);
    await repo.delete(p.id);
    expect(await repo.getMedia('media_a')).toBeUndefined();
  });
});

describe('.fstudio', () => {
  it('ida e volta com mídia empacotada', async () => {
    const p = createProject({ name: 'Pacote', width: 1280, height: 720, fps: 30 });
    p.assets.a = asset('a');
    const media = new Map([['media_a', new Blob([new Uint8Array([9, 8, 7])])]]);
    const blob = await writeFstudio(p, media);
    const r = await readFstudio(blob, { newId: true });
    expect(r.project.id).not.toBe(p.id);
    expect(r.project.name).toBe('Pacote');
    expect(r.manifest.packaged).toBe(true);
    expect(new Uint8Array(await r.media.get('media_a')!.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('rejeita arquivos inválidos', async () => {
    await expect(readFstudio(new Blob(['não é zip']))).rejects.toThrow(/válido/);
  });
});

describe('migrações', () => {
  it('preenche campos ausentes e descarta clipes órfãos', () => {
    const p = createProject({ name: 'X', width: 100, height: 100, fps: 30 });
    const raw = JSON.parse(JSON.stringify(p));
    raw.clips = {
      a: { id: 'a', type: 'text', trackId: p.tracks[0]!.id, start: 0, duration: 10, name: 't', text: { content: 'oi' } },
      b: { id: 'b', type: 'text', trackId: 'inexistente', start: 0, duration: 10, name: 't' },
    };
    delete raw.exportSettings;
    const m = migrateProject(raw);
    expect(Object.keys(m.clips)).toEqual(['a']);
    const a = m.clips.a!;
    expect(a.type === 'text' && a.text.content).toBe('oi');
    expect(a.type === 'text' && a.text.fontSize).toBeGreaterThan(0);
    expect(m.exportSettings.fps).toBe(30);
  });

  it('recusa formato futuro', () => {
    const p = createProject({ name: 'X', width: 100, height: 100, fps: 30 });
    expect(() => migrateProject({ ...p, formatVersion: PROJECT_FORMAT_VERSION + 1 })).toThrow(/mais nova/);
  });
});

describe('Autosaver', () => {
  it('agrupa alterações e grava a mais recente', async () => {
    const saved: string[] = [];
    const a = new Autosaver({ debounceMs: 10, save: async (p) => void saved.push(p.name) });
    const p = createProject({ name: 'v1', width: 100, height: 100, fps: 30 });
    a.schedule(p);
    a.schedule({ ...p, name: 'v2' });
    a.schedule({ ...p, name: 'v3' });
    await new Promise((r) => setTimeout(r, 40));
    await a.flush();
    expect(saved).toEqual(['v3']);
  });
});
