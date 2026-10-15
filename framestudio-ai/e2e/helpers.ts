import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export const FIX = join(process.cwd(), 'tests/fixtures');
export const OUT = join(process.cwd(), 'tests/out');

export interface ProbeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
}
export interface Probe {
  streams: ProbeStream[];
  format: { duration: string; format_name: string; size: string };
}

export function ffprobe(file: string): Probe {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' }));
}

/** Decodifica o arquivo inteiro com FFmpeg: falha se houver erros de stream. */
export function ffmpegDecodeErrors(file: string): string {
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return '';
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

/** Cor média de um quadro (para checar conteúdo renderizado). */
export function frameMean(file: string, t: number): number[] {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=16:9', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
  const sum = [0, 0, 0];
  for (let i = 0; i < buf.length; i += 3) for (let c = 0; c < 3; c++) sum[c]! += buf[i + c]!;
  return sum.map((s) => s / (buf.length / 3));
}

/** Volume médio (dBFS) de um trecho de áudio, via filtro volumedetect do FFmpeg. */
export function audioMeanDb(file: string, from: number, dur: number): number {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-ss', String(from), '-t', String(dur), '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(r.stderr);
  if (!m) return NaN;
  return m[1] === '-inf' ? -Infinity : parseFloat(m[1]!);
}

export async function editorState<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(`(() => { const s = window.__framestudio.editor.getState(); return (${fn})(s); })()`) as Promise<T>;
}

export async function newProject(page: Page, name: string, preset = '16:9'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('new-project').click();
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByRole('button', { name: new RegExp(`^${preset.replace(':', '\\:')}`) }).first().click();
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('editor')).toBeVisible();
}

export async function importMedia(page: Page, files: string[]): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-media').click();
  await (await chooser).setFiles(files.map((f) => join(FIX, f)));
}
