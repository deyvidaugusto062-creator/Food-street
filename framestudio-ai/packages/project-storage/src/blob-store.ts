import { FrameStudioError } from '@framestudio/shared';
import { Idb, STORES } from './idb.ts';

/** Armazenamento dos arquivos de mídia importados (cópias locais; o original do usuário nunca é alterado). */
export interface BlobStore {
  readonly kind: 'opfs' | 'indexeddb';
  put(key: string, data: Blob): Promise<void>;
  get(key: string): Promise<File | Blob | undefined>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

function wrapQuota(e: unknown): never {
  if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
    throw new FrameStudioError('STORAGE_QUOTA', 'Espaço de armazenamento insuficiente. Libere espaço removendo projetos ou mídias não usadas.');
  }
  throw new FrameStudioError('STORAGE_ERROR', `Falha ao gravar no armazenamento local: ${(e as Error)?.message ?? e}`);
}

const safeName = (key: string) => key.replace(/[^a-zA-Z0-9_.-]/g, '_');

/** Origin Private File System: melhor para arquivos grandes (escrita em streaming, sem limite de transação). */
export class OpfsBlobStore implements BlobStore {
  readonly kind = 'opfs' as const;
  private dir: Promise<FileSystemDirectoryHandle>;
  constructor(folder = 'media') {
    this.dir = navigator.storage.getDirectory().then((root) => root.getDirectoryHandle(folder, { create: true }));
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory && typeof FileSystemFileHandle !== 'undefined' && 'createWritable' in FileSystemFileHandle.prototype;
  }

  async put(key: string, data: Blob): Promise<void> {
    try {
      const dir = await this.dir;
      const fh = await dir.getFileHandle(safeName(key), { create: true });
      const w = await fh.createWritable();
      try {
        await data.stream().pipeTo(w);
      } catch (e) {
        await w.abort().catch(() => {});
        throw e;
      }
    } catch (e) {
      wrapQuota(e);
    }
  }

  async get(key: string): Promise<File | undefined> {
    try {
      const dir = await this.dir;
      const fh = await dir.getFileHandle(safeName(key));
      return await fh.getFile();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') return undefined;
      throw e;
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async delete(key: string): Promise<void> {
    const dir = await this.dir;
    await dir.removeEntry(safeName(key)).catch(() => {});
  }

  async keys(): Promise<string[]> {
    const dir = await this.dir;
    const out: string[] = [];
    for await (const [name] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) out.push(name);
    return out;
  }
}

/** Fallback universal: blobs dentro do IndexedDB. */
export class IdbBlobStore implements BlobStore {
  readonly kind = 'indexeddb' as const;
  constructor(private readonly db: Idb) {}

  async put(key: string, data: Blob): Promise<void> {
    try {
      await this.db.put(STORES.blobs, key, data);
    } catch (e) {
      wrapQuota(e);
    }
  }
  get(key: string): Promise<Blob | undefined> {
    return this.db.get<Blob>(STORES.blobs, key);
  }
  async has(key: string): Promise<boolean> {
    return (await this.db.get(STORES.blobs, key)) !== undefined;
  }
  delete(key: string): Promise<void> {
    return this.db.delete(STORES.blobs, key);
  }
  keys(): Promise<string[]> {
    return this.db.keys(STORES.blobs);
  }
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  persisted: boolean;
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usage: e.usage ?? 0, quota: e.quota ?? 0, persisted };
}

/** Pede ao navegador para não apagar os dados automaticamente sob pressão de espaço. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
