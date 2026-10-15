/**
 * Assistente de edição: traduz comandos em linguagem natural (pt-BR, inglês e espanhol) em
 * operações estruturadas do editor. NÃO executa nada por conta própria: devolve um plano que a
 * interface mostra ao usuário (com confirmação quando afeta vários elementos) e que só usa
 * operações da lista permitida, validadas por simulação antes de serem oferecidas.
 *
 * O interpretador local é baseado em regras (gramática de padrões). Comandos fora do repertório
 * podem, opcionalmente, ser enviados a um provedor de IA configurado pelo usuário (ver llm.ts).
 */
import { applyOp, type EditOp } from '@framestudio/editor-core';
import type { Clip, Project } from '@framestudio/shared';
import { clipEnd, projectDuration } from '@framestudio/timeline';

export type ToolRequest = 'silence' | 'captions' | 'reframe' | 'suggestions' | 'highlights' | 'ducking' | 'normalize';

export type CommandPlan =
  | { ok: true; summary: string; ops: EditOp[]; affected: number; requiresConfirmation: boolean; tool?: undefined }
  | { ok: true; summary: string; ops: []; affected: 0; requiresConfirmation: false; tool: ToolRequest }
  | { ok: false; message: string; examples: string[] };

export interface CommandContext {
  project: Project;
  selection: string[];
  playhead: number;
}

export const COMMAND_EXAMPLES = [
  'Corte os primeiros 5 segundos',
  'Remova os últimos 3 segundos',
  'Remova de 0:10 até 0:15',
  'Divida em 12 segundos',
  'Coloque o texto "Bem-vindos" no início',
  'Adicione um fade no final',
  'Transforme o projeto em formato vertical',
  'Reduza o volume da música em 50%',
  'Deixe o vídeo em câmera lenta',
  'Aplique preto e branco',
  'Remova os silêncios',
  'Gere legendas',
];

/** Remove acentos e normaliza espaços para comparação. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const NUM_WORDS: Record<string, number> = {
  um: 1, uma: 1, one: 1, uno: 1, dois: 2, duas: 2, two: 2, dos: 2, tres: 3, three: 3, quatro: 4, four: 4, cuatro: 4, cinco: 5, five: 5,
  seis: 6, six: 6, sete: 7, seven: 7, siete: 7, oito: 8, eight: 8, ocho: 8, nove: 9, nine: 9, nueve: 9, dez: 10, ten: 10, diez: 10,
  quinze: 15, fifteen: 15, quince: 15, vinte: 20, twenty: 20, veinte: 20, trinta: 30, thirty: 30, treinta: 30, meio: 0.5, half: 0.5, medio: 0.5,
};

const TIME_RE = String.raw`(\d+(?:[.,]\d+)?(?::\d{1,2}(?:[.,]\d+)?)?|${Object.keys(NUM_WORDS).join('|')})\s*(h|hora|horas|hours?|min|minutos?|minutes?|m|s|seg|segs|segundos?|seconds?|secs?|quadros?|frames?|f)?\b`;

/** Converte "5", "5s", "1:30", "2 minutos", "cinco segundos", "10 frames" em frames. */
export function parseDuration(num: string, unit: string | undefined, fps: number): number {
  let seconds: number;
  if (num.includes(':')) {
    const [m, s] = num.split(':');
    seconds = Number(m) * 60 + Number(s!.replace(',', '.'));
  } else if (NUM_WORDS[num] !== undefined) seconds = NUM_WORDS[num]!;
  else seconds = Number(num.replace(',', '.'));
  const u = unit ?? 's';
  if (/^(quadros?|frames?|f)$/.test(u)) return Math.round(seconds);
  if (/^(h|hora|horas|hours?)$/.test(u)) seconds *= 3600;
  else if (/^(min|minutos?|minutes?|m)$/.test(u)) seconds *= 60;
  return Math.round(seconds * fps);
}

function times(text: string, fps: number): number[] {
  const out: number[] = [];
  const re = new RegExp(TIME_RE, 'g');
  for (const m of text.matchAll(re)) out.push(parseDuration(m[1]!, m[2], fps));
  return out;
}

