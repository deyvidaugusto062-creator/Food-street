/**
 * Gera a imagem estática do hero (pôster) a partir da própria cena 3D.
 * Mostrada antes do 3D carregar, sem WebGL e com "reduzir movimento".
 *
 *   npm run dev            # em outro terminal
 *   npm run render:poster  # grava public/images/hero/armacao-3d.avif|webp
 *
 * Variáveis: DEV_URL (padrão http://localhost:5173), CHROMIUM_PATH.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const DEV_URL = process.env.DEV_URL ?? 'http://localhost:5173';
const OUT = 'public/images/hero';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.error('[página]', m.text()));
await page.goto(`${DEV_URL}/poster.html`);
await page.waitForSelector('body[data-ready="1"]', { timeout: 60_000 });
await page.waitForTimeout(800);
const png = await page.locator('#root').screenshot({ omitBackground: true });
await browser.close();

await mkdir(OUT, { recursive: true });
const img = sharp(png);
await img.clone().avif({ quality: 60, effort: 6 }).toFile(`${OUT}/armacao-3d.avif`);
await img.clone().webp({ quality: 82, effort: 6, alphaQuality: 90 }).toFile(`${OUT}/armacao-3d.webp`);
console.log('✓ pôster gerado em', OUT);
