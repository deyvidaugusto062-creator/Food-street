/**
 * Horário de funcionamento.
 * `day` segue o padrão do JavaScript: 0 = domingo, 1 = segunda … 6 = sábado.
 * Quando o fechamento é menor que a abertura (ex.: 16:00 – 01:00),
 * o turno termina na madrugada do dia seguinte.
 */

export interface DayHours {
  day: number;
  label: string;
  short: string;
  open?: string;
  close?: string;
  closed?: boolean;
}

export const TIMEZONE = 'America/Sao_Paulo';

export const HOURS_NOTE = 'Horários sujeitos a alterações.';

/** Ordem de exibição: segunda → domingo */
export const hours: DayHours[] = [
  { day: 1, label: 'Segunda', short: 'Seg', closed: true },
  { day: 2, label: 'Terça', short: 'Ter', open: '16:00', close: '01:00' },
  { day: 3, label: 'Quarta', short: 'Qua', open: '16:00', close: '01:00' },
  { day: 4, label: 'Quinta', short: 'Qui', open: '16:00', close: '01:00' },
  { day: 5, label: 'Sexta', short: 'Sex', open: '16:00', close: '05:00' },
  { day: 6, label: 'Sábado', short: 'Sáb', open: '16:00', close: '05:00' },
  { day: 0, label: 'Domingo', short: 'Dom', open: '17:00', close: '22:30' },
];
