import { useEffect } from 'react';
import { DEFAULT_COLOR, type Project } from '@framestudio/shared';
import { useEditor } from '../state/editor.ts';
import { useCompare } from '../state/compare.ts';
import { useSettings } from '../services/settings.ts';
import { preview } from '../preview/engine.ts';

/** Projeto exibido no preview (com a correção de cor desativada no modo antes/depois). */
function previewProject(p: Project): Project {
  const id = useCompare.getState().clipId;
  const c = id ? p.clips[id] : undefined;
  if (!c || !('color' in c)) return p;
  const keyframes = Object.fromEntries(Object.entries(c.keyframes).filter(([k]) => !k.startsWith('color:')));
  return { ...p, clips: { ...p.clips, [c.id]: { ...c, color: { ...DEFAULT_COLOR }, keyframes } as typeof c } };
}

/** Liga o estado do editor ao motor de preview. */
export function usePreviewSync(): void {
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = useEditor.getState();
        if (!s.playing) void preview.renderAt(s.playhead);
      });
    };
    preview.onFrame = (f) => useEditor.getState().setPlayhead(f);
    preview.onEnded = () => useEditor.getState().setPlaying(false);
    preview.useProxies = useSettings.getState().useProxies;
    const init = useEditor.getState().project;
    if (init) {
      preview.setProject(previewProject(init));
      schedule();
    }
    const unsubEditor = useEditor.subscribe((s, prev) => {
      if (s.project !== prev.project && s.project) {
        preview.setProject(previewProject(s.project));
        schedule();
      } else if (s.playhead !== prev.playhead && !s.playing) schedule();
      else if (s.playing !== prev.playing && !s.playing) schedule();
    });
    const unsubCompare = useCompare.subscribe(() => {
      const p = useEditor.getState().project;
      if (p) {
        preview.setProject(previewProject(p));
        schedule();
      }
    });
    const unsubSettings = useSettings.subscribe((s, prev) => {
      if (s.useProxies !== prev.useProxies) {
        preview.useProxies = s.useProxies;
        schedule();
      }
      if (s.previewQuality !== prev.previewQuality) schedule();
    });
    return () => {
      cancelAnimationFrame(raf);
      unsubEditor();
      unsubCompare();
      unsubSettings();
      preview.pause();
    };
  }, []);
}
