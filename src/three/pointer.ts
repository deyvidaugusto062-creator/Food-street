/**
 * Estado do ponteiro compartilhado entre o DOM e a cena 3D (sem re-render).
 * Fica fora dos módulos do Three.js para não puxá-lo para o bundle principal.
 */
export interface PointerState {
  x: number;
  y: number;
  dragging: boolean;
  /** rotação acumulada pelo arraste (rad) */
  spin: number;
  velocity: number;
  /** Pede um novo quadro quando a cena roda sob demanda (movimento reduzido) */
  invalidate?: () => void;
}

export function createPointerState(): PointerState {
  return { x: 0, y: 0, dragging: false, spin: 0, velocity: 0 };
}
