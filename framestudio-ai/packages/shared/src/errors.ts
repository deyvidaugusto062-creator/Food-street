export type ErrorCode =
  | 'UNSUPPORTED_FILE'
  | 'UNSUPPORTED_CODEC'
  | 'CORRUPTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'MEDIA_MISSING'
  | 'STORAGE_QUOTA'
  | 'STORAGE_ERROR'
  | 'INVALID_OPERATION'
  | 'INVALID_PROJECT'
  | 'EXPORT_FAILED'
  | 'CANCELLED'
  | 'NOT_SUPPORTED'
  | 'MODEL_MISSING';

/** Erro de domínio com código estável e mensagem legível para o usuário (pt-BR). */
export class FrameStudioError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'FrameStudioError';
    this.code = code;
    this.details = details;
  }
}

export function isCancelled(e: unknown): boolean {
  return (
    (e instanceof FrameStudioError && e.code === 'CANCELLED') ||
    (e instanceof DOMException && e.name === 'AbortError')
  );
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
