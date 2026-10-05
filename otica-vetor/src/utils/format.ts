const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 289.9 → "R$ 289,90" */
export const formatPrice = (value: number) => brl.format(value).replace(/ /g, ' ');

/** Remove acentos e caixa para buscas: "Óculos" → "oculos" */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Máscara simples de telefone brasileiro: (11) 91234-5678 */
export function maskPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const pluralize = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