function percent(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(%|por cento|percent|por ciento)/.exec(text);
  return m ? Number(m[1]!.replace(',', '.')) / 100 : null;
}

const has = (t: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(t));

const W = {
  remove: ['cort', 'remov', 'tir', 'apag', 'exclu', 'delet', 'cut', 'remove', 'trim', 'quit', 'elimin', 'borr'],
  first: ['primeir', 'inicio', 'comeco', 'first', 'beginning', 'start', 'primer', 'principio'],
  last: ['ultim', 'final', 'fim', 'last', 'end', 'ending'],
  split: ['divid', 'split', 'separ', 'parti'],
  text: ['texto', 'titulo', 'legenda escrita', 'text', 'title', 'caption text', 'letrero'],
  add: ['coloq', 'adicion', 'insir', 'inser', 'pon', 'bot', 'add', 'put', 'agreg', 'escrev', 'write', 'crie', 'create'],
  fade: ['fade', 'esmaec', 'desvanec', 'escurec', 'dissolv'],
  vertical: ['vertical', '9:16', '9x16', 'retrato', 'portrait', 'reels', 'tiktok', 'shorts', 'stories'],
  horizontal: ['horizontal', '16:9', '16x9', 'paisagem', 'landscape', 'widescreen', 'youtube'],
  square: ['quadrad', '1:1', 'square', 'cuadrad'],
  fourfive: ['4:5', '4x5'],
  cinema: ['21:9', 'cinematografic', 'cinema'],
  volume: ['volume', 'volumen', 'som', 'sound', 'audio', 'sonido'],
  lower: ['reduz', 'diminu', 'abaix', 'baix', 'lower', 'reduce', 'decrease', 'baja', 'disminu', 'turn down', 'mais baixo'],
  raise: ['aument', 'aumen', 'suba', 'subi', 'raise', 'increase', 'louder', 'turn up', 'mais alto', 'sube'],
  music: ['musica', 'trilha', 'music', 'soundtrack', 'song', 'cancion', 'fundo musical'],
  voice: ['voz', 'narracao', 'voice', 'narration', 'fala', 'video'],
  slow: ['camera lenta', 'camara lenta', 'slow', 'lento', 'devagar', 'desaceler'],
  fast: ['aceler', 'rapido', 'speed up', 'fast', 'timelapse', 'apresur'],
  bw: ['preto e branco', 'p&b', 'black and white', 'grayscale', 'blanco y negro', 'monocrom', 'cinza'],
  silence: ['silencio', 'silence', 'pausa', 'pause', 'gaps'],
  captions: ['legenda', 'caption', 'subtitle', 'subtitulo', 'transcri'],
  marker: ['marcador', 'marker', 'marca'],
  duplicate: ['duplic', 'duplicate', 'copie', 'clone'],
  reframe: ['reenquadr', 'reframe', 'enquadr'],
  suggest: ['sugest', 'suggest', 'melhor', 'improve', 'dica', 'tips'],
  highlight: ['clipes curtos', 'cortes curtos', 'highlights', 'melhores momentos', 'short clips', 'shorts automatic'],
  duck: ['ducking', 'abaixar a musica quando', 'duck'],
  normalize: ['normaliz', 'normalize', 'nivelar'],
};

function finish(ctx: CommandContext, summary: string, ops: EditOp[], affected: number): CommandPlan {
  if (ops.length === 0) return { ok: false, message: 'Nada a alterar para esse comando no projeto atual.', examples: COMMAND_EXAMPLES };
  try {
    applyOp(ctx.project, { type: 'batch', ops, label: summary });
  } catch (e) {
    return { ok: false, message: `O comando não pode ser aplicado: ${(e as Error).message}`, examples: COMMAND_EXAMPLES };
  }
  return { ok: true, summary, ops, affected, requiresConfirmation: affected > 1 || ops.some((o) => o.type === 'range.remove' || o.type === 'project.resize') };
}

const tool = (t: ToolRequest, summary: string): CommandPlan => ({ ok: true, summary, ops: [], affected: 0, requiresConfirmation: false, tool: t });

function visualClips(p: Project): Clip[] {
  return Object.values(p.clips).filter((c) => c.type === 'video' || c.type === 'image');
}

