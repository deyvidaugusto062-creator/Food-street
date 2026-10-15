import { create } from 'zustand';
import { assetFromProbe, generateProxy, generateThumbnails, probeFile, type ProbeResult } from '@framestudio/media-engine';
import { AudioBufferStore, computePeaks, fromAudioBuffer } from '@framestudio/audio-engine';
import { errorMessage, FrameStudioError, type MediaAsset, type Project } from '@framestudio/shared';
import { toast } from '@framestudio/ui';
import { repo } from './repo.ts';
import { useSettings } from './settings.ts';

/** Estado de processamento e caches visuais por asset (não persistidos no projeto). */
interface MediaCacheState {
  thumbs: Record<string, string[]>;
  peaks: Record<string, Float32Array>;
  status: Record<string, 'processing' | 'ready' | 'error'>;
  proxy: Record<string, number | 'ready' | 'error'>;
  importing: { name: string; progress: number }[];
}

export const useMediaCache = create<MediaCacheState>(() => ({ thumbs: {}, peaks: {}, status: {}, proxy: {}, importing: [] }));

// ─────────────────────────── Blobs ───────────────────────────

const blobCache = new Map<string, Blob>();
const urlCache = new Map<string, string>();
let currentProject: () => Project | null = () => null;

export function bindProject(getter: () => Project | null): void {
  currentProject = getter;
}

/** Blob original de um asset (do armazenamento local). */
export async function getAssetBlob(assetId: string, opts: { proxy?: boolean } = {}): Promise<Blob | undefined> {
  const asset = currentProject()?.assets[assetId];
  if (!asset) return undefined;
  const key = opts.proxy && asset.proxyKey ? asset.proxyKey : asset.storageKey;
  const hit = blobCache.get(key);
  if (hit) return hit;
  const b = await repo.getMedia(key);
  if (b) blobCache.set(key, b);
  return b;
}

/** URL de objeto para elementos <video>/<audio>/<img> (reutilizada). */
export async function getAssetUrl(assetId: string, opts: { proxy?: boolean } = {}): Promise<string | undefined> {
  const asset = currentProject()?.assets[assetId];
  if (!asset) return undefined;
  const key = opts.proxy && asset.proxyKey ? asset.proxyKey : asset.storageKey;
  const hit = urlCache.get(key);
  if (hit) return hit;
  const b = await getAssetBlob(assetId, opts);
  if (!b) return undefined;
  const url = URL.createObjectURL(b);
  urlCache.set(key, url);
  return url;
}

export function releaseMediaCaches(): void {
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  blobCache.clear();
  for (const list of Object.values(useMediaCache.getState().thumbs)) list.forEach((u) => URL.revokeObjectURL(u));
  useMediaCache.setState({ thumbs: {}, peaks: {}, status: {}, proxy: {} });
  audioStore.clear();
}

/** Áudio decodificado compartilhado entre preview, formas de onda, análise e exportação. */
export const audioStore = new AudioBufferStore((assetId) => getAssetBlob(assetId), 48000);

// ─────────────────────────── Importação ───────────────────────────

export interface ImportOutcome {
  asset: MediaAsset;
  probe: ProbeResult;
}

/** Importa arquivos reais: valida, lê metadados, copia para o armazenamento local. */
export async function importFiles(files: File[], onAsset: (asset: MediaAsset) => void): Promise<ImportOutcome[]> {
  const out: ImportOutcome[] = [];
  const maxBytes = useSettings.getState().maxFileSizeGb * 1024 ** 3;
  for (const file of files) {
    useMediaCache.setState((s) => ({ importing: [...s.importing, { name: file.name, progress: 0 }] }));
    try {
      if (file.size > maxBytes) throw new FrameStudioError('FILE_TOO_LARGE', `"${file.name}" excede o limite configurado de ${useSettings.getState().maxFileSizeGb} GB.`);
      const probe = await probeFile(file);
      const asset = assetFromProbe(file, probe);
      await repo.putMedia(asset.storageKey, file);
      blobCache.set(asset.storageKey, file);
      onAsset(asset);
      out.push({ asset, probe });
      for (const w of probe.warnings) toast({ kind: 'warning', title: file.name, description: w });
      void processAsset(asset, file);
    } catch (e) {
      const conversion = e instanceof FrameStudioError && e.code === 'UNSUPPORTED_CODEC' ? ' Converta o arquivo (ex.: HandBrake ou FFmpeg) para MP4 H.264 ou WebM VP9.' : '';
      toast({ kind: 'error', title: `Não foi possível importar ${file.name}`, description: errorMessage(e) + conversion });
    } finally {
      useMediaCache.setState((s) => ({ importing: s.importing.filter((x) => x.name !== file.name) }));
    }
  }
  return out;
}

