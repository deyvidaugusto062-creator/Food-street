import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { OUT, editorState, ffmpegDecodeErrors, ffprobe, frameMean, importMedia, newProject } from './helpers.ts';

async function dispatch(page: Page, op: unknown) {
  return page.evaluate((o) => {
    const s = (window as unknown as { __framestudio: { editor: { getState(): { dispatch(op: unknown): { created: string[] } | null } } } }).__framestudio.editor.getState();
    return s.dispatch(o)?.created ?? null;
  }, op);
}

async function exportAs(page: Page, name: string, height: string): Promise<string> {
  await page.getByTestId('open-export').click();
  await expect(page.getByTestId('export-start')).toBeEnabled();
  await page.getByTestId('export-name').fill(name);
  await page.getByRole('combobox', { name: 'Formato' }).click();
  await page.getByRole('option', { name: 'WEBM' }).click();
  await page.getByRole('combobox', { name: 'Resolução' }).click();
  await page.getByRole('option', { name: height }).click();
  const dl = page.waitForEvent('download', { timeout: 170_000 });
  await page.getByTestId('export-start').click();
  const d = await dl;
  const file = join(OUT, `${name}.webm`);
  await d.saveAs(file);
  await expect(page.getByTestId('export-done')).toBeVisible();
  await page.keyboard.press('Escape');
  return file;
}

test('transição, efeitos, cor, keyframes e velocidade aparecem no arquivo exportado', async ({ page }) => {
  await newProject(page, 'Avançado');
  await importMedia(page, ['clip-a.webm', 'clip-b.webm']);
  await expect(page.getByTestId('asset-card')).toHaveCount(2);
  const ids = await editorState<Record<string, string>>(page, 's => Object.fromEntries(Object.values(s.project.assets).map(a => [a.name, a.id]))');
  const [a] = (await dispatch(page, { type: 'clip.addAsset', assetId: ids['clip-a.webm'], start: 0 }))!;
  const [b] = (await dispatch(page, { type: 'clip.addAsset', assetId: ids['clip-b.webm'], start: 120 }))!;

  // Transição pela interface: seleciona A e clica em "Dissolver".
  await page.locator(`[data-clip-id="${a}"]`).click({ position: { x: 30, y: 30 } });
  await page.getByRole('tab', { name: 'Transições' }).click();
  await page.getByTestId('transition-dissolve').click();
  await expect(page.getByTestId('transition-chip')).toHaveCount(1);

  // Efeito preto e branco em B pela biblioteca.
  await page.locator(`[data-clip-id="${b}"]`).click({ position: { x: 30, y: 30 } });
  await page.getByRole('tab', { name: 'Efeitos' }).first().click();
  await page.getByTestId('effect-grayscale').click();
  await expect.poll(() => editorState<number>(page, `s => s.project.clips['${b}'].effects.length`)).toBe(1);

  // Velocidade 2x em B pelas propriedades.
  await page.getByRole('tab', { name: 'Básico' }).click();
  await page.getByTestId('speed-2').click();
  await expect.poll(() => editorState<number>(page, `s => s.project.clips['${b}'].duration`)).toBe(45);

  // Keyframes de opacidade em A (0 → 1 em 0,5 s) e saturação extra.
  await dispatch(page, { type: 'keyframe.set', clipId: a, prop: 'opacity', frame: 0, value: 0, easing: 'linear' });
  await dispatch(page, { type: 'keyframe.set', clipId: a, prop: 'opacity', frame: 15, value: 1, easing: 'linear' });
  await dispatch(page, { type: 'clip.update', clipIds: [a], patch: { color: { saturation: 0.5 } } });

  // Desfazer/refazer pelo teclado.
  await page.locator('[data-testid="preview-overlay"]').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  await expect.poll(() => editorState<number>(page, `s => s.project.clips['${a}'].color.saturation`)).toBe(0);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => editorState<number>(page, `s => s.project.clips['${a}'].color.saturation`)).toBe(0.5);

  const file = await exportAs(page, 'avancado', '480p');
  const probe = ffprobe(file);
  const v = probe.streams.find((s) => s.codec_type === 'video')!;
  expect(v.codec_name).toMatch(/vp9|av1|vp8/);
  expect(v.height).toBe(480);
  expect(v.width).toBe(854);
  expect(parseFloat(probe.format.duration)).toBeCloseTo(5.5, 1);
  expect(ffmpegDecodeErrors(file)).toBe('');
  // t=0: opacidade 0 → quadro escuro (fundo preto).
  const f0 = frameMean(file, 0);
  expect(f0.reduce((x, y) => x + y) / 3).toBeLessThan(25);
  // t=2: A visível.
  const f2 = frameMean(file, 2);
  expect(f2.reduce((x, y) => x + y) / 3).toBeGreaterThan(60);
  // t=5: B em preto e branco → canais quase iguais.
  const f5 = frameMean(file, 5);
  expect(Math.max(...f5) - Math.min(...f5)).toBeLessThan(6);
  expect(f5[0]).toBeGreaterThan(40);
});

