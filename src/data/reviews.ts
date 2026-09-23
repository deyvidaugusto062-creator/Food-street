/**
 * Avaliações de clientes — somente as fornecidas pela casa.
 * Não adicione avaliações sem autoria confirmada.
 *
 * `text` é exibido no card. Textos longos são recortados e ganham o botão
 * "Ler avaliação completa" automaticamente.
 */

export interface Review {
  id: string;
  author: string;
  text: string;
  /** Ocasião informada (ex.: 'Jantar') */
  occasion?: string;
  /** Faixa de preço informada pelo cliente */
  priceRange?: string;
  ratings?: { label: string; value: number; max: number }[];
  details?: { label: string; value: string }[];
}

export const reviews: Review[] = [
  {
    id: 'camilla-martins',
    author: 'Camilla Martins',
    priceRange: 'R$ 20–40',
    text: 'Atendimento excelente da Maria Rita, educada, paciente e carismática! As caipirinhas estavam muito gostosas.',
  },
  {
    id: 'lu-santana',
    author: 'Lu Santana',
    occasion: 'Jantar',
    text: 'Saí de casa sem pretensão e encontrei esse lugarzinho incrível pelo caminho.',
    ratings: [
      { label: 'Comida', value: 5, max: 5 },
      { label: 'Serviço', value: 5, max: 5 },
      { label: 'Ambiente', value: 5, max: 5 },
    ],
    details: [
      { label: 'Grupo', value: '3 a 4 pessoas' },
      { label: 'Espera', value: 'Sem espera' },
    ],
  },
  {
    id: 'igor-alves',
    author: 'Igor Alves',
    priceRange: 'R$ 60–80',
    text: 'É o meu bar preferido de São Paulo! Ótimo ambiente, caipirinhas gostosas e atendimento excelente.',
    ratings: [
      { label: 'Comida', value: 5, max: 5 },
      { label: 'Serviço', value: 5, max: 5 },
      { label: 'Ambiente', value: 5, max: 5 },
    ],
    details: [
      { label: 'Barulho', value: 'Moderado' },
      { label: 'Espera', value: 'Até 10 minutos' },
    ],
  },
];
