import { expect, test } from '@playwright/test';
import { importMedia, newProject } from './helpers.ts';

// Gera capturas para documentação/revisão visual (não faz asserções de pixel).
test.use({ colorScheme: 'dark' });

test('capturas: home e editor desktop', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await newProject(page, 'Demonstração');
  await importMedia(page, ['clip-a.webm', 'clip-b.webm', 'music.wav', 'photo.png']);
  await expect(page.getByTestId('asset-card')).toHaveCount(4);
  await page.evaluate(() => {
    const s = (window as unknown as { __framestudio: { editor: { getState(): { project: { assets: Record<string, { id: string; name: string }> }; dispatch(op: unknown): { created: string[] } | null } } } }).__framestudio.editor.getState();
    const ids = Object.fromEntries(Object.values(s.project.assets).map((a) => [a.name, a.id]));
    const a = s.dispatch({ type: 'clip.addAsset', assetId: ids['clip-a.webm'], start: 0 })!.created[0];
    const b = s.dispatch({ type: 'clip.addAsset', assetId: ids['clip-b.webm'], start: 120 })!.created[0];
    s.dispatch({ type: 'transition.add', fromClipId: a, toClipId: b, transition: 'dissolve', duration: 20 });
    s.dispatch({ type: 'clip.addAsset', assetId: ids['music.wav'], start: 0 });
    const t = s.dispatch({ type: 'clip.addText', start: 15, duration: 120, style: { content: 'FrameStudio AI', fontSize: 120, animationIn: 'pop' } })!.created[0];
    s.dispatch({ type: 'keyframe.set', clipId: t, prop: 'y', frame: 0, value: -200 });
    s.dispatch({ type: 'keyframe.set', clipId: t, prop: 'y', frame: 60, value: 0 });
    s.dispatch({ type: 'marker.add', frame: 90, label: 'Gancho' });
  });
  const ruler = (await page.getByTestId('ruler').boundingBox())!;
  await page.mouse.click(ruler.x + 2.2 * 80, ruler.y + 10);
  await page.locator('[data-testid="clip"][data-clip-type="text"]').click({ position: { x: 40, y: 30 } });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshots/editor-desktop.png' });
  await page.getByRole('tab', { name: 'Cor' }).click();
  await page.locator('[data-testid="clip"][data-clip-type="video"]').first().click({ position: { x: 40, y: 30 } });
  await page.getByRole('tab', { name: 'Cor' }).click();
  await page.getByRole('tab', { name: 'AI Studio' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshots/editor-ai-color.png' });
  await page.getByTestId('save-project').click();
  await page.getByTestId('back-home').click();
  await expect(page.getByTestId('project-card').first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/home.png' });
});

test('capturas: editor mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('/');
  await page.screenshot({ path: 'docs/screenshots/mobile-home.png' });
  await page.getByTestId('new-project').tap();
  await page.getByRole('button', { name: /^9:16/ }).tap();
  await page.getByTestId('create-project').tap();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('mobile-add-media').tap();
  await (await chooser).setFiles(['tests/fixtures/vertical.webm', 'tests/fixtures/music.wav']);
  await expect(page.locator('[data-testid="clip"]')).toHaveCount(2);
  await page.getByTestId('mtool-text').tap();
  await page.getByTestId('text-preset-impact').tap();
  await page.getByTestId('mtool-text').tap();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/mobile-editor.png' });
  await page.getByTestId('mtool-filters').tap();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/screenshots/mobile-sheet.png' });
});
