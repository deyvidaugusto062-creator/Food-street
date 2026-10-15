import { expect, test } from '@playwright/test';
import { editorState, importMedia, newProject } from './helpers.ts';

test('AI Studio: assistente, remoção de silêncios, sugestões e consentimento do modelo', async ({ page }) => {
  await newProject(page, 'IA');
  await importMedia(page, ['speech.wav', 'clip-a.webm']);
  await expect(page.getByTestId('asset-card')).toHaveCount(2);
  // Narração (6 s) na faixa de áudio + vídeo (4 s).
  for (const kind of ['audio', 'video']) {
    await page.locator(`[data-testid="asset-card"][data-asset-kind="${kind}"]`).hover();
    await page.locator(`[data-testid="asset-card"][data-asset-kind="${kind}"] [data-testid="asset-add"]`).click();
  }
  await expect(page.locator('[data-testid="clip"]')).toHaveCount(2);
  const dur0 = await editorState<number>(page, 's => Math.max(...Object.values(s.project.clips).map(c => c.start + c.duration))');
  expect(dur0).toBe(180);

  await page.getByRole('tab', { name: 'AI Studio' }).click();

  // Assistente: comando em linguagem natural → prévia → confirmação.
  await page.getByTestId('ai-command').fill('Corte os primeiros 0,5 segundos');
  await page.getByTestId('ai-run').click();
  await expect(page.getByTestId('ai-plan')).toContainText('Remover os primeiros 0.50 s');
  await page.getByTestId('ai-apply').click();
  await page.getByTestId('ai-confirm').click();
  await expect.poll(() => editorState<number>(page, 's => Math.max(...Object.values(s.project.clips).map(c => c.start + c.duration))')).toBe(165);

  // Remoção de silêncios na narração (selecionada).
  const audioId = await editorState<string>(page, 's => Object.values(s.project.clips).find(c => c.type === "audio").id');
  await page.locator(`[data-clip-id="${audioId}"]`).click({ position: { x: 20, y: 20 } });
  await page.getByText('Remover silêncios').click();
  await page.getByTestId('ai-silence-analyze').click();
  await expect(page.getByTestId('ai-silence-result')).toContainText('2 silêncio(s)');
  await page.getByTestId('ai-silence-apply').click();
  const dur2 = await editorState<number>(page, 's => Math.max(...Object.values(s.project.clips).map(c => c.start + c.duration))');
  // Silêncios de 1,5 s e 1,5 s (menos margens) removidos.
  expect(dur2).toBeLessThan(165 - 60);
  expect(dur2).toBeGreaterThan(165 - 95);
  // Desfazer volta tudo.
  await page.getByRole('button', { name: /Desfazer/ }).first().click();
  await expect.poll(() => editorState<number>(page, 's => Math.max(...Object.values(s.project.clips).map(c => c.start + c.duration))')).toBe(165);

  // Sugestões de melhoria.
  await page.getByText('Sugestões de melhoria').click();
  await page.getByTestId('ai-suggest').click();
  await expect(page.getByText(/espaço|Música|fade|planos?|Nada a sugerir/).first()).toBeVisible();

  // Legendas: o modelo não está em cache → pede consentimento com tamanho do download.
  await page.getByTestId('ai-captions').click();
  await expect(page.getByText('Baixar modelo de transcrição?')).toBeVisible();
  await expect(page.getByText(/Tamanho do download/)).toBeVisible();
  await page.getByRole('button', { name: 'Agora não' }).click();
});
