/**
 * Formato de arquivo `.fstudio`: um ZIP contendo
 *   manifest.json  — { format: "fstudio", formatVersion, packaged, app, createdAt }
 *   project.json   — o projeto serializado
 *   media/<storageKey> — (opcional) as mídias, quando o projeto é "empacotado"
 */
import { strFromU8, strToU8, unzip, zip, type Unzipped, type Zippable } from 'fflate';
import { createId, FrameStudioError, PROJECT_FORMAT_VERSION, type Project } from '@framestudio/shared';
import { migrateProject } from './migrations.ts';

export const FSTUDIO_MIME = 'application/x-framestudio';
export const FSTUDIO_EXT = '.fstudio';

export interface Manifest {
  format: 'fstudio';
  formatVersion: number;
  packaged: boolean;
  app: string;
  createdAt: number;
}

/** Limite de segurança ao descompactar (evita "zip bombs"): 8 GB. */
const MAX_UNZIPPED = 8 * 1024 ** 3;

export async function writeFstudio(project: Project, media?: Map<string, Blob>): Promise<Blob> {
  const manifest: Manifest = {
    format: 'fstudio',
    formatVersion: PROJECT_FORMAT_VERSION,
    packaged: !!media && media.size > 0,
    app: 'FrameStudio AI',
    createdAt: Date.now(),
  };
  const files: Zippable = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'project.json': strToU8(JSON.stringify(project)),
  };
  if (media) {
    for (const [key, blob] of media) {
      // Mídia já é comprimida: armazena sem recompressão (level 0).
      files[`media/${key}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    }
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out))));
  return new Blob([data as BlobPart], { type: FSTUDIO_MIME });
}

export interface ReadResult {
  project: Project;
  manifest: Manifest;
  /** Mídias empacotadas, indexadas pela storageKey ORIGINAL. */
  media: Map<string, Blob>;
}

export async function readFstudio(file: Blob, opts: { newId?: boolean } = {}): Promise<ReadResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let total = 0;
  let files: Unzipped;
  try {
    files = await new Promise<Unzipped>((resolve, reject) =>
      unzip(
        buf,
        {
          filter: (f) => {
            total += f.originalSize;
            if (total > MAX_UNZIPPED) throw new FrameStudioError('FILE_TOO_LARGE', 'Arquivo de projeto grande demais.');
            return f.name === 'manifest.json' || f.name === 'project.json' || f.name.startsWith('media/');
          },
        },
        (err, out) => (err ? reject(err) : resolve(out)),
      ),
    );
  } catch (e) {
    if (e instanceof FrameStudioError) throw e;
    throw new FrameStudioError('INVALID_PROJECT', 'O arquivo não é um projeto .fstudio válido (ZIP corrompido).');
  }
  const m = files['manifest.json'];
  const pj = files['project.json'];
  if (!m || !pj) throw new FrameStudioError('INVALID_PROJECT', 'Arquivo .fstudio incompleto (manifest/project ausente).');
  let manifest: Manifest;
  let raw: unknown;
  try {
    manifest = JSON.parse(strFromU8(m));
    raw = JSON.parse(strFromU8(pj));
  } catch {
    throw new FrameStudioError('INVALID_PROJECT', 'JSON do projeto corrompido.');
  }
  if (manifest.format !== 'fstudio') throw new FrameStudioError('INVALID_PROJECT', 'Este arquivo não é um projeto do FrameStudio.');
  const project = migrateProject(raw);
  if (opts.newId) {
    project.id = createId('prj_');
    project.createdAt = Date.now();
  }
  const media = new Map<string, Blob>();
  for (const [name, data] of Object.entries(files)) {
    if (!name.startsWith('media/')) continue;
    const key = name.slice('media/'.length);
    if (!key || key.includes('/') || key.includes('..')) continue;
    const asset = Object.values(project.assets).find((a) => a.storageKey === key || a.proxyKey === key);
    media.set(key, new Blob([data as BlobPart], { type: asset?.mimeType ?? 'application/octet-stream' }));
  }
  return { project, manifest, media };
}
