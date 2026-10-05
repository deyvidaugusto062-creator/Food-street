/**
 * Horário de funcionamento.
 *
 * ⚠️ OBSERVAÇÃO INTERNA: horários informados no briefing — validar com o responsável
 * antes da publicação definitiva (inclusive feriados).
 */
export const TIMEZONE = 'America/Sao_Paulo';

export interface DayHours {
  /** 0 = domingo … 6 = sábado (igual a Date.getDay) */
  day: number;
  label: string;
  short: string;
  open: string | null;
  close: string | null;
}

export const hours: DayHours[] = [
  { day: 1, label: 'Segunda', short: 'Seg', open: '09:00', close: '19:00' },
  { day: 2, label: 'Terça', short: 'Ter', open: '09:00', close: '19:00' },
  { day: 3, label: 'Quarta', short: 'Qua', open: '09:00', close: '19:00' },
  { day: 4, label: 'Quinta', short: 'Qui', open: '09:00', close: '19:00' },
  { day: 5, label: 'Sexta', short: 'Sex', open: '09:00', close: '19:00' },
  { day: 6, label: 'Sábado', short: 'Sáb', open: '09:00', close: '17:00' },
  { day: 0, label: 'Domingo', short: 'Dom', open: null, close: null },
];

/** Resumo curto usado no rodapé e no contato */
export const hoursSummary = [
  { days: 'Segunda a sexta', time: '09:00 – 19:00' },
  { days: 'Sábado', time: '09:00 – 17:00' },
  { days: 'Domingo', time: 'Fechado' },
];
