/**
 * Ponte OPCIONAL para um provedor de IA externo (Anthropic ou API compatível com OpenAI), usada
 * apenas quando o usuário a ativa. Só o texto do comando e um resumo do projeto (sem mídia) são
 * enviados. A resposta precisa ser JSON com operações da lista permitida; tudo é validado
 * localmente por simulação antes de ser oferecido ao usuário. Nada é executado automaticamente.
 */
import { applyOp, type EditOp } from '@framestudio/editor-core';
import type { Project } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import type { CommandContext, CommandPlan } from './commands.ts';

export interface LlmConfig {
  provider: 'anthropic' | 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Operações que a IA pode propor. Importação de mídia, LUTs e inserção de clipes arbitrários ficam de fora. */
export const AI_ALLOWED_OPS: ReadonlySet<EditOp['type']> = new Set([
  'clip.addText',
  'clip.remove',
  'clip.move',
  'clip.trim',
  'clip.split',
  'clip.duplicate',
  'clip.speed',
  'clip.update',
  'clip.detachAudio',
  'clip.freeze',
  'keyframe.set',
  'keyframe.remove',
  'effect.add',
  'effect.update',
  'effect.remove',
  'transition.add',
  'transition.remove',
  'marker.add',
  'project.resize',
  'range.remove',
  'track.update',
]);

/** Resumo compacto do projeto (sem dados de mídia) para dar contexto ao modelo. */
export function projectSummary(p: Project, ctx: Pick<CommandContext, 'selection' | 'playhead'>): string {
  const fps = p.settings.fps;
  const clips = Object.values(p.clips)
    .sort((a, b) => a.start - b.start)
    .slice(0, 120)
    .map((c) => ({
      id: c.id,
      type: c.type,
      track: p.tracks.findIndex((t) => t.id === c.trackId),
      start: c.start,
      duration: c.duration,
      name: c.type === 'text' || c.type === 'caption' ? c.text.content.slice(0, 60) : c.name,
      ...('audio' in c ? { volume: c.audio.volume } : {}),
      ...('speed' in c ? { speed: c.speed } : {}),
    }));
  return JSON.stringify({
    fps,
    width: p.settings.width,
    height: p.settings.height,
    durationFrames: projectDuration(p),
    playheadFrame: Math.round(ctx.playhead),
    selection: ctx.selection,
    tracks: p.tracks.map((t, i) => ({ index: i, id: t.id, kind: t.kind, name: t.name, locked: t.locked })),
    clips,
  });
}

const SYSTEM = `Você é o assistente de edição do FrameStudio AI. Converta o pedido do usuário em operações JSON.
Responda SOMENTE com um objeto JSON: {"summary": "<descrição curta em português>", "ops": [<operações>]}.
Tempos são em FRAMES (inteiros) na taxa "fps" do projeto. Use apenas estes tipos de operação:
- {"type":"clip.addText","start":F,"duration":F,"style":{"content":"..."}}
- {"type":"clip.remove","clipIds":[...],"ripple":bool}
- {"type":"clip.move","clipIds":[...],"delta":F}
- {"type":"clip.trim","clipId":"...","edge":"start"|"end","frame":F}
- {"type":"clip.split","frame":F,"clipIds":[...] (opcional)}
- {"type":"clip.duplicate","clipIds":[...]}
- {"type":"clip.speed","clipId":"...","speed":0.1-16}
- {"type":"clip.update","clipIds":[...],"patch":{"opacity":0-1 | "audio":{"volume":0-4,"fadeIn":s,"fadeOut":s,"muted":bool} | "transform":{"x","y","scale","rotation"} | "color":{"saturation","contrast","brightness","exposure","temperature"}}}
- {"type":"keyframe.set","clipId":"...","prop":"x|y|scale|rotation|opacity|volume","frame":F_relativo_ao_clipe,"value":n}
- {"type":"effect.add","clipIds":[...],"effect":"blur|grayscale|sepia|vignette|glitch|shake|zoom|grain|glow"}
- {"type":"transition.add","fromClipId":"...","toClipId":"...","transition":"dissolve|fade-black|wipe|slide|zoom","duration":F}
- {"type":"marker.add","frame":F,"label":"..."}
- {"type":"project.resize","width":W,"height":H,"refit":"cover"|"contain"}
- {"type":"range.remove","start":F,"end":F}
Se o pedido for impossível ou ambíguo, responda {"summary":"<explicação>","ops":[]}.`;

async function callProvider(cfg: LlmConfig, user: string, signal?: AbortSignal): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  if (cfg.provider === 'anthropic') {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: cfg.model, max_tokens: 2048, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`Provedor respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === 'text')?.text ?? '';
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Provedor respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Extrai e valida o plano da resposta do modelo (lista permitida + simulação). */
export function validateLlmResponse(text: string, ctx: CommandContext): CommandPlan {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return { ok: false, message: 'A IA não retornou um plano válido.', examples: [] };
  let parsed: { summary?: unknown; ops?: unknown };
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return { ok: false, message: 'A resposta da IA não é JSON válido.', examples: [] };
  }
  const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 300) : 'Plano da IA';
  if (!Array.isArray(parsed.ops)) return { ok: false, message: 'Plano sem operações.', examples: [] };
  if (parsed.ops.length === 0) return { ok: false, message: summary, examples: [] };
  if (parsed.ops.length > 200) return { ok: false, message: 'O plano tem operações demais para revisar com segurança.', examples: [] };
  const ops: EditOp[] = [];
  for (const op of parsed.ops) {
    if (!op || typeof op !== 'object' || !AI_ALLOWED_OPS.has((op as EditOp).type)) {
      return { ok: false, message: `Operação não permitida no plano da IA: ${JSON.stringify((op as { type?: unknown })?.type ?? op).slice(0, 60)}`, examples: [] };
    }
    ops.push(op as EditOp);
  }
  try {
    applyOp(ctx.project, { type: 'batch', ops, label: summary });
  } catch (e) {
    return { ok: false, message: `O plano da IA é inválido para este projeto: ${(e as Error).message}`, examples: [] };
  }
  const ids = new Set<string>();
  for (const op of ops) for (const k of ['clipId', 'clipIds', 'fromClipId'] as const) {
    const v = (op as unknown as Record<string, unknown>)[k];
    if (typeof v === 'string') ids.add(v);
    if (Array.isArray(v)) v.forEach((x) => ids.add(String(x)));
  }
  return { ok: true, summary, ops, affected: Math.max(1, ids.size), requiresConfirmation: true };
}

export async function interpretWithLlm(cfg: LlmConfig, command: string, ctx: CommandContext, signal?: AbortSignal): Promise<CommandPlan> {
  const text = await callProvider(cfg, `Projeto: ${projectSummary(ctx.project, ctx)}\n\nPedido: ${command}`, signal);
  return validateLlmResponse(text, ctx);
}

/** Tradução de legendas pelo provedor configurado (uma chamada por lote). */
export async function translateLines(cfg: LlmConfig, lines: string[], target: string, signal?: AbortSignal): Promise<string[]> {
  const prompt = `Traduza cada item do array JSON abaixo para ${target}. Responda SOMENTE com um array JSON de strings, mesma ordem e mesmo tamanho.\n${JSON.stringify(lines)}`;
  const base = cfg.baseUrl.replace(/\/+$/, '');
  let text = '';
  if (cfg.provider === 'anthropic') {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Provedor respondeu ${res.status}`);
    text = ((await res.json()) as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
  } else {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Provedor respondeu ${res.status}`);
    text = ((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '';
  }
  const m = /\[[\s\S]*\]/.exec(text);
  const arr = m ? (JSON.parse(m[0]) as unknown[]) : [];
  if (!Array.isArray(arr) || arr.length !== lines.length) throw new Error('A tradução retornou um número diferente de linhas.');
  return arr.map(String);
}
