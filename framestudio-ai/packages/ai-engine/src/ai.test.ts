import { describe, expect, it } from 'vitest';
import { applyOp } from '@framestudio/editor-core';
import { createProject, type AudioClip, type MediaAsset, type Project, type VideoClip } from '@framestudio/shared';
import { projectDuration } from '@framestudio/timeline';
import {
  AI_ALLOWED_OPS,
  analyzeProject,
  buildCaptionChunks,
  interpretCommand,
  parseDuration,
  planDucking,
  reframeKeyframes,
  resampleTo16k,
  saliencyCenter,
  searchTranscript,
  silenceRemovalOps,
  suggestHighlights,
  suggestSilenceCuts,
  suggestTranscriptCuts,
  validateLlmResponse,
} from './index.ts';

const video: MediaAsset = { id: 'v', name: 'v.webm', kind: 'video', mimeType: 'video/webm', size: 1, storageKey: 'v', duration: 20, width: 1920, height: 1080, hasVideo: true, hasAudio: true, fingerprint: 'v', createdAt: 0 };
const music: MediaAsset = { id: 'm', name: 'musica.wav', kind: 'audio', mimeType: 'audio/wav', size: 1, storageKey: 'm', duration: 30, hasVideo: false, hasAudio: true, fingerprint: 'm', createdAt: 0 };

function project(): { p: Project; v: string; m: string } {
  let p = createProject({ name: 'p', width: 1920, height: 1080, fps: 30 });
  p = applyOp(p, { type: 'asset.add', asset: video }).project;
  p = applyOp(p, { type: 'asset.add', asset: music }).project;
  const rv = applyOp(p, { type: 'clip.addAsset', assetId: 'v', start: 0 });
  const rm = applyOp(rv.project, { type: 'clip.addAsset', assetId: 'm', start: 0 });
  return { p: rm.project, v: rv.created[0]!, m: rm.created[0]! };
}
const ctx = (p: Project, selection: string[] = []) => ({ project: p, selection, playhead: 0 });
const run = (p: Project, plan: ReturnType<typeof interpretCommand>) => {
  if (!plan.ok || plan.tool) throw new Error('sem plano');
  return applyOp(p, { type: 'batch', ops: plan.ops }).project;
};

