import { create } from 'zustand';

/** Comparação antes/depois: enquanto ativo, o preview mostra o clipe sem correção de cor. */
export const useCompare = create<{ clipId: string | null; set: (id: string | null) => void }>((set) => ({
  clipId: null,
  set: (clipId) => set({ clipId }),
}));
