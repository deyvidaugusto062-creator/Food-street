/**
 * Página interna (somente `npm run dev`, fora do build) usada para gerar a imagem estática
 * do hero a partir da própria cena 3D: public/images/hero/armacao-3d.*
 * Uso: scripts/render-poster.mjs
 */
import { createRoot } from 'react-dom/client';
import HeroScene from '../three/HeroScene';
import type { FinishKey } from '../three/finishes';

const finish = (new URLSearchParams(location.search).get('acabamento') ?? 'verde') as FinishKey;

createRoot(document.getElementById('root')!).render(
  <HeroScene finish={finish} quality="full" active still onReady={() => setTimeout(() => (document.body.dataset.ready = '1'), 400)} />,
);
