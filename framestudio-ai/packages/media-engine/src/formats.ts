import { FrameStudioError, type AssetKind } from '@framestudio/shared';

/** Formatos aceitos na importação. A decodificação efetiva ainda depende do navegador/dispositivo. */
export const ACCEPTED: Record<string, { kind: AssetKind; mime: string }> = {
  mp4: { kind: 'video', mime: 'video/mp4' },
  m4v: { kind: 'video', mime: 'video/mp4' },
  mov: { kind: 'video', mime: 'video/quicktime' },
  webm: { kind: 'video', mime: 'video/webm' },
  mkv: { kind: 'video', mime: 'video/x-matroska' },
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  aac: { kind: 'audio', mime: 'audio/aac' },
  m4a: { kind: 'audio', mime: 'audio/mp4' },
  ogg: { kind: 'audio', mime: 'audio/ogg' },
  opus: { kind: 'audio', mime: 'audio/ogg' },
  flac: { kind: 'audio', mime: 'audio/flac' },
  png: { kind: 'image', mime: 'image/png' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  webp: { kind: 'image', mime: 'image/webp' },
  gif: { kind: 'image', mime: 'image/gif' },
};

export const ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED)
  .map((e) => `.${e}`)
  .concat(['video/*', 'audio/*', 'image/*'])
  .join(',');

/** Limite padrão por arquivo (configurável nas preferências): 8 GB. */
export const DEFAULT_MAX_FILE_BYTES = 8 * 1024 ** 3;

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** Detecta o tipo pelos bytes iniciais ("magic numbers"), independentemente da extensão. */
export function sniffContainer(head: Uint8Array): string | null {
  const s = (o: number, str: string) => [...str].every((ch, i) => head[o + i] === ch.charCodeAt(0));
  if (head.length < 12) return null;
  if (s(4, 'ftyp')) {
    const brand = String.fromCharCode(...head.subarray(8, 12));
    if (brand === 'qt  ') return 'mov';
    if (brand.startsWith('M4A')) return 'm4a';
    return 'mp4';
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'matroska';
  if (s(0, 'RIFF') && s(8, 'WAVE')) return 'wav';
  if (s(0, 'RIFF') && s(8, 'WEBP')) return 'webp';
  if (s(0, 'ID3') || (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0 && (head[1]! & 0x06) !== 0)) {
    // MP3 (ID3 ou frame sync). AAC ADTS também começa com 0xFFF; diferencia pelo layer.
    if (head[0] === 0xff && (head[1]! & 0x06) === 0) return 'aac';
    return 'mp3';
  }
  if (head[0] === 0xff && (head[1]! & 0xf6) === 0xf0) return 'aac';
  if (s(0, 'OggS')) return 'ogg';
  if (s(0, 'fLaC')) return 'flac';
  if (head[0] === 0x89 && s(1, 'PNG')) return 'png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (s(0, 'GIF8')) return 'gif';
  return null;
}

const CONTAINER_KIND: Record<string, AssetKind> = {
  mp4: 'video',
  mov: 'video',
  matroska: 'video',
  m4a: 'audio',
  wav: 'audio',
  mp3: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  png: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
};

export interface ValidatedFile {
  kind: AssetKind;
  mime: string;
  container: string;
}

/** Valida extensão, tamanho e assinatura binária. Lança erros claros em pt-BR. */
export async function validateFile(file: File, maxBytes = DEFAULT_MAX_FILE_BYTES): Promise<ValidatedFile> {
  const ext = extensionOf(file.name);
  const accepted = ACCEPTED[ext];
  if (file.size === 0) throw new FrameStudioError('CORRUPTED_FILE', `"${file.name}" está vazio.`);
  if (file.size > maxBytes) {
    throw new FrameStudioError('FILE_TOO_LARGE', `"${file.name}" excede o limite de ${(maxBytes / 1024 ** 3).toFixed(1)} GB configurado.`);
  }
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const container = sniffContainer(head);
  if (!container) {
    if (!accepted) throw new FrameStudioError('UNSUPPORTED_FILE', `Formato de "${file.name}" não suportado. Aceitos: vídeo (MP4, MOV, WebM, MKV), áudio (MP3, WAV, AAC, M4A, OGG, FLAC) e imagem (PNG, JPG, WebP, GIF).`);
    throw new FrameStudioError('CORRUPTED_FILE', `"${file.name}" não parece ser um arquivo ${ext.toUpperCase()} válido (assinatura não reconhecida).`);
  }
  let kind = CONTAINER_KIND[container]!;
  // Containers de vídeo podem conter só áudio (ex.: .webm de áudio); o probe decide depois.
  if (accepted && accepted.kind === 'audio' && kind === 'video') kind = 'audio';
  const mime = accepted?.mime ?? file.type ?? 'application/octet-stream';
  return { kind, mime: file.type || mime, container };
}
