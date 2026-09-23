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

export function hoursFor(day: number): DayHours | undefined {
  return hours.find((h) => h.day === day);
}

export interface OpenStatus {
  open: boolean;
  /** Horário de fechamento do turno atual */
  closesAt?: string;
  /** Próxima abertura, quando fechado */
  nextOpen?: { label: string; at: string; today: boolean };
}

/** Calcula se a casa está aberta, considerando turnos que passam da meia-noite. */
export function getOpenStatus(date = new Date()): OpenStatus {
  const { weekday, minutes } = nowInSaoPaulo(date);
  const today = hoursFor(weekday);
  const yesterday = hoursFor((weekday + 6) % 7);

  // turno de ontem que ainda não acabou (ex.: sexta 16:00 – 05:00)
  if (yesterday?.open && yesterday.close) {
    const o = toMinutes(yesterday.open);
    const c = toMinutes(yesterday.close);
    if (c <= o && minutes < c) return { open: true, closesAt: yesterday.close };
  }

  if (today?.open && today.close) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    const overnight = c <= o;
    if (minutes >= o && (overnight || minutes < c)) return { open: true, closesAt: today.close };
    if (minutes < o) return { open: false, nextOpen: { label: today.label, at: today.open, today: true } };
  }

  for (let i = 1; i <= 7; i++) {
    const next = hoursFor((weekday + i) % 7);
    if (next?.open) return { open: false, nextOpen: { label: next.label, at: next.open, today: false } };
  }
  return { open: false };
}
