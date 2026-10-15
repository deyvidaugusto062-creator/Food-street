/**
 * Templates para redes sociais. Cada template gera uma composição 100% editável (textos, cores,
 * fundos e transições) — sem músicas, fontes ou imagens de terceiros: os fundos são gradientes
 * gerados localmente e as fontes são as livres empacotadas com o app.
 */
import { applyOp, type EditOp } from '@framestudio/editor-core';
import { createId, createProject, secondsToFrames, type MediaAsset, type Project, type TextStyle } from '@framestudio/shared';
import { repo } from './repo.ts';

export interface TemplateDef {
  id: string;
  name: string;
  platform: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  seconds: number;
  colors: [string, string];
  build: (ctx: BuildCtx) => TextSpec[];
}

interface TextSpec {
  start: number;
  duration: number;
  style: Partial<TextStyle>;
  x: number;
  y: number;
}

interface BuildCtx {
  text: (start: number, dur: number, style: Partial<TextStyle>, y?: number, x?: number) => TextSpec;
  f: (sec: number) => number;
}

const title = (content: string, extra: Partial<TextStyle> = {}): Partial<TextStyle> => ({
  content,
  fontFamily: '"Montserrat Variable", Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 110,
  animationIn: 'pop',
  animationOut: 'fade',
  ...extra,
});

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'reels-hook',
    name: 'Reels — Gancho + legenda',
    platform: 'Instagram Reels',
    description: 'Título de impacto, faixa de legendas e CTA final. 9:16.',
    width: 1080,
    height: 1920,
    fps: 30,
    seconds: 15,
    colors: ['#8257FF', '#101014'],
    build: ({ text, f }) => [
      text(0, f(3), title('VOCÊ PRECISA\nVER ISSO', { fontSize: 120, animationIn: 'pop' }), -520),
      text(f(3), f(9), title('Substitua pelo seu conteúdo', { fontSize: 64, fontWeight: 600, animationIn: 'slide-up', background: { enabled: true, color: 'rgba(16,16,20,0.7)', padding: 28, radius: 20 } }), 560),
      text(f(12), f(3), title('Siga para mais ✦', { fontSize: 88, animationIn: 'slide-up' }), 0),
    ],
  },
  {
    id: 'stories-promo',
    name: 'Stories — Promoção',
    platform: 'Instagram Stories',
    description: 'Oferta com destaque de preço e chamada para ação. 9:16.',
    width: 1080,
    height: 1920,
    fps: 30,
    seconds: 10,
    colors: ['#FF5E7E', '#4F1D96'],
    build: ({ text, f }) => [
      text(0, f(10), title('OFERTA', { fontFamily: '"Bebas Neue", sans-serif', fontWeight: 400, fontSize: 220, letterSpacing: 8 }), -560),
      text(f(1), f(9), title('R$ 99,90', { fontSize: 160, color: '#FFE08A', animationIn: 'pop' }), -120),
      text(f(2), f(8), title('Só até domingo', { fontSize: 64, fontWeight: 500, animationIn: 'fade' }), 120),
      text(f(4), f(6), title('Arraste para cima', { fontSize: 56, fontWeight: 700, animationIn: 'slide-up', background: { enabled: true, color: '#F5F5F7', padding: 26, radius: 40 }, color: '#101014', shadow: { enabled: false, color: '#000', blur: 0, x: 0, y: 0 } }), 680),
    ],
  },
  {
    id: 'tiktok-list',
    name: 'TikTok — Top 3',
    platform: 'TikTok',
    description: 'Lista numerada com transições entre itens. 9:16.',
    width: 1080,
    height: 1920,
    fps: 30,
    seconds: 12,
    colors: ['#00F2EA', '#FF0050'],
    build: ({ text, f }) => [
      text(0, f(3), title('TOP 3 DICAS', { fontSize: 130 }), -600),
      text(f(3), f(3), title('1. Primeira dica', { fontSize: 84, animationIn: 'slide-left' }), 0),
      text(f(6), f(3), title('2. Segunda dica', { fontSize: 84, animationIn: 'slide-left' }), 0),
      text(f(9), f(3), title('3. Terceira dica', { fontSize: 84, animationIn: 'slide-left' }), 0),
    ],
  },
  {
    id: 'shorts-tutorial',
    name: 'Shorts — Tutorial rápido',
    platform: 'YouTube Shorts',
    description: 'Passo a passo com numeração e título fixo. 9:16.',
    width: 1080,
    height: 1920,
    fps: 30,
    seconds: 20,
    colors: ['#FF3D3D', '#1A1A22'],
    build: ({ text, f }) => [
      text(0, f(20), title('COMO FAZER EM 3 PASSOS', { fontSize: 72, animationIn: 'fade', animationOut: 'none', background: { enabled: true, color: 'rgba(0,0,0,0.55)', padding: 24, radius: 16 } }), -760),
      text(f(1), f(6), title('Passo 1', { fontSize: 100 }), 600),
      text(f(7), f(6), title('Passo 2', { fontSize: 100 }), 600),
      text(f(13), f(7), title('Passo 3', { fontSize: 100 }), 600),
    ],
  },
  {
    id: 'youtube-intro',
    name: 'YouTube — Abertura',
    platform: 'YouTube',
    description: 'Abertura horizontal com título, subtítulo e lower third. 16:9.',
    width: 1920,
    height: 1080,
    fps: 30,
    seconds: 8,
    colors: ['#4F8CFF', '#101014'],
    build: ({ text, f }) => [
      text(0, f(4), title('NOME DO CANAL', { fontSize: 140, letterSpacing: 4 }), -40),
      text(f(0.5), f(3.5), title('episódio 01', { fontSize: 54, fontWeight: 500, animationIn: 'fade' }), 90),
      text(f(4), f(4), title('Seu nome • Apresentador', { fontSize: 44, fontWeight: 600, align: 'left', animationIn: 'slide-left', background: { enabled: true, color: 'rgba(130,87,255,0.9)', padding: 20, radius: 8 } }), 380, -560),
    ],
  },
  {
    id: 'product',
    name: 'Vídeo de produto',
    platform: 'E-commerce',
    description: 'Nome do produto, benefícios e preço. 1:1.',
    width: 1080,
    height: 1080,
    fps: 30,
    seconds: 12,
    colors: ['#F5F5F7', '#C9BCFF'],
    build: ({ text, f }) => [
      text(0, f(4), title('Nome do Produto', { color: '#101014', fontSize: 100, shadow: { enabled: false, color: '#000', blur: 0, x: 0, y: 0 } }), -300),
      text(f(4), f(4), title('✓ Benefício principal\n✓ Segundo benefício', { color: '#101014', fontSize: 60, fontWeight: 600, align: 'left', animationIn: 'slide-up', shadow: { enabled: false, color: '#000', blur: 0, x: 0, y: 0 } }), 0),
      text(f(8), f(4), title('R$ 149', { color: '#8257FF', fontSize: 150, shadow: { enabled: false, color: '#000', blur: 0, x: 0, y: 0 } }), 260),
    ],
  },
  {
    id: 'ad',
    name: 'Anúncio comercial',
    platform: 'Ads 4:5',
    description: 'Problema → solução → CTA. 4:5.',
    width: 1080,
    height: 1350,
    fps: 30,
    seconds: 15,
    colors: ['#101014', '#8257FF'],
    build: ({ text, f }) => [
      text(0, f(5), title('Cansado de perder tempo?', { fontSize: 88 }), 0),
      text(f(5), f(5), title('Conheça a solução', { fontSize: 96, color: '#B39CFF' }), 0),
      text(f(10), f(5), title('Compre agora', { fontSize: 80, background: { enabled: true, color: '#8257FF', padding: 32, radius: 48 } }), 0),
    ],
  },
  {
    id: 'presentation',
    name: 'Apresentação',
    platform: 'Apresentações 16:9',
    description: 'Slides de título e tópicos com transições. 16:9.',
    width: 1920,
    height: 1080,
    fps: 30,
    seconds: 16,
    colors: ['#19191F', '#2C2C35'],
    build: ({ text, f }) => [
      text(0, f(4), title('Título da apresentação', { fontSize: 110, animationIn: 'fade' }), 0),
      text(f(4), f(4), title('Tópico 1\nExplique a ideia principal', { fontSize: 72, fontWeight: 600, animationIn: 'fade' }), 0),
      text(f(8), f(4), title('Tópico 2\nMostre resultados', { fontSize: 72, fontWeight: 600, animationIn: 'fade' }), 0),
      text(f(12), f(4), title('Obrigado!', { fontSize: 120, animationIn: 'pop' }), 0),
    ],
  },
  {
    id: 'captions',
    name: 'Vídeo com legendas',
    platform: 'Qualquer rede 9:16',
    description: 'Estrutura pronta para legendas automáticas com destaque por palavra.',
    width: 1080,
    height: 1920,
    fps: 30,
    seconds: 10,
    colors: ['#222229', '#101014'],
    build: ({ text, f }) => [
      text(0, f(10), title('Importe um vídeo e use AI Studio → Legendas', { fontSize: 54, fontWeight: 600, animationIn: 'fade', boxWidth: 860 }), 0),
    ],
  },
];

