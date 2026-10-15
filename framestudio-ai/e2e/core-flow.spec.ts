import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { OUT, audioMeanDb, editorState, ffmpegDecodeErrors, ffprobe, frameMean, importMedia, newProject } from './helpers.ts';

test('fluxo essencial: importar → visualizar → cortar → texto → áudio → salvar → reabrir → exportar', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await newProject(page, 'Fluxo E2E');

  // 1. Importação real (metadados lidos do arquivo).
  await importMedia(page, ['clip-a.webm', 'music.wav']);
  await expect(page.getByTestId('asset-card')).toHaveCount(2);
  const assets = await editorState<{ name: string; duration: number; width?: number; hasAudio: boolean; videoCodec?: string }[]>(page, 's => Object.values(s.project.assets)');
  const video = assets.find((a) => a.name === 'clip-a.webm')!;
  expect(video.duration).toBeGreaterThan(3.9);
  expect(video.duration).toBeLessThan(4.1);
  expect(video.width).toBe(640);
  expect(video.hasAudio).toBe(true);
  expect(video.videoCodec).toMatch(/vp09|vp9/);

  // 2. Adiciona o vídeo à timeline e verifica o preview.
  await page.locator('[data-testid="asset-card"][data-asset-kind="video"]').hover();
  await page.locator('[data-testid="asset-card"][data-asset-kind="video"] [data-testid="asset-add"]').click();
  await expect(page.locator('[data-testid="clip"][data-clip-type="video"]')).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() => {
    const c = document.querySelector('[data-testid="preview-canvas"]') as HTMLCanvasElement;
    const g = document.createElement('canvas');
    g.width = 32; g.height = 18;
    const x = g.getContext('2d')!;
    x.drawImage(c, 0, 0, 32, 18);
    const d = x.getImageData(0, 0, 32, 18).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i]! + d[i + 1]! + d[i + 2]!;
    return sum / (d.length / 4);
  })).toBeGreaterThan(60);

  // 3. Corte: posiciona o playhead em 3 s pela régua e divide; remove a parte final.
  const ruler = page.getByTestId('ruler');
  const rb = (await ruler.boundingBox())!;
  const pps = await editorState<number>(page, 's => s.pxPerSecond');
  await page.mouse.click(rb.x + 3 * pps, rb.y + rb.height / 2);
  await expect.poll(() => editorState<number>(page, 's => s.playhead')).toBe(90);
  await page.locator('[data-testid="clip"][data-clip-type="video"]').click({ position: { x: 20, y: 30 } });
  await page.keyboard.press('s');
  await expect(page.locator('[data-testid="clip"][data-clip-type="video"]')).toHaveCount(2);
  const parts = await editorState<{ id: string; start: number; duration: number; sourceIn: number }[]>(page, 's => Object.values(s.project.clips).filter(c => c.type === "video").sort((a,b)=>a.start-b.start)');
  expect(parts.map((p) => [p.start, p.duration])).toEqual([[0, 90], [90, 30]]);
  expect(parts[1]!.sourceIn).toBeCloseTo(3, 2);
  await page.locator(`[data-clip-id="${parts[1]!.id}"]`).click({ position: { x: 10, y: 30 } });
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-testid="clip"][data-clip-type="video"]')).toHaveCount(1);

  // 4. Texto no início.
  await page.mouse.click(rb.x + 2, rb.y + rb.height / 2);
  await page.getByRole('tab', { name: 'Texto' }).first().click();
  await page.getByTestId('text-preset-title').click();
  await expect(page.locator('[data-testid="clip"][data-clip-type="text"]')).toHaveCount(1);
  const content = page.getByTestId('text-content');
  await content.fill('Olá FrameStudio');
  await content.blur();
  await expect.poll(() => editorState<string>(page, 's => Object.values(s.project.clips).find(c => c.type === "text").text.content')).toBe('Olá FrameStudio');
  // Apara o texto arrastando a borda final até o fim do vídeo (3 s), com snap magnético.
  const textClip = page.locator('[data-testid="clip"][data-clip-type="text"]');
  const handle = textClip.getByTestId('trim-end');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + 3 * pps + 3, hb.y + hb.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => editorState<number>(page, 's => { const t = Object.values(s.project.clips).find(c => c.type === "text"); return t.start + t.duration; }')).toBe(90);

  // 5. Áudio: música na faixa de áudio, com volume reduzido.
  await page.getByRole('tab', { name: 'Mídia' }).first().click();
  await page.locator('[data-testid="asset-card"][data-asset-kind="audio"]').hover();
  await page.locator('[data-testid="asset-card"][data-asset-kind="audio"] [data-testid="asset-add"]').click();
  await expect(page.locator('[data-testid="clip"][data-clip-type="audio"]')).toHaveCount(1);
  const audioClipId = await editorState<string>(page, 's => Object.values(s.project.clips).find(c => c.type === "audio").id');
  // Limita a música aos 3 s do vídeo.
  await page.evaluate((id) => {
    const s = (window as unknown as { __framestudio: { editor: { getState(): { dispatch(op: unknown): unknown } } } }).__framestudio.editor.getState();
    s.dispatch({ type: 'clip.trim', clipId: id, edge: 'end', frame: 90 });
    s.dispatch({ type: 'clip.update', clipIds: [id], patch: { audio: { volume: 0.5, fadeOut: 0.5 } } });
  }, audioClipId);

  // 6. Salvar e reabrir (persistência real no IndexedDB/OPFS).
  await page.getByTestId('save-project').click();
  await expect(page.getByTestId('save-status')).toContainText('Salvo');
  const projectId = await editorState<string>(page, 's => s.project.id');
  await page.reload();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.locator('[data-testid="clip"]')).toHaveCount(3);
  const reopened = await editorState<{ id: string; clips: number; name: string }>(page, 's => ({ id: s.project.id, clips: Object.keys(s.project.clips).length, name: s.project.name })');
  expect(reopened).toEqual({ id: projectId, clips: 3, name: 'Fluxo E2E' });

  // 7. Exportação real.
  await page.getByTestId('open-export').click();
  await expect(page.getByTestId('export-start')).toBeEnabled();
  await page.getByTestId('export-name').fill('fluxo-e2e');
  const fmt = await page.getByRole('combobox', { name: 'Formato' }).textContent();
  const downloadP = page.waitForEvent('download', { timeout: 150_000 });
  await page.getByTestId('export-start').click();
  await expect(page.getByTestId('export-progress')).toBeVisible();
  const download = await downloadP;
  await expect(page.getByTestId('export-done')).toBeVisible();
  const ext = (fmt ?? 'mp4').trim().toLowerCase();
  const file = join(OUT, `fluxo-e2e.${ext}`);
  await download.saveAs(file);

  // 8. Verificação independente com FFprobe/FFmpeg.
  const probe = ffprobe(file);
  const v = probe.streams.find((s) => s.codec_type === 'video')!;
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  expect(v.width).toBe(1920);
  expect(v.height).toBe(1080);
  expect(a, 'arquivo exportado precisa ter áudio').toBeTruthy();
  expect(a!.channels).toBe(2);
  expect(parseFloat(probe.format.duration)).toBeGreaterThan(2.9);
  expect(parseFloat(probe.format.duration)).toBeLessThan(3.2);
  expect(ffmpegDecodeErrors(file)).toBe('');
  // Quadro com conteúdo (não preto) e áudio audível.
  const mean = frameMean(file, 1.5);
  expect(mean.reduce((x, y) => x + y, 0) / 3).toBeGreaterThan(40);
  expect(audioMeanDb(file, 0.5, 1.5)).toBeGreaterThan(-40);
  console.log('Exportado:', file, probe.format.format_name, v.codec_name, a!.codec_name, probe.format.duration);
  expect(errors).toEqual([]);
});
