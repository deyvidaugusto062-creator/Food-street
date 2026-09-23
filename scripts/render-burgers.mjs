/**
 * Gera as ilustrações 3D dos burgers (cards e fallback do hero).
 *
 *   npm run render:burgers            → todos os burgers de src/data/stacks.ts
 *   npm run render:burgers -- augustas → só um
 *
 * Usa o Chromium do Playwright. Defina CHROMIUM_PATH se ele estiver em outro lugar.
 * Saída: public/images/burgers/renders/<id>-{600,1000}.webp
 */
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public/images/burgers/renders');
const SIZE = 1000;

const stacksSource = await readFile(path.join(root, 'src/data/stacks.ts'), 'utf8');
const allIds = [...stacksSource.matchAll(/^\s{2}'?([a-z0-9-]+)'?: \{/gm)].map((m) => m[1]);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : allIds;

await mkdir(outDir, { recursive: true });

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
    await page.goto(`${base}render.html?id=${id}&size=${SIZE}`);
    await page.waitForFunction(() => window.__RENDER_READY__ === true, null, { timeout: 120_000 });
    const png = await page.locator('canvas').screenshot({ omitBackground: true });
    for (const width of [600, 1000]) {
      await sharp(png)
        .resize(width)
        .webp({ quality: 84, alphaQuality: 90, effort: 6 })
        .toFile(path.join(outDir, `${id}-${width}.webp`));
    }
    console.log(`✓ ${id}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
