/**
 * Sugestões de melhoria (ritmo, áudio, legendas, enquadramento) a partir de regras explícitas.
 * Cada sugestão explica o motivo e, quando possível, traz uma correção revisável.
 */
import type { EditOp } from '@framestudio/editor-core';
import type { Clip, Project } from '@framestudio/shared';
import { clipEnd, getTrackClips, projectDuration } from '@framestudio/timeline';

export interface Suggestion {
  id: string;
  category: 'ritmo' | 'áudio' | 'legendas' | 'enquadramento' | 'texto';
  severity: 'info' | 'aviso';
  title: string;
  detail: string;
  fix?: { label: string; ops: EditOp[] };
}

export function analyzeProject(p: Project): Suggestion[] {
  const out: Suggestion[] = [];
  const fps = p.settings.fps;
  const W = p.settings.width;
  const H = p.settings.height;
  const vertical = H > W;
  const dur = projectDuration(p);
  const clips = Object.values(p.clips);
  if (clips.length === 0) return [{ id: 'empty', category: 'ritmo', severity: 'info', title: 'Projeto vazio', detail: 'Importe mídias e adicione-as à timeline para começar.' }];

  // Ritmo: planos longos em formatos verticais/sociais.
  const longLimit = vertical ? 6 : 12;
  const longClips = clips.filter((c) => (c.type === 'video' || c.type === 'image') && c.duration / fps > longLimit);
  if (longClips.length) {
    out.push({
      id: 'pace',
      category: 'ritmo',
      severity: 'info',
      title: `${longClips.length} plano(s) com mais de ${longLimit} s`,
      detail: vertical ? 'Em vídeos verticais, cortes a cada 2–5 s mantêm a atenção. Considere dividir ou acelerar trechos.' : 'Planos longos podem cansar; considere cortes ou zoom gradual.',
      fix: { label: 'Adicionar zoom lento (Ken Burns)', ops: longClips.filter((c) => 'effects' in c && !c.effects.some((e) => e.type === 'zoom')).map((c) => ({ type: 'effect.add' as const, clipIds: [c.id], effect: 'zoom' as const, params: { from: 1, to: 1.12 } })) },
    });
  }

  // Espaços vazios na faixa principal.
  const main = p.tracks.filter((t) => t.kind === 'video').pop();
  if (main) {
    const list = getTrackClips(p, main.id);
    const gaps: { start: number; end: number }[] = [];
    let t = 0;
    for (const c of list) {
      if (c.start > t + 1) gaps.push({ start: t, end: c.start });
      t = Math.max(t, clipEnd(c));
    }
    const coveredByOthers = (g: { start: number; end: number }) => clips.some((c) => c.trackId !== main.id && (c.type === 'video' || c.type === 'image') && c.start <= g.start && clipEnd(c) >= g.end);
    const real = gaps.filter((g) => !coveredByOthers(g));
    if (real.length) {
      out.push({
        id: 'gaps',
        category: 'ritmo',
        severity: 'aviso',
        title: `${real.length} espaço(s) vazio(s) na faixa principal`,
        detail: 'Trechos sem vídeo aparecem como tela preta no resultado.',
        fix: { label: 'Fechar espaços (ripple)', ops: [...real].reverse().map((g) => ({ type: 'range.remove' as const, start: g.start, end: g.end, trackIds: [main.id] })) },
      });
    }
  }

  // Enquadramento: mídia que não preenche o quadro.
  const letterbox = clips.filter((c): c is Extract<Clip, { type: 'video' | 'image' }> => {
    if (c.type !== 'video' && c.type !== 'image') return false;
    const a = p.assets[c.assetId];
    if (!a?.width || !a.height || c.transform.fit !== 'contain' || c.transform.scale < 0.99) return false;
    const track = p.tracks.findIndex((t) => t.id === c.trackId);
    const lowest = p.tracks.map((t, i) => (t.kind === 'video' ? i : -1)).filter((i) => i >= 0).pop();
    return track === lowest && Math.abs(a.width / a.height - W / H) > 0.05;
  });
  if (letterbox.length) {
    out.push({
      id: 'letterbox',
      category: 'enquadramento',
      severity: 'aviso',
      title: `${letterbox.length} clipe(s) com bordas pretas`,
      detail: 'A proporção da mídia é diferente da do projeto. Preencher o quadro corta as sobras; use Reenquadrar para centralizar o assunto.',
      fix: { label: 'Preencher o quadro', ops: [{ type: 'clip.update', clipIds: letterbox.map((c) => c.id), patch: { transform: { fit: 'cover' } } }] },
    });
  }

  // Textos fora da área segura (90%).
  const unsafe = clips.filter((c) => (c.type === 'text' || c.type === 'caption') && (Math.abs(c.transform.x) > W * 0.4 || Math.abs(c.transform.y) > H * 0.42));
  if (unsafe.length) {
    out.push({
      id: 'safe',
      category: 'texto',
      severity: 'aviso',
      title: `${unsafe.length} texto(s) perto da borda`,
      detail: 'Interfaces de redes sociais podem cobrir textos fora da área segura.',
      fix: {
        label: 'Trazer para a área segura',
        ops: unsafe.map((c) => ({
          type: 'clip.update' as const,
          clipIds: [c.id],
          patch: { transform: { x: Math.max(-W * 0.38, Math.min(W * 0.38, (c as Extract<Clip, { type: 'text' }>).transform.x)), y: Math.max(-H * 0.4, Math.min(H * 0.4, (c as Extract<Clip, { type: 'text' }>).transform.y)) } },
        })),
      },
    });
  }

  // Áudio: música alta junto com voz.
  const music = clips.filter((c): c is Extract<Clip, { type: 'audio' }> => c.type === 'audio' && !c.audio.muted);
  const voiceClips = clips.filter((c) => c.type === 'video' && !c.audio.muted && p.assets[c.assetId]?.hasAudio);
  const loudMusic = music.filter((m) => m.audio.volume > 0.5 && !m.keyframes.volume && voiceClips.some((v) => v.start < clipEnd(m) && clipEnd(v) > m.start));
  if (loudMusic.length) {
    out.push({
      id: 'music',
      category: 'áudio',
      severity: 'aviso',
      title: 'Música pode encobrir a voz',
      detail: 'Há música em volume alto sobre trechos com áudio de vídeo. Reduza para ~30% ou use o ducking automático.',
      fix: { label: 'Reduzir música para 30%', ops: [{ type: 'clip.update', clipIds: loudMusic.map((m) => m.id), patch: { audio: { volume: 0.3 } } }] },
    });
  }

  // Áudio terminando abruptamente.
  const abrupt = clips.filter((c): c is Extract<Clip, { type: 'audio' }> => c.type === 'audio' && clipEnd(c) === dur && c.audio.fadeOut < 0.2);
  if (abrupt.length) {
    out.push({
      id: 'fadeout',
      category: 'áudio',
      severity: 'info',
      title: 'Música termina sem fade',
      detail: 'Um fade-out de 1–2 s deixa o final mais suave.',
      fix: { label: 'Adicionar fade-out de 1,5 s', ops: [{ type: 'clip.update', clipIds: abrupt.map((c) => c.id), patch: { audio: { fadeOut: 1.5 } } }] },
    });
  }

  // Legendas.
  const hasCaptions = clips.some((c) => c.type === 'caption');
  if (!hasCaptions && voiceClips.length + music.length > 0 && vertical) {
    out.push({ id: 'captions', category: 'legendas', severity: 'info', title: 'Sem legendas', detail: 'A maioria dos vídeos verticais é assistida sem som. Gere legendas automáticas no AI Studio.' });
  }

  // Clipes muito curtos.
  const tiny = clips.filter((c) => c.duration < Math.max(2, fps * 0.2));
  if (tiny.length) out.push({ id: 'tiny', category: 'ritmo', severity: 'aviso', title: `${tiny.length} clipe(s) com menos de 0,2 s`, detail: 'Fragmentos muito curtos costumam ser sobras de cortes.', fix: { label: 'Remover fragmentos', ops: [{ type: 'clip.remove', clipIds: tiny.map((c) => c.id), ripple: false }] } });

  return out.filter((s) => !s.fix || s.fix.ops.length > 0 || s.id === 'pace');
}
