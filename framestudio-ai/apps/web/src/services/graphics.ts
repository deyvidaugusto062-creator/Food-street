/**
 * Elementos gráficos gerados localmente (sem arquivos de terceiros): formas vetoriais rasterizadas
 * em PNG com transparência e adicionadas como mídia de imagem do projeto.
 */
import { createId, type MediaAsset } from '@framestudio/shared';
import { repo } from './repo.ts';

export interface GraphicDef {
  id: string;
  label: string;
  width: number;
  height: number;
  draw: (g: OffscreenCanvasRenderingContext2D, w: number, h: number, color: string) => void;
}

const rr = (g: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

export const GRAPHICS: GraphicDef[] = [
  { id: 'rect', label: 'Retângulo', width: 800, height: 450, draw: (g, w, h, c) => (rr(g, 0, 0, w, h, 0), (g.fillStyle = c), g.fill()) },
  { id: 'rounded', label: 'Cartão', width: 800, height: 450, draw: (g, w, h, c) => (rr(g, 8, 8, w - 16, h - 16, 48), (g.fillStyle = c), g.fill()) },
  { id: 'circle', label: 'Círculo', width: 600, height: 600, draw: (g, w, h, c) => (g.beginPath(), g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2), (g.fillStyle = c), g.fill()) },
  {
    id: 'ring',
    label: 'Anel',
    width: 600,
    height: 600,
    draw: (g, w, h, c) => {
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 24, 0, Math.PI * 2);
      g.lineWidth = 40;
      g.strokeStyle = c;
      g.stroke();
    },
  },
  { id: 'bar', label: 'Barra', width: 1600, height: 120, draw: (g, w, h, c) => (rr(g, 0, 0, w, h, h / 2), (g.fillStyle = c), g.fill()) },
  {
    id: 'arrow',
    label: 'Seta',
    width: 800,
    height: 400,
    draw: (g, w, h, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, h * 0.35);
      g.lineTo(w * 0.6, h * 0.35);
      g.lineTo(w * 0.6, 0);
      g.lineTo(w, h / 2);
      g.lineTo(w * 0.6, h);
      g.lineTo(w * 0.6, h * 0.65);
      g.lineTo(0, h * 0.65);
      g.closePath();
      g.fill();
    },
  },
  {
    id: 'star',
    label: 'Estrela',
    width: 600,
    height: 600,
    draw: (g, w, h, c) => {
      g.fillStyle = c;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? w * 0.2 : w * 0.48;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a));
      }
      g.closePath();
      g.fill();
    },
  },
  {
    id: 'gradient',
    label: 'Degradê',
    width: 1080,
    height: 600,
    draw: (g, w, h, c) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, c);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    },
  },
];

export async function createGraphicAsset(def: GraphicDef, color: string): Promise<MediaAsset> {
  const c = new OffscreenCanvas(def.width, def.height);
  const g = c.getContext('2d')!;
  def.draw(g, def.width, def.height, color);
  const blob = await c.convertToBlob({ type: 'image/png' });
  const id = createId('ast_');
  const asset: MediaAsset = {
    id,
    name: `${def.label}.png`,
    kind: 'image',
    mimeType: 'image/png',
    size: blob.size,
    storageKey: `media_${id}`,
    duration: 0,
    width: def.width,
    height: def.height,
    hasVideo: true,
    hasAudio: false,
    fingerprint: `graphic:${def.id}:${id}`,
    createdAt: Date.now(),
  };
  await repo.putMedia(asset.storageKey, blob);
  return asset;
}
