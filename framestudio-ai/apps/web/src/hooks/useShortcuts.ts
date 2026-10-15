import { useEffect } from 'react';
import { useEditor } from '../state/editor.ts';
import { useSettings } from '../services/settings.ts';
import * as A from '../lib/actions.ts';

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string;
  run: () => void;
}

/** Atalhos padrão. "Mod" = Ctrl no Windows/Linux e ⌘ no macOS. */
export const SHORTCUTS: ShortcutDef[] = [
  { id: 'play', label: 'Reproduzir / pausar', keys: 'Space', run: A.togglePlay },
  { id: 'undo', label: 'Desfazer', keys: 'Mod+Z', run: () => useEditor.getState().undo() },
  { id: 'redo', label: 'Refazer', keys: 'Mod+Shift+Z', run: () => useEditor.getState().redo() },
  { id: 'redo2', label: 'Refazer (alternativo)', keys: 'Mod+Y', run: () => useEditor.getState().redo() },
  { id: 'save', label: 'Salvar', keys: 'Mod+S', run: () => void useEditor.getState().save() },
  { id: 'copy', label: 'Copiar', keys: 'Mod+C', run: () => void A.copySelection() },
  { id: 'cut', label: 'Recortar', keys: 'Mod+X', run: A.cutSelection },
  { id: 'paste', label: 'Colar', keys: 'Mod+V', run: A.paste },
  { id: 'duplicate', label: 'Duplicar', keys: 'Mod+D', run: A.duplicateSelection },
  { id: 'selectAll', label: 'Selecionar tudo', keys: 'Mod+A', run: A.selectAll },
  { id: 'delete', label: 'Excluir', keys: 'Delete', run: () => A.deleteSelection() },
  { id: 'backspace', label: 'Excluir (alternativo)', keys: 'Backspace', run: () => A.deleteSelection() },
  { id: 'rippleDelete', label: 'Excluir e fechar espaço', keys: 'Shift+Delete', run: () => A.deleteSelection(true) },
  { id: 'split', label: 'Dividir clipe no playhead', keys: 'S', run: A.splitAtPlayhead },
  { id: 'splitAlt', label: 'Dividir (alternativo)', keys: 'Mod+B', run: A.splitAtPlayhead },
  { id: 'marker', label: 'Adicionar marcador', keys: 'M', run: A.addMarkerAtPlayhead },
  { id: 'text', label: 'Adicionar texto', keys: 'T', run: () => void A.addText() },
  { id: 'group', label: 'Agrupar', keys: 'Mod+G', run: A.groupSelection },
  { id: 'ungroup', label: 'Desagrupar', keys: 'Mod+Shift+G', run: A.ungroupSelection },
  { id: 'left', label: 'Voltar 1 quadro', keys: 'ArrowLeft', run: () => A.step(-1) },
  { id: 'right', label: 'Avançar 1 quadro', keys: 'ArrowRight', run: () => A.step(1) },
  { id: 'left10', label: 'Voltar 1 segundo', keys: 'Shift+ArrowLeft', run: () => A.step(-(useEditor.getState().project?.settings.fps ?? 30)) },
  { id: 'right10', label: 'Avançar 1 segundo', keys: 'Shift+ArrowRight', run: () => A.step(useEditor.getState().project?.settings.fps ?? 30) },
  { id: 'prevEdit', label: 'Ponto de edição anterior', keys: 'ArrowUp', run: () => A.jumpEdit(-1) },
  { id: 'nextEdit', label: 'Próximo ponto de edição', keys: 'ArrowDown', run: () => A.jumpEdit(1) },
  { id: 'nudgeL', label: 'Mover seleção 1 quadro à esquerda', keys: 'Alt+ArrowLeft', run: () => A.nudge(-1) },
  { id: 'nudgeR', label: 'Mover seleção 1 quadro à direita', keys: 'Alt+ArrowRight', run: () => A.nudge(1) },
  { id: 'home', label: 'Ir ao início', keys: 'Home', run: A.seekToStart },
  { id: 'end', label: 'Ir ao fim', keys: 'End', run: A.seekToEnd },
  { id: 'zoomIn', label: 'Zoom da timeline +', keys: '=', run: () => A.zoomBy(1.4) },
  { id: 'zoomIn2', label: 'Zoom da timeline + (alternativo)', keys: 'Shift+=', run: () => A.zoomBy(1.4) },
  { id: 'zoomOut', label: 'Zoom da timeline −', keys: '-', run: () => A.zoomBy(1 / 1.4) },
  { id: 'deselect', label: 'Limpar seleção', keys: 'Escape', run: () => useEditor.getState().select([]) },
];

export function eventToKeys(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Mod');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let k = e.key;
  if (k === ' ') k = 'Space';
  else if (k === '+') k = '=';
  else if (k.length === 1) k = k.toUpperCase();
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(k)) parts.push(k);
  return parts.join('+');
}

export function displayKeys(keys: string): string {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return keys
    .replace('Mod', mac ? '⌘' : 'Ctrl')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('Space', 'Espaço');
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  const role = el.getAttribute?.('role');
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable ||
    role === 'slider' ||
    role === 'menuitem' ||
    role === 'option' ||
    !!el.closest('[role="dialog"],[role="menu"],[role="listbox"]')
  );
}

/** Registra os atalhos do editor (não interferem na digitação). */
export function useShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target)) return;
      const keys = eventToKeys(e);
      const overrides = useSettings.getState().shortcuts;
      const def = SHORTCUTS.find((s) => (overrides[s.id] ?? s.keys) === keys);
      if (!def) return;
      e.preventDefault();
      def.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
