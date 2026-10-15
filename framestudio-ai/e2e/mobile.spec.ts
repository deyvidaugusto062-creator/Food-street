import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { FIX, editorState } from './helpers.ts';

test('editor mobile: criar projeto, adicionar mídia e texto pelo toque', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-project').tap();
  await page.getByRole('button', { name: /^9:16/ }).tap();
  await page.getByTestId('create-project').tap();
  await expect(page.getByTestId('mobile-editor')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('mobile-add-media').tap();
  await (await chooser).setFiles(join(FIX, 'vertical.webm'));
  await expect(page.locator('[data-testid="clip"][data-clip-type="video"]')).toHaveCount(1);
  await page.getByTestId('mtool-text').tap();
  await page.getByTestId('text-preset-title').tap();
  await expect(page.locator('[data-testid="clip"][data-clip-type="text"]')).toHaveCount(1);
  const size = await editorState<[number, number]>(page, 's => [s.project.settings.width, s.project.settings.height]');
  expect(size[1]).toBeGreaterThan(size[0]);
  // Botões da barra inferior com área de toque adequada (≥ 44 px).
  const box = (await page.getByTestId('mtool-edit').boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});
