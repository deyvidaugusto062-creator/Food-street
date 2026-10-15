import { create } from 'zustand';
import { applyOp, History, type EditOp, type OpResult } from '@framestudio/editor-core';
import { errorMessage, type Project } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import { Autosaver, type AutosaveStatus } from '@framestudio/project-storage';
import { toast } from '@framestudio/ui';
import { repo } from '../services/repo.ts';

export interface DispatchOptions {
  /** Agrupa alterações contínuas (sliders/arrastes) numa única entrada de histórico. */
  coalesce?: string;
  /** Seleciona os elementos criados. */
  select?: boolean;
  /** Não exibe toast em caso de erro (validação silenciosa durante arraste). */
  silent?: boolean;
}

export interface EditorState {
  project: Project | null;
  /** Último projeto gravado explicitamente (para indicar alterações não salvas). */
  savedProject: Project | null;
  selection: string[];
  selectedTransition: string | null;
  playhead: number;
  playing: boolean;
  pxPerSecond: number;
  ripple: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  saveStatus: AutosaveStatus;
  /** Área de transferência interna de clipes e atributos. */
  clipboard: { clips: Project['clips'][string][]; projectId: string } | null;
  attributeClipboard: Project['clips'][string] | null;

  open(project: Project): void;
  close(): Promise<void>;
  dispatch(op: EditOp, opts?: DispatchOptions): OpResult | null;
  undo(): void;
  redo(): void;
  seal(): void;
  select(ids: string[], mode?: 'replace' | 'toggle' | 'add'): void;
  selectTransition(id: string | null): void;
  setPlayhead(frame: number): void;
  setPlaying(p: boolean): void;
  setZoom(pxPerSecond: number): void;
  setRipple(r: boolean): void;
  save(): Promise<void>;
  setClipboard(c: EditorState['clipboard']): void;
  setAttributeClipboard(c: EditorState['attributeClipboard']): void;
  historyEntries(): { label: string; time: number }[];
}

const history = new History();

let thumbnailProvider: (() => Promise<string | null>) | null = null;
/** Registra quem gera a miniatura do projeto ao fechar (o motor de preview). */
export function setThumbnailProvider(fn: (() => Promise<string | null>) | null): void {
  thumbnailProvider = fn;
}

const autosaver = new Autosaver({
  debounceMs: 1500,
  save: async (p) => {
    await repo.saveRecovery(p);
  },
  onStatus: (s) => useEditor.setState({ saveStatus: s }),
});

function syncHistory(): Partial<EditorState> {
  const last = history.entries[history.entries.length - 1];
  const next = history.redoEntries[history.redoEntries.length - 1];
  return { canUndo: history.canUndo, canRedo: history.canRedo, undoLabel: last?.label ?? null, redoLabel: next?.label ?? null };
}

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 1200;

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  savedProject: null,
  selection: [],
  selectedTransition: null,
  playhead: 0,
  playing: false,
  pxPerSecond: 80,
  ripple: false,
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  saveStatus: { state: 'idle' },
  clipboard: null,
  attributeClipboard: null,

  open(project) {
    history.clear();
    autosaver.cancel();
    set({
      project,
      savedProject: project,
      selection: [],
      selectedTransition: null,
      playhead: 0,
      playing: false,
      saveStatus: { state: 'idle' },
      ...syncHistory(),
    });
  },

  async close() {
    autosaver.cancel();
    // Miniatura do projeto a partir do quadro atual do preview.
    const thumb = await thumbnailProvider?.().catch(() => null);
    if (thumb && get().project) set({ project: { ...get().project!, thumbnail: thumb } });
    const { project, savedProject } = get();
    if (project && project !== savedProject) {
      try {
        await repo.save(project);
      } catch (e) {
        toast({ kind: 'error', title: 'Não foi possível salvar ao sair', description: errorMessage(e) });
        await repo.saveRecovery(project).catch(() => {});
      }
    }
    set({ project: null, savedProject: null, selection: [], playing: false });
  },

  dispatch(op, opts = {}) {
    const before = get().project;
    if (!before) return null;
    try {
      const res = applyOp(before, op);
      history.push({ label: res.label, before, after: res.project, coalesceKey: opts.coalesce });
      const patch: Partial<EditorState> = { project: res.project, ...syncHistory() };
      // Remove da seleção clipes que deixaram de existir.
      const sel = get().selection.filter((id) => res.project.clips[id]);
      patch.selection = opts.select && res.created.length ? res.created.filter((id) => res.project.clips[id]) : sel;
      if (get().selectedTransition && !res.project.transitions[get().selectedTransition!]) patch.selectedTransition = null;
      set(patch);
      autosaver.schedule(res.project);
      return res;
    } catch (e) {
      if (!opts.silent) toast({ kind: 'error', title: 'Operação não realizada', description: errorMessage(e) });
      return null;
    }
  },

  undo() {
    if (get().playing) set({ playing: false });
    const e = history.undo();
    if (!e) return;
    set({ project: e.before, ...syncHistory(), selection: get().selection.filter((id) => e.before.clips[id]) });
    autosaver.schedule(e.before);
  },

  redo() {
    const e = history.redo();
    if (!e) return;
    set({ project: e.after, ...syncHistory(), selection: get().selection.filter((id) => e.after.clips[id]) });
    autosaver.schedule(e.after);
  },

  seal() {
    history.seal();
  },

  select(ids, mode = 'replace') {
    const cur = get().selection;
    let next: string[];
    if (mode === 'replace') next = ids;
    else if (mode === 'add') next = [...new Set([...cur, ...ids])];
    else next = ids.reduce((acc, id) => (acc.includes(id) ? acc.filter((x) => x !== id) : [...acc, id]), cur);
    // Seleção de grupo: inclui todos os membros.
    const p = get().project;
    if (p) {
      const groups = new Set(next.map((id) => p.clips[id]?.groupId).filter(Boolean));
      if (groups.size) for (const id in p.clips) if (groups.has(p.clips[id]!.groupId)) next.includes(id) || next.push(id);
    }
    set({ selection: next, selectedTransition: null });
  },

  selectTransition(id) {
    set({ selectedTransition: id, selection: id ? [] : get().selection });
  },

  setPlayhead(frame) {
    const p = get().project;
    const max = p ? Math.max(0, projectDuration(p)) : 0;
    const f = Math.max(0, Math.min(max, frame));
    if (f !== get().playhead) set({ playhead: f });
  },

  setPlaying(playing) {
    set({ playing });
  },

  setZoom(pxPerSecond) {
    set({ pxPerSecond: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pxPerSecond)) });
  },

  setRipple(ripple) {
    set({ ripple });
  },

  async save() {
    const p = get().project;
    if (!p) return;
    try {
      autosaver.cancel();
      set({ saveStatus: { state: 'saving' } });
      await repo.save(p);
      set({ savedProject: p, saveStatus: { state: 'saved', at: Date.now() } });
    } catch (e) {
      set({ saveStatus: { state: 'error', error: errorMessage(e) } });
      toast({ kind: 'error', title: 'Falha ao salvar o projeto', description: errorMessage(e) });
    }
  },

  setClipboard(c) {
    set({ clipboard: c });
  },
  setAttributeClipboard(c) {
    set({ attributeClipboard: c });
  },
  historyEntries() {
    return history.entries.map((e) => ({ label: e.label, time: e.time }));
  },
}));

/** Salva ao fechar a aba (melhor esforço) para não perder dados. */
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const { project, savedProject } = useEditor.getState();
    if (project && project !== savedProject) void repo.saveRecovery(project);
  });
}
