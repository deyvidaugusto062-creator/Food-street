import { hours, TIMEZONE, type DayHours } from '../data/hours';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Dia da semana (0–6) e minutos desde 00:00 no fuso de São Paulo */
export function nowInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export const hoursFor = (day: number): DayHours | undefined => hours.find((h) => h.day === day);

export interface OpenStatus {
  open: boolean;
  closesAt?: string;
  nextOpen?: { label: string; at: string; today: boolean; tomorrow: boolean };
}

export function getOpenStatus(date = new Date()): OpenStatus {
  const { weekday, minutes } = nowInSaoPaulo(date);
  const today = hoursFor(weekday);

  if (today?.open && today.close) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    if (minutes >= o && minutes < c) return { open: true, closesAt: today.close };
    if (minutes < o) return { open: false, nextOpen: { label: today.label, at: today.open, today: true, tomorrow: false } };
  }

  for (let i = 1; i <= 7; i++) {
    const next = hoursFor((weekday + i) % 7);
    if (next?.open) return { open: false, nextOpen: { label: next.label, at: next.open, today: false, tomorrow: i === 1 } };
  }
  return { open: false };
}