test('cancelar a exportação interrompe sem gerar arquivo', async ({ page }) => {
  await newProject(page, 'Cancelar');
  await importMedia(page, ['clip-a.webm']);
  await expect(page.getByTestId('asset-card')).toHaveCount(1);
  const id = await editorState<string>(page, 's => Object.keys(s.project.assets)[0]');
  // 4 cópias = 16 s em 1080p: tempo suficiente para cancelar.
  for (let i = 0; i < 4; i++) await dispatch(page, { type: 'clip.addAsset', assetId: id, start: i * 120 });
  await page.getByTestId('open-export').click();
  await expect(page.getByTestId('export-start')).toBeEnabled();
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.getByTestId('export-start').click();
  await expect(page.getByTestId('export-progress')).toBeVisible();
  await expect.poll(async () => Number((await page.getByTestId('export-progress').textContent())?.match(/(\d+)%/)?.[1] ?? 0)).toBeGreaterThan(3);
  await page.getByTestId('export-cancel').click();
  await expect(page.getByTestId('export-start')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test('erros de importação são claros e não quebram o editor', async ({ page }) => {
  await newProject(page, 'Erros');
  await importMedia(page, ['corrupted.mp4']);
  await expect(page.getByText('Não foi possível importar corrupted.mp4')).toBeVisible();
  const h264 = await page.evaluate(async () => (await VideoDecoder.isConfigSupported({ codec: 'avc1.42001f' })).supported || document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"') !== '');
  await importMedia(page, ['clip-h264.mp4']);
  if (h264) await expect(page.locator('[data-testid="asset-card"]')).toHaveCount(1);
  else await expect(page.getByText(/codec de vídeo .* não é suportado/)).toBeVisible();
  await importMedia(page, ['photo.png', 'vertical.webm']);
  await expect(page.locator('[data-testid="asset-card"][data-asset-kind="image"]')).toHaveCount(1);
  const vertical = await editorState<{ width: number; height: number; hasAudio: boolean }>(page, 's => Object.values(s.project.assets).find(a => a.name === "vertical.webm")');
  expect(vertical).toMatchObject({ width: 360, height: 640, hasAudio: false });
});

test('.fstudio: empacotar com mídias, excluir e reimportar', async ({ page }) => {
  await newProject(page, 'Pacote');
  await importMedia(page, ['clip-b.webm']);
  await expect(page.getByTestId('asset-card')).toHaveCount(1);
  const id = await editorState<string>(page, 's => Object.keys(s.project.assets)[0]');
  await dispatch(page, { type: 'clip.addAsset', assetId: id, start: 0 });
  await dispatch(page, { type: 'clip.addText', start: 0, duration: 60, style: { content: 'Pacote' } });
  await page.getByTestId('save-project').click();
  await page.getByTestId('back-home').click();
  const card = page.getByTestId('project-card').filter({ hasText: 'Pacote' });
  await card.getByRole('button', { name: 'Mais ações' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Empacotar com mídias' }).click();
  const file = join(OUT, 'pacote.fstudio');
  await (await dl).saveAs(file);
  await card.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: 'Excluir' }).click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByTestId('project-card').filter({ hasText: 'Pacote' })).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar projeto' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText('Projeto "Pacote" importado')).toBeVisible();
  await page.getByTestId('project-card').filter({ hasText: 'Pacote' }).getByRole('button', { name: /Abrir/ }).click();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.locator('[data-testid="clip"]')).toHaveCount(2);
  await expect(page.getByText('Mídias ausentes')).toHaveCount(0);
});