/** Gera miniaturas e forma de onda (em segundo plano, com cache). */
export async function processAsset(asset: MediaAsset, blob?: Blob): Promise<void> {
  const st = useMediaCache.getState();
  if (st.status[asset.id] === 'processing' || st.status[asset.id] === 'ready') return;
  useMediaCache.setState((s) => ({ status: { ...s.status, [asset.id]: 'processing' } }));
  try {
    const data = blob ?? (await getAssetBlob(asset.id));
    if (!data) throw new Error('mídia ausente');
    if (asset.kind !== 'audio') {
      const cacheKey = `thumbs:${asset.id}`;
      let blobs = await repo.getCache<Blob[]>(cacheKey);
      if (!blobs) {
        const count = asset.kind === 'image' ? 1 : Math.min(24, Math.max(4, Math.ceil(asset.duration / 2)));
        blobs = (await generateThumbnails(data, asset, count, 72)).map((t) => t.blob);
        void repo.setCache(cacheKey, blobs);
      }
      const urls = blobs.map((b) => URL.createObjectURL(b));
      useMediaCache.setState((s) => ({ thumbs: { ...s.thumbs, [asset.id]: urls } }));
    }
    if (asset.hasAudio) {
      const cacheKey = `peaks:${asset.id}`;
      let peaks = await repo.getCache<Float32Array>(cacheKey);
      if (!peaks) {
        const buf = await audioStore.get(asset.id);
        if (buf) {
          peaks = computePeaks(fromAudioBuffer(buf), Math.min(20000, Math.max(200, Math.ceil(buf.duration * 100))));
          void repo.setCache(cacheKey, peaks);
        }
      }
      if (peaks) useMediaCache.setState((s) => ({ peaks: { ...s.peaks, [asset.id]: peaks! } }));
    }
    useMediaCache.setState((s) => ({ status: { ...s.status, [asset.id]: 'ready' } }));
  } catch (e) {
    console.warn('Falha ao processar mídia', asset.name, e);
    useMediaCache.setState((s) => ({ status: { ...s.status, [asset.id]: 'error' } }));
  }
}

/** Gera um proxy de baixa resolução e devolve a chave de armazenamento. */
export async function createProxy(asset: MediaAsset, signal?: AbortSignal): Promise<string> {
  const blob = await getAssetBlob(asset.id);
  if (!blob) throw new FrameStudioError('MEDIA_MISSING', 'Mídia não encontrada.');
  useMediaCache.setState((s) => ({ proxy: { ...s.proxy, [asset.id]: 0 } }));
  try {
    const proxy = await generateProxy(blob, { height: 540, signal, onProgress: (p) => useMediaCache.setState((s) => ({ proxy: { ...s.proxy, [asset.id]: p } })) });
    const key = `proxy_${asset.id}`;
    await repo.putMedia(key, proxy);
    useMediaCache.setState((s) => ({ proxy: { ...s.proxy, [asset.id]: 'ready' } }));
    return key;
  } catch (e) {
    useMediaCache.setState((s) => ({ proxy: { ...s.proxy, [asset.id]: 'error' } }));
    throw e;
  }
}

/** Re-vincula uma mídia ausente a um arquivo escolhido pelo usuário. */
export async function relinkAsset(asset: MediaAsset, file: File): Promise<Partial<MediaAsset>> {
  const probe = await probeFile(file);
  if (probe.kind !== asset.kind) throw new FrameStudioError('INVALID_OPERATION', `O arquivo escolhido é ${probe.kind}, mas a mídia ausente é ${asset.kind}.`);
  if (asset.duration > 0 && Math.abs(probe.duration - asset.duration) > 0.5) {
    toast({ kind: 'warning', title: 'Duração diferente', description: `A mídia original tinha ${asset.duration.toFixed(1)} s e a nova tem ${probe.duration.toFixed(1)} s. Verifique os cortes.` });
  }
  await repo.putMedia(asset.storageKey, file);
  blobCache.set(asset.storageKey, file);
  const url = urlCache.get(asset.storageKey);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(asset.storageKey);
  }
  audioStore.invalidate(asset.id);
  useMediaCache.setState((s) => ({ status: { ...s.status, [asset.id]: undefined as never } }));
  return { duration: probe.duration, width: probe.width, height: probe.height, hasAudio: probe.hasAudio, size: file.size, fingerprint: `${file.name}|${file.size}|${file.lastModified}` };
}
