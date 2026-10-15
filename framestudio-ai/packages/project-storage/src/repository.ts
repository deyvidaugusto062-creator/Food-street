import { createId, FrameStudioError, type MediaAsset, type Project, type ProjectSummary } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import { IdbBlobStore, OpfsBlobStore, type BlobStore } from './blob-store.ts';
import { Idb, STORES } from './idb.ts';
import { migrateProject } from './migrations.ts';

interface RecoveryEntry {
  project: Project;
  savedAt: number;
}

export function summarize(p: Project, hasRecovery = false): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    favorite: p.favorite,
    width: p.settings.width,
    height: p.settings.height,
    fps: p.settings.fps,
    durationFrames: projectDuration(p),
    thumbnail: p.thumbnail,
    hasRecovery,
  };
}

/**
 * Persistência local de projetos. Projetos ficam no IndexedDB; mídias no OPFS (quando suportado)
 * ou no IndexedDB. Um "salvamento de recuperação" é gravado continuamente pelo autosave; o
 * salvamento explícito o substitui.
 */
export class ProjectRepository {
  readonly db: Idb;
  readonly blobs: BlobStore;

  constructor(opts: { db?: Idb; blobs?: BlobStore } = {}) {
    this.db = opts.db ?? new Idb();
    this.blobs = opts.blobs ?? (OpfsBlobStore.isSupported() ? new OpfsBlobStore() : new IdbBlobStore(this.db));
  }

  async list(): Promise<ProjectSummary[]> {
    const [summaries, recoveryKeys] = await Promise.all([this.db.values<ProjectSummary>(STORES.summaries), this.db.keys(STORES.recovery)]);
    const rec = new Set(recoveryKeys);
    return summaries.map((s) => ({ ...s, hasRecovery: rec.has(s.id) })).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async load(id: string): Promise<Project> {
    const raw = await this.db.get<Project>(STORES.projects, id);
    if (!raw) throw new FrameStudioError('INVALID_PROJECT', 'Projeto não encontrado.');
    return migrateProject(raw);
  }

  async save(project: Project): Promise<void> {
    const p = { ...project, updatedAt: Date.now() };
    await this.db.putMany([
      { store: STORES.projects, key: p.id, value: p },
      { store: STORES.summaries, key: p.id, value: summarize(p) },
    ]);
    await this.db.delete(STORES.recovery, p.id);
  }

  /** Salvamento automático: não altera a versão "oficial", grava um ponto de recuperação. */
  async saveRecovery(project: Project): Promise<void> {
    const entry: RecoveryEntry = { project, savedAt: Date.now() };
    await this.db.put(STORES.recovery, project.id, entry);
  }

  async loadRecovery(id: string): Promise<{ project: Project; savedAt: number } | undefined> {
    const e = await this.db.get<RecoveryEntry>(STORES.recovery, id);
    if (!e) return undefined;
    return { project: migrateProject(e.project), savedAt: e.savedAt };
  }

  async discardRecovery(id: string): Promise<void> {
    await this.db.delete(STORES.recovery, id);
  }

  async rename(id: string, name: string): Promise<void> {
    const p = await this.load(id);
    p.name = name.trim() || p.name;
    await this.save(p);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const p = await this.load(id);
    p.favorite = favorite;
    await this.save(p);
  }

  /** Duplica o projeto (as mídias são compartilhadas por referência de armazenamento). */
  async duplicate(id: string, name?: string): Promise<Project> {
    const p = await this.load(id);
    const copy: Project = { ...structuredClone(p), id: createId('prj_'), name: name ?? `${p.name} (cópia)`, createdAt: Date.now(), favorite: false };
    await this.save(copy);
    return copy;
  }

  /** Exclui o projeto e as mídias que não são usadas por nenhum outro projeto. */
  async delete(id: string): Promise<void> {
    const p = await this.db.get<Project>(STORES.projects, id);
    await this.db.deleteMany([
      { store: STORES.projects, key: id },
      { store: STORES.summaries, key: id },
      { store: STORES.recovery, key: id },
    ]);
    if (p) await this.collectGarbage(Object.values(p.assets).flatMap(assetKeys));
  }

  /** Remove blobs de mídia que nenhum projeto (ou recuperação) referencia mais. */
  async collectGarbage(candidates?: string[]): Promise<number> {
    const used = new Set<string>();
    const all = await this.db.values<Project>(STORES.projects);
    const rec = await this.db.values<RecoveryEntry>(STORES.recovery);
    for (const p of [...all, ...rec.map((r) => r.project)]) for (const a of Object.values(p.assets ?? {})) assetKeys(a).forEach((k) => used.add(k));
    const keys = candidates ?? (await this.blobs.keys());
    let removed = 0;
    for (const k of keys) {
      if (!used.has(k)) {
        await this.blobs.delete(k);
        removed++;
      }
    }
    return removed;
  }

  async putMedia(key: string, data: Blob): Promise<void> {
    await this.blobs.put(key, data);
  }

  async getMedia(key: string): Promise<Blob | undefined> {
    return this.blobs.get(key);
  }

  /** Lista as mídias do projeto cujo arquivo não está no armazenamento local. */
  async missingAssets(project: Project): Promise<MediaAsset[]> {
    const out: MediaAsset[] = [];
    for (const a of Object.values(project.assets)) if (!(await this.blobs.has(a.storageKey))) out.push(a);
    return out;
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    return this.db.get<T>(STORES.settings, key);
  }
  async setSetting(key: string, value: unknown): Promise<void> {
    await this.db.put(STORES.settings, key, value);
  }
  async getCache<T>(key: string): Promise<T | undefined> {
    return this.db.get<T>(STORES.cache, key);
  }
  async setCache(key: string, value: unknown): Promise<void> {
    await this.db.put(STORES.cache, key, value).catch(() => {});
  }
}

function assetKeys(a: MediaAsset): string[] {
  return a.proxyKey ? [a.storageKey, a.proxyKey] : [a.storageKey];
}
