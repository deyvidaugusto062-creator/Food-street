/**
 * Gera public/og.jpg (1200×630, imagem de compartilhamento) a partir do hero.
 *   npm run dev   (em outro terminal)
 *   node scripts/render-og.mjs
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const DEV_URL = process.env.DEV_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(DEV_URL + '/', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.hero__ctas,.hero__facts,.hero__finishes,.hero__hint,.hero__scroll,.header__nav,.header__actions{display:none!important} .hero__layout{min-height:auto} .hero{min-height:630px}' });
await page.mouse.move(700, 315);
await page.waitForSelector('.hero__stage.is-ready', { timeout: 60_000 });
await page.waitForTimeout(3500);
const png = await page.screenshot();
await browser.close();
await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile('public/og.jpg');
console.log('✓ public/og.jpg');