describe('interpretCommand', () => {
  it('“Corte os primeiros 5 segundos” remove o trecho em todas as faixas', () => {
    const { p } = project();
    const plan = interpretCommand('Corte os primeiros 5 segundos.', ctx(p));
    expect(plan.ok && plan.requiresConfirmation).toBe(true);
    const r = run(p, plan);
    expect(projectDuration(r)).toBe(projectDuration(p) - 150);
    const v = Object.values(r.clips).find((c) => c.type === 'video') as VideoClip;
    expect(v.start).toBe(0);
    expect(v.sourceIn).toBeCloseTo(5);
  });

  it('entende inglês e espanhol', () => {
    const { p } = project();
    expect(projectDuration(run(p, interpretCommand('cut the last 2 seconds', ctx(p))))).toBe(projectDuration(p) - 60);
    expect(projectDuration(run(p, interpretCommand('elimina los primeros tres segundos', ctx(p))))).toBe(projectDuration(p) - 90);
  });

  it('remove intervalo “de 0:10 até 0:15”', () => {
    const { p } = project();
    const r = run(p, interpretCommand('Remova de 0:10 até 0:15', ctx(p)));
    expect(projectDuration(r)).toBe(projectDuration(p) - 150);
  });

  it('coloca texto entre aspas no início', () => {
    const { p } = project();
    const r = run(p, interpretCommand('Coloque o texto "Bem-vindos!" no início', ctx(p)));
    const t = Object.values(r.clips).find((c) => c.type === 'text');
    expect(t?.start).toBe(0);
    expect(t?.type === 'text' && t.text.content).toBe('Bem-vindos!');
  });

  it('adiciona fade no final (opacidade e áudio)', () => {
    const { p, m } = project();
    const r = run(p, interpretCommand('Adicione um fade no final', ctx(p)));
    expect((r.clips[m] as AudioClip).audio.fadeOut).toBeCloseTo(1);
  });

  it('transforma em vertical preenchendo', () => {
    const { p, v } = project();
    const r = run(p, interpretCommand('Transforme o projeto em formato vertical', ctx(p)));
    expect(r.settings.width).toBe(1080);
    expect(r.settings.height).toBe(1920);
    expect((r.clips[v] as VideoClip).transform.fit).toBe('cover');
  });

  it('reduz o volume da música', () => {
    const { p, m, v } = project();
    const r = run(p, interpretCommand('Reduza o volume da música em 50%', ctx(p)));
    expect((r.clips[m] as AudioClip).audio.volume).toBeCloseTo(0.5);
    expect((r.clips[v] as VideoClip).audio.volume).toBe(1);
    const r2 = run(p, interpretCommand('deixe a música para 20%', ctx(p)));
    expect((r2.clips[m] as AudioClip).audio.volume).toBeCloseTo(0.2);
  });

  it('pede ferramentas de análise quando necessário', () => {
    const { p } = project();
    const s = interpretCommand('remova os silêncios', ctx(p));
    expect(s.ok && s.tool).toBe('silence');
    const c = interpretCommand('gere legendas automáticas', ctx(p));
    expect(c.ok && c.tool).toBe('captions');
  });

  it('câmera lenta e preto e branco na seleção', () => {
    const { p, v } = project();
    const r = run(p, interpretCommand('deixe em câmera lenta', ctx(p, [v])));
    expect((r.clips[v] as VideoClip).speed).toBe(0.5);
    const r2 = run(p, interpretCommand('aplique preto e branco', ctx(p, [v])));
    expect((r2.clips[v] as VideoClip).effects[0]?.type).toBe('grayscale');
  });

  it('explica quando não entende', () => {
    const { p } = project();
    const r = interpretCommand('faça um café', ctx(p));
    expect(r.ok).toBe(false);
  });

  it('parseDuration', () => {
    expect(parseDuration('1:30', undefined, 30)).toBe(2700);
    expect(parseDuration('2', 'minutos', 25)).toBe(3000);
    expect(parseDuration('10', 'frames', 30)).toBe(10);
    expect(parseDuration('cinco', 'segundos', 30)).toBe(150);
  });
});

describe('validação de planos de IA externa', () => {
  it('aceita somente operações permitidas e válidas', () => {
    const { p, v } = project();
    const ok = validateLlmResponse(`Aqui está: {"summary":"Acelerar","ops":[{"type":"clip.speed","clipId":"${v}","speed":2}]}`, ctx(p));
    expect(ok.ok).toBe(true);
    const bad = validateLlmResponse('{"summary":"x","ops":[{"type":"asset.remove","assetId":"v"}]}', ctx(p));
    expect(bad.ok).toBe(false);
    const invalid = validateLlmResponse('{"summary":"x","ops":[{"type":"clip.speed","clipId":"nao-existe","speed":2}]}', ctx(p));
    expect(invalid.ok).toBe(false);
    expect(AI_ALLOWED_OPS.has('asset.add')).toBe(false);
  });
});

const SR = 16000;
function speechPcm(pattern: [number, number][], total: number) {
  const data = new Float32Array(Math.round(SR * total));
  for (const [a, b] of pattern) for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) data[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / SR);
  return { sampleRate: SR, channels: [data] };
}