/** Gera o fundo em gradiente como imagem PNG local (sem dependência de arquivos de terceiros). */
async function gradientAsset(t: TemplateDef): Promise<MediaAsset> {
  const w = Math.min(t.width, 1080);
  const h = Math.round((w * t.height) / t.width);
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, t.colors[0]);
  grad.addColorStop(1, t.colors[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.75, h * 0.2, 0, w * 0.75, h * 0.2, Math.max(w, h) * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  const blob = await c.convertToBlob({ type: 'image/png' });
  const id = createId('ast_');
  const asset: MediaAsset = {
    id,
    name: `Fundo ${t.name}.png`,
    kind: 'image',
    mimeType: 'image/png',
    size: blob.size,
    storageKey: `media_${id}`,
    duration: 0,
    width: w,
    height: h,
    hasVideo: true,
    hasAudio: false,
    fingerprint: `template:${t.id}:${id}`,
    createdAt: Date.now(),
  };
  await repo.putMedia(asset.storageKey, blob);
  return asset;
}

export async function createFromTemplate(t: TemplateDef, name?: string): Promise<Project> {
  let project = createProject({ name: name ?? t.name, width: t.width, height: t.height, fps: t.fps });
  project.templateId = t.id;
  const bg = await gradientAsset(t);
    const f = (sec: number) => secondsToFrames(sec, t.fps);
  const videoTrack = project.tracks.find((x) => x.kind === 'video')!.id;
  const textTrack = project.tracks.find((x) => x.kind === 'text')!.id;
  const run = (op: EditOp) => {
    project = applyOp(project, op).project;
  };
  run({ type: 'asset.add', asset: bg });
  const res = applyOp(project, { type: 'clip.addAsset', assetId: bg.id, start: 0, trackId: videoTrack });
  project = res.project;
  const bgClip = res.created[0]!;
  run({ type: 'clip.trim', clipId: bgClip, edge: 'end', frame: f(t.seconds) });
  run({ type: 'clip.update', clipIds: [bgClip], patch: { transform: { fit: 'cover' } } });
  const ctx: BuildCtx = { f, text: (start, duration, style, y = 0, x = 0) => ({ start, duration, style, x, y }) };
  for (const spec of t.build(ctx)) {
    const r = applyOp(project, { type: 'clip.addText', start: spec.start, duration: spec.duration, style: spec.style, trackId: textTrack });
    project = r.project;
    const id = r.created[0];
    if (id && (spec.x || spec.y)) project = applyOp(project, { type: 'clip.update', clipIds: [id], patch: { transform: { x: spec.x, y: spec.y } } }).project;
  }
  // Transições entre textos encostados (ex.: listas e slides).
  const texts = Object.values(project.clips)
    .filter((c) => c.trackId === textTrack)
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < texts.length; i++) {
    const a = texts[i - 1]!;
    const b = texts[i]!;
    if (a.start + a.duration === b.start && t.id !== 'reels-hook') {
      try {
        project = applyOp(project, { type: 'transition.add', fromClipId: a.id, toClipId: b.id, transition: 'dissolve', duration: f(0.5) }).project;
      } catch {
        /* clipes curtos: sem transição */
      }
    }
  }
  return { ...project, updatedAt: Date.now() };
}
