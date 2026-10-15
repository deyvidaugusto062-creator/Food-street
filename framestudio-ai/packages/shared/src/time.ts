/** Conversões entre frames, segundos e timecode. */

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export function secondsToFrames(seconds: number, fps: number): number {
  // Arredonda com tolerância para evitar 2.9999999 → 2.
  return Math.round(seconds * fps + 1e-9);
}

export function floorFrames(seconds: number, fps: number): number {
  return Math.floor(seconds * fps + 1e-6);
}

/** HH:MM:SS:FF */
export function formatTimecode(frame: number, fps: number): string {
  const f = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(f / fps);
  const ff = f - totalSeconds * fps;
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(Math.round(ff))}`;
}

/** M:SS.s — formato curto para a interface. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** SRT: 00:00:01,000 */
export function formatSrtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** VTT: 00:00:01.000 */
export function formatVttTime(seconds: number): string {
  return formatSrtTime(seconds).replace(',', '.');
}

/** Interpreta "1:23", "83", "00:01:23:12" (com fps) ou "1.5s". Retorna segundos ou null. */
export function parseTime(input: string, fps = 30): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  if (/^\d+(\.\d+)?s?$/.test(s)) return parseFloat(s);
  const parts = s.split(':');
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.length === 2) return n[0]! * 60 + n[1]!;
  if (n.length === 3) return n[0]! * 3600 + n[1]! * 60 + n[2]!;
  if (n.length === 4) return n[0]! * 3600 + n[1]! * 60 + n[2]! + n[3]! / fps;
  return null;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