describe('silêncios e ducking', () => {
  it('converte silêncios do clipe em cortes da timeline respeitando sourceIn e velocidade', () => {
    let { p, v } = project();
    p = applyOp(p, { type: 'clip.trim', clipId: v, edge: 'start', frame: 60 }).project; // sourceIn = 2 s, start = 60
    p = applyOp(p, { type: 'clip.speed', clipId: v, speed: 2 }).project;
    const clip = p.clips[v] as VideoClip;
    // Fala de 2–4 s e 7–20 s na mídia; silêncio 4–7 s → na timeline: start + (2..5 s)/2.
    const pcm = speechPcm([[2, 4], [7, 20]], 20);
    const s = suggestSilenceCuts(p, clip, pcm, { thresholdDb: -40, minSilence: 0.5, padding: 0 });
    expect(s.ranges).toHaveLength(1);
    expect(s.ranges[0]!.start).toBeCloseTo(60 + 30, -1);
    expect(s.ranges[0]!.end).toBeCloseTo(60 + 75, -1);
    const after = applyOp(p, { type: 'batch', ops: silenceRemovalOps(s.ranges) }).project;
    expect(projectDuration(after)).toBeLessThan(projectDuration(p));
  });

  it('ducking gera keyframes que abaixam a música durante a fala', () => {
    const { p, v, m } = project();
    const pcm = speechPcm([[5, 8]], 20);
    const ops = planDucking(p, p.clips[m] as AudioClip, [{ clip: p.clips[v] as VideoClip, pcm }], { reductionDb: -12, thresholdDb: -35, attack: 0.2, release: 0.4 });
    const r = applyOp(p, { type: 'batch', ops }).project;
    const kfs = (r.clips[m] as AudioClip).keyframes.volume!;
    expect(kfs.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...kfs.map((k) => k.value))).toBeCloseTo(Math.pow(10, -12 / 20), 2);
  });

  it('destaques preferem trechos com fala', () => {
    const pcm = speechPcm([[40, 70]], 120);
    const h = suggestHighlights(pcm, { minLen: 20, maxLen: 30, count: 1 });
    expect(h[0]!.start).toBeGreaterThan(35);
    expect(h[0]!.end).toBeLessThan(75);
  });
});

describe('legendas e transcrição', () => {
  const words = 'Olá pessoal, hoje vamos falar sobre edição de vídeo. É muito simples e rápido.'.split(' ').map((t, i) => ({ text: t, start: i * 0.4, end: i * 0.4 + 0.35 }));
  it('agrupa por pontuação e tamanho', () => {
    const chunks = buildCaptionChunks(words);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.text.endsWith('vídeo.'))).toBe(true);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(42);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBeGreaterThanOrEqual(chunks[i - 1]!.end);
    expect(chunks[0]!.words[0]!.start).toBe(0);
  });
  it('busca palavras sem acento e sugere cortes de preenchimento', () => {
    expect(searchTranscript(words, 'edicao')[0]!.start).toBeCloseTo(2.4);
    const cuts = suggestTranscriptCuts([{ text: 'então', start: 0, end: 0.3 }, { text: 'é', start: 0.4, end: 0.5 }, { text: 'isso', start: 2, end: 2.3 }], 'pt');
    expect(cuts.some((c) => c.reason.includes('preenchimento'))).toBe(true);
    expect(cuts.some((c) => c.reason.includes('Pausa'))).toBe(true);
  });
  it('reamostra para 16 kHz', () => {
    const out = resampleTo16k(new Float32Array(48000).fill(0.5), 48000);
    expect(out.length).toBe(16000);
    expect(out[100]).toBeCloseTo(0.5);
  });
});

describe('sugestões e reenquadramento', () => {
  it('detecta música alta e bordas pretas', () => {
    let { p } = project();
    p = applyOp(p, { type: 'project.resize', width: 1080, height: 1920 }).project;
    const s = analyzeProject(p);
    expect(s.map((x) => x.id)).toEqual(expect.arrayContaining(['music', 'letterbox']));
    const fixed = applyOp(p, { type: 'batch', ops: s.find((x) => x.id === 'letterbox')!.fix!.ops }).project;
    expect(analyzeProject(fixed).some((x) => x.id === 'letterbox')).toBe(false);
  });

  it('saliência encontra o objeto e gera keyframes limitados', () => {
    const w = 32;
    const h = 18;
    const img = new Uint8ClampedArray(w * h * 4);
    for (let y = 6; y < 12; y++) for (let x = 22; x < 28; x++) img.set([255, 255, 255, 255], (y * w + x) * 4);
    const c = saliencyCenter(img, w, h);
    expect(c.x).toBeGreaterThan(0.65);
    const { p, v } = project();
    const ops = reframeKeyframes(p.clips[v] as VideoClip, [{ localFrame: 0, cx: c.x }], { width: 1920, height: 1080 }, { width: 1080, height: 1920 }, 0);
    const kf = ops.find((o) => o.type === 'keyframe.set') as { value: number };
    expect(kf.value).toBeLessThan(0); // assunto à direita → imagem desloca para a esquerda
    const maxShift = (1920 * (1920 / 1080) - 1080) / 2;
    expect(Math.abs(kf.value)).toBeLessThanOrEqual(maxShift);
  });
});
