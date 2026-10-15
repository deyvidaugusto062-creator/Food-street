/** Tipos de dados usados no arrastar-e-soltar da biblioteca para a timeline/preview. */
export const DND_ASSET = 'application/x-framestudio-asset';
export const DND_TRANSITION = 'application/x-framestudio-transition';
export const DND_EFFECT = 'application/x-framestudio-effect';
export const DND_TEXT = 'application/x-framestudio-text';

/** Último item arrastado (dataTransfer.getData só funciona no drop). */
export const dragState: { kind: 'asset' | 'transition' | 'effect' | 'text' | null; payload: string | null } = { kind: null, payload: null };
