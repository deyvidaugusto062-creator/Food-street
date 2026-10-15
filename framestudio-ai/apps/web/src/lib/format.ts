export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 2 ? 1 : 0)} ${u[i]}`;
}

export function formatRelative(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'agora';
  if (d < 3600) return `há ${Math.floor(d / 60)} min`;
  if (d < 86400) return `há ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 7) return `há ${Math.floor(d / 86400)} d`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

export function aspectLabel(w: number, h: number): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const k = g(w, h);
  const a = `${w / k}:${h / k}`;
  const known: Record<string, string> = { '16:9': '16:9', '9:16': '9:16', '1:1': '1:1', '4:5': '4:5', '64:27': '21:9', '256:135': '17:9' };
  return known[a] ?? (w / h).toFixed(2);
}
