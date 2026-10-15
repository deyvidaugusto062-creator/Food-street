import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { OUT, ffprobe, frameMean } from './helpers.ts';

for (const [file, name, w, h, dur] of [
  ['horizontal-transicao.fstudio', 'Exemplo — Vídeo horizontal', 854, 480, 7],
  ['reels-legendas.fstudio', 'Exemplo — Reels com legendas', 480, 854, 6],
] as const) {
  test(`exemplo ${file}: importa, abre e exporta`, async ({ page }) => {
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar projeto' }).click();
    await (await chooser).setFiles(join(process.cwd(), 'examples', file));
    await expect(page.getByText(`Projeto "${name}" importado`)).toBeVisible();
    await page.getByTestId('project-card').filter({ hasText: name }).getByRole('button', { name: /Abrir/ }).click();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.getByText('Mídias ausentes')).toHaveCount(0);
    await page.getByTestId('open-export').click();
    await expect(page.getByTestId('export-start')).toBeEnabled();
    await page.getByRole('combobox', { name: 'Formato' }).click();
    await page.getByRole('option', { name: 'WEBM' }).click();
    await page.getByRole('combobox', { name: 'Resolução' }).click();
    await page.getByRole('option', { name: '480p' }).click();
    const dl = page.waitForEvent('download', { timeout: 170_000 });
    await page.getByTestId('export-start').click();
    const out = join(OUT, file.replace('.fstudio', '.webm'));
    await (await dl).saveAs(out);
    const probe = ffprobe(out);
    const v = probe.streams.find((s) => s.codec_type === 'video')!;
    expect([v.width, v.height]).toEqual([w, h]);
    expect(parseFloat(probe.format.duration)).toBeCloseTo(dur, 0);
    expect(probe.streams.some((s) => s.codec_type === 'audio')).toBe(true);
    expect(frameMean(out, dur / 2).reduce((a, b) => a + b) / 3).toBeGreaterThan(30);
  });
}
