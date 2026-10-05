/**
 * Gera as versões otimizadas (AVIF + WebP) das fotos de produtos.
 *
 *   npm run images
 *
 * Entrada:  assets-src/produtos/<nome>.jpg|png|webp
 * Saída:    public/images/produtos/<nome>.avif|webp
 *           public/images/produtos/<nome>-detalhe.avif|webp  (quando houver recorte em CROPS)
 *
 * Para fotos oficiais: coloque o arquivo original em assets-src/produtos/, rode o script e
 * aponte o caminho em src/data/products.ts (sem extensão, ex.: '/images/produtos/minha-foto').
 */
import { readdir, mkdir } from 'node:fs/promises';
import { extname, basename, join } from 'node:path';
import sharp from 'sharp';

const SRC = 'assets-src/produtos';
const OUT = 'public/images/produtos';
const MAX = 1200;

/** Recortes de detalhe (x, y, largura, altura) em pixels da imagem original. */
const CROPS = {
  'demo-01-redonda-azul': [170, 165, 230, 175],
  'demo-02-redonda-metal-preta': [125, 105, 240, 130],
  'demo-03-gatinho-sem-aro': [110, 115, 230, 150],
  'demo-04-quadrada-preta': [290, 40, 257, 270],
  'demo-05-retangular-cristal': [250, 120, 197, 190],
  'demo-06-redonda-metal-dourada': [115, 72, 185, 110],
  'demo-07-meio-aro-prata': [120, 150, 210, 160],
  'demo-08-retangular-preta-fosca': [180, 110, 220, 190],
};

/** Fotos de pessoas (sem ajuste de fundo). As demais são fotos de produto em fundo claro. */
const PHOTOS = new Set(['demo-02-redonda-metal-preta', 'demo-06-redonda-metal-dourada']);

async function write(pipeline, name) {
  await Promise.all([
    pipeline.clone().avif({ quality: 58, effort: 6 }).toFile(join(OUT, `${name}.avif`)),
    pipeline.clone().webp({ quality: 80, effort: 6 }).toFile(join(OUT, `${name}.webp`)),
  ]);
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

for (const file of files) {
  const name = basename(file, extname(file));
  let input = sharp(join(SRC, file)).rotate();
  // fundo quase branco → branco puro, para o produto "flutuar" no card (mix-blend-mode: multiply)
  if (!PHOTOS.has(name)) input = input.linear(255 / 238, 0);
  await write(input.clone().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true }), name);

  const crop = CROPS[name];
  if (crop) {
    const [left, top, width, height] = crop;
    await write(input.clone().extract({ left, top, width, height }), `${name}-detalhe`);
  }
  console.log('✓', name, crop ? '(+ detalhe)' : '');
}