function targetsFor(ctx: CommandContext, filter: (c: Clip) => boolean): Clip[] {
  const sel = ctx.selection.map((id) => ctx.project.clips[id]).filter((c): c is Clip => !!c && filter(c));
  return sel.length ? sel : Object.values(ctx.project.clips).filter(filter);
}

/** Interpreta o comando e devolve um plano validado (ou uma explicação). */
export function interpretCommand(input: string, ctx: CommandContext): CommandPlan {
  const t = normalize(input);
  const p = ctx.project;
  const fps = p.settings.fps;
  const dur = projectDuration(p);
  if (!t) return { ok: false, message: 'Digite um comando.', examples: COMMAND_EXAMPLES };

  // Ferramentas que exigem análise de mídia.
  if (has(t, W.silence) && has(t, [...W.remove, 'detect', 'encontr', 'find'])) return tool('silence', 'Analisar o áudio e sugerir cortes nos silêncios');
  if (has(t, W.captions) && !has(t, ['texto "', "texto '"]) && has(t, ['ger', 'cri', 'fac', 'add', 'adicion', 'generate', 'create', 'make', 'transcrev', 'transcrib', 'legende', 'agreg', 'pon'])) return tool('captions', 'Transcrever a fala e gerar legendas sincronizadas');
  if (has(t, W.reframe)) return tool('reframe', 'Detectar o assunto e reenquadrar automaticamente');
  if (has(t, W.highlight)) return tool('highlights', 'Sugerir trechos para clipes curtos');
  if (has(t, W.duck)) return tool('ducking', 'Abaixar a música automaticamente durante a fala');
  if (has(t, W.suggest)) return tool('suggestions', 'Analisar o projeto e sugerir melhorias');

  // Texto: conteúdo entre aspas.
  const quoted = /["“”'‘’«»](.+?)["“”'‘’«»]/.exec(input);
  if (has(t, W.add) && (has(t, W.text) || quoted)) {
    let start = ctx.playhead;
    if (has(t, W.first)) start = 0;
    else if (has(t, W.last)) start = Math.max(0, dur - 3 * fps);
    else {
      const at = /\b(em|aos?|at|en|no segundo|a los)\s+/.exec(t) ? times(t.replace(/["“”'‘’].*?["“”'‘’]/g, ''), fps)[0] : undefined;
      if (at !== undefined) start = at;
    }
    const durMatch = /(?:por|durante|for|de duracao)\s+/.test(t) ? times(t.split(/por|durante|for/).pop()!, fps)[0] : undefined;
    const duration = durMatch && durMatch > 0 ? durMatch : 3 * fps;
    if (quoted) {
      return finish(ctx, `Adicionar o texto “${quoted[1]}” em ${(start / fps).toFixed(1)} s por ${(duration / fps).toFixed(1)} s`, [{ type: 'clip.addText', start, duration, style: { content: quoted[1]!, animationIn: 'fade', animationOut: 'fade' } }], 1);
    }
    // "Coloque este texto no início": move o texto selecionado.
    const sel = ctx.selection.map((id) => p.clips[id]).find((c) => c?.type === 'text');
    if (sel) return finish(ctx, `Mover o texto selecionado para ${(start / fps).toFixed(1)} s`, [{ type: 'clip.move', clipIds: [sel.id], delta: start - sel.start }], 1);
    return { ok: false, message: 'Escreva o texto entre aspas — por exemplo: Coloque o texto "Olá" no início — ou selecione um texto existente.', examples: COMMAND_EXAMPLES };
  }

  // Fade.
  if (has(t, W.fade)) {
    const d = times(t, fps)[0] ?? fps;
    const atStart = has(t, W.first) && !has(t, W.last);
    const ops: EditOp[] = [];
    let n = 0;
    for (const c of Object.values(p.clips)) {
      const atEdge = atStart ? c.start === 0 : clipEnd(c) === dur;
      if (!atEdge) continue;
      if ('opacity' in c && c.type !== 'adjustment') {
        const fd = Math.min(d, c.duration - 1);
        const from = atStart ? 0 : c.duration - 1 - fd;
        const to = atStart ? fd : c.duration - 1;
        ops.push({ type: 'keyframe.set', clipId: c.id, prop: 'opacity', frame: from, value: atStart ? 0 : c.opacity, easing: 'ease-in-out' });
        ops.push({ type: 'keyframe.set', clipId: c.id, prop: 'opacity', frame: to, value: atStart ? c.opacity : 0, easing: 'linear' });
        n++;
      }
      if ('audio' in c) {
        ops.push({ type: 'clip.update', clipIds: [c.id], patch: { audio: atStart ? { fadeIn: d / fps } : { fadeOut: d / fps } } });
        n++;
      }
    }
    return finish(ctx, `Fade ${atStart ? 'de entrada no início' : 'de saída no final'} (${(d / fps).toFixed(1)} s)`, ops, n);
  }

  // Formato.
  const short = Math.min(p.settings.width, p.settings.height);
  const fmt = (w: number, h: number, label: string) => {
    const k = short / Math.min(w, h);
    const ew = (n: number) => Math.round((n * k) / 2) * 2;
    return finish(ctx, `Mudar o formato para ${label} (${ew(w)}×${ew(h)}), preenchendo o quadro`, [{ type: 'project.resize', width: ew(w), height: ew(h), refit: 'cover' }], visualClips(p).length);
  };
  if (has(t, ['formato', 'format', 'proporcao', 'aspect', 'transform', 'converta', 'convert', 'deixe', 'mude', 'change', 'cambi']) || /^(vertical|horizontal|quadrado)/.test(t)) {
    if (has(t, W.vertical)) return fmt(9, 16, 'vertical 9:16');
    if (has(t, W.fourfive)) return fmt(4, 5, '4:5');
    if (has(t, W.square)) return fmt(1, 1, 'quadrado 1:1');
    if (has(t, W.cinema)) return fmt(21, 9, 'cinema 21:9');
    if (has(t, W.horizontal)) return fmt(16, 9, 'horizontal 16:9');
  }

  // Volume.
  if (has(t, W.volume) || (has(t, W.music) && (has(t, [...W.lower, ...W.raise]) || percent(t) !== null))) {
    const music = has(t, W.music);
    const voice = !music && has(t, W.voice);
    const targets = Object.values(p.clips).filter((c): c is Extract<Clip, { type: 'audio' | 'video' }> => {
      if (c.type === 'audio') return !voice || /narra|voz|voice/i.test(c.name);
      if (c.type === 'video') return !music && (p.assets[c.assetId]?.hasAudio ?? false);
      return false;
    });
    const sel = targets.filter((c) => ctx.selection.includes(c.id));
    const list = sel.length ? sel : targets;
    if (list.length === 0) return { ok: false, message: music ? 'Não encontrei clipes de música (áudio) no projeto.' : 'Não há clipes com áudio no projeto.', examples: COMMAND_EXAMPLES };
    const pc = percent(t);
    const absolute = /\b(para|to|a|em)\s+\d+(?:[.,]\d+)?\s*%/.test(t) && /\b(para|to)\b/.test(t);
    const lower = has(t, W.lower);
    const raise = has(t, W.raise);
    if (has(t, ['mud', 'silenci', 'mute', 'sem som'])) {
      return finish(ctx, `Silenciar ${list.length} clipe(s)`, [{ type: 'clip.update', clipIds: list.map((c) => c.id), patch: { audio: { muted: true } } }], list.length);
    }
    const ops: EditOp[] = list.map((c) => {
      let v = c.audio.volume;
      if (absolute && pc !== null) v = pc;
      else if (lower) v = v * (1 - (pc ?? 0.5));
      else if (raise) v = v * (1 + (pc ?? 0.5));
      else if (pc !== null) v = pc;
      return { type: 'clip.update', clipIds: [c.id], patch: { audio: { volume: Math.max(0, Math.min(4, Math.round(v * 1000) / 1000)) } } };
    });
    const label = absolute && pc !== null ? `para ${Math.round(pc * 100)}%` : lower ? `em ${Math.round((pc ?? 0.5) * 100)}%` : raise ? `em ${Math.round((pc ?? 0.5) * 100)}%` : '';
    return finish(ctx, `${lower ? 'Reduzir' : raise ? 'Aumentar' : 'Ajustar'} o volume ${music ? 'da música' : voice ? 'da voz' : 'do áudio'} ${label} (${list.length} clipe(s))`, ops, list.length);
  }

  // Velocidade.
  const speedX = /(\d+(?:[.,]\d+)?)\s*x\b/.exec(t);
  if (has(t, W.slow) || has(t, W.fast) || (speedX && has(t, ['velocidade', 'speed', 'velocidad']))) {
    const speed = speedX ? Number(speedX[1]!.replace(',', '.')) : has(t, W.slow) ? 0.5 : 2;
    const list = targetsFor(ctx, (c) => c.type === 'video' || c.type === 'audio');
    if (list.length === 0) return { ok: false, message: 'Não há vídeo ou áudio para alterar a velocidade.', examples: COMMAND_EXAMPLES };
    return finish(ctx, `Velocidade ${speed}x em ${list.length} clipe(s)`, list.map((c) => ({ type: 'clip.speed', clipId: c.id, speed })), list.length);
  }

  // Preto e branco.
  if (has(t, W.bw)) {
    const list = targetsFor(ctx, (c) => c.type === 'video' || c.type === 'image');
    return finish(ctx, `Aplicar preto e branco em ${list.length} clipe(s)`, [{ type: 'effect.add', clipIds: list.map((c) => c.id), effect: 'grayscale' }], list.length);
  }

  // Normalizar áudio (análise de loudness).
  if (has(t, W.normalize)) return tool('normalize', 'Normalizar o volume dos clipes de áudio (−14 LUFS)');

  // Dividir.
  if (has(t, W.split)) {
    const at = times(t, fps)[0] ?? ctx.playhead;
    return finish(ctx, `Dividir os clipes em ${(at / fps).toFixed(2)} s`, [{ type: 'clip.split', frame: at }], 1);
  }

  // Marcador.
  if (has(t, W.marker) && has(t, W.add)) {
    const at = times(t, fps)[0] ?? ctx.playhead;
    return finish(ctx, `Adicionar marcador em ${(at / fps).toFixed(2)} s`, [{ type: 'marker.add', frame: at }], 1);
  }

  // Duplicar seleção.
  if (has(t, W.duplicate) && ctx.selection.length) {
    return finish(ctx, `Duplicar ${ctx.selection.length} elemento(s)`, [{ type: 'clip.duplicate', clipIds: ctx.selection }], ctx.selection.length);
  }

  // Remoção de trechos.
  if (has(t, W.remove)) {
    const ts = times(t, fps);
    const between = /\b(de|entre|from|between|desde)\b.*\b(ate|a|e|to|and|hasta|y)\b/.test(t) && ts.length >= 2;
    if (between) {
      const [a, b] = [Math.min(ts[0]!, ts[1]!), Math.max(ts[0]!, ts[1]!)];
      return finish(ctx, `Remover o trecho de ${(a / fps).toFixed(2)} s a ${(b / fps).toFixed(2)} s (todas as faixas)`, [{ type: 'range.remove', start: a, end: Math.min(b, dur) }], 1);
    }
    if (ts.length >= 1 && has(t, W.first)) {
      const n = Math.min(ts[0]!, dur);
      return finish(ctx, `Remover os primeiros ${(n / fps).toFixed(2)} s (todas as faixas)`, [{ type: 'range.remove', start: 0, end: n }], 1);
    }
    if (ts.length >= 1 && has(t, W.last)) {
      const n = Math.min(ts[0]!, dur);
      return finish(ctx, `Remover os últimos ${(n / fps).toFixed(2)} s (todas as faixas)`, [{ type: 'range.remove', start: dur - n, end: dur }], 1);
    }
    if (ctx.selection.length && has(t, ['selecion', 'selected', 'este', 'esse', 'this', 'clipe', 'clip'])) {
      return finish(ctx, `Excluir ${ctx.selection.length} elemento(s) selecionado(s)`, [{ type: 'clip.remove', clipIds: ctx.selection, ripple: true }], ctx.selection.length);
    }
  }

  return { ok: false, message: 'Não entendi esse comando com o interpretador local. Tente um dos exemplos ou ative um provedor de IA nas Configurações para comandos livres.', examples: COMMAND_EXAMPLES };
}
