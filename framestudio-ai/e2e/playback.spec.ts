import { expect, test } from '@playwright/test';
import { editorState, importMedia, newProject } from './helpers.ts';

test('preview: reprodução avança o playhead em tempo real e pausa', async ({ page }) => {
  await newProject(page, 'Reprodução');
  await importMedia(page, ['clip-a.webm']);
  await page.locator('[data-testid="asset-card"]').hover();
  await page.locator('[data-testid="asset-add"]').click();
  await expect(page.locator('[data-testid="clip"]')).toHaveCount(1);
  await page.getByTestId('play-toggle').click();
  await expect.poll(() => editorState<boolean>(page, 's => s.playing')).toBe(true);
  const t0 = Date.now();
  await page.waitForTimeout(1500);
  const f = await editorState<number>(page, 's => s.playhead');
  const elapsed = (Date.now() - t0) / 1000;
  // ~30 quadros/s de timeline (tolerância para o tempo de preparação do áudio).
  expect(f).toBeGreaterThan(15);
  expect(f).toBeLessThan(30 * elapsed + 10);
  await page.keyboard.press('Space');
  await expect.poll(() => editorState<boolean>(page, 's => s.playing')).toBe(false);
  const paused = await editorState<number>(page, 's => s.playhead');
  await page.waitForTimeout(500);
  expect(await editorState<number>(page, 's => s.playhead')).toBe(paused);
  // Ao chegar ao fim, a reprodução para sozinha.
  await page.keyboard.press('Space');
  await expect.poll(() => editorState<boolean>(page, 's => s.playing'), { timeout: 10_000 }).toBe(false);
  expect(await editorState<number>(page, 's => s.playhead')).toBe(120);
});
