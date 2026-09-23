const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 69.9 → "R$ 69,90" */
export function formatBRL(value: number): string {
  return brl.format(value).replace(/ /g, ' ');
}
