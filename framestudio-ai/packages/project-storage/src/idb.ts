/** Wrapper mínimo de IndexedDB baseado em Promises. */

export const DB_NAME = 'framestudio-ai';
export const DB_VERSION = 1;

export const STORES = {
  projects: 'projects',
  summaries: 'summaries',
  recovery: 'recovery',
  blobs: 'blobs',
  cache: 'cache',
  settings: 'settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class Idb {
  private dbp: Promise<IDBDatabase> | null = null;
  constructor(
    private readonly name = DB_NAME,
    private readonly factory: IDBFactory = globalThis.indexedDB,
  ) {}

  open(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        if (!this.factory) {
          reject(new Error('IndexedDB não está disponível neste navegador.'));
          return;
        }
        const r = this.factory.open(this.name, DB_VERSION);
        r.onupgradeneeded = () => {
          const db = r.result;
          for (const s of Object.values(STORES)) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        };
        r.onsuccess = () => {
          const db = r.result;
          db.onversionchange = () => db.close();
          resolve(db);
        };
        r.onerror = () => reject(r.error);
        r.onblocked = () => reject(new Error('O banco de dados está bloqueado por outra aba do FrameStudio.'));
      });
    }
    return this.dbp;
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.open();
    return req(db.transaction(store, 'readonly').objectStore(store).get(key)) as Promise<T | undefined>;
  }

  async put(store: StoreName, key: string, value: unknown): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    await done(tx);
  }

  /** Grava em várias stores numa única transação atômica. */
  async putMany(entries: { store: StoreName; key: string; value: unknown }[]): Promise<void> {
    const db = await this.open();
    const names = [...new Set(entries.map((e) => e.store))];
    const tx = db.transaction(names, 'readwrite');
    for (const e of entries) tx.objectStore(e.store).put(e.value, e.key);
    await done(tx);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await done(tx);
  }

  async deleteMany(entries: { store: StoreName; key: string }[]): Promise<void> {
    const db = await this.open();
    const names = [...new Set(entries.map((e) => e.store))];
    if (names.length === 0) return;
    const tx = db.transaction(names, 'readwrite');
    for (const e of entries) tx.objectStore(e.store).delete(e.key);
    await done(tx);
  }

  async keys(store: StoreName): Promise<string[]> {
    const db = await this.open();
    return (await req(db.transaction(store, 'readonly').objectStore(store).getAllKeys())) as string[];
  }

  async values<T>(store: StoreName): Promise<T[]> {
    const db = await this.open();
    return (await req(db.transaction(store, 'readonly').objectStore(store).getAll())) as T[];
  }

  async close(): Promise<void> {
    if (this.dbp) (await this.dbp).close();
    this.dbp = null;
  }
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transação abortada.'));
  });
}
