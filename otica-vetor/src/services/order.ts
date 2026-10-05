import type { CartLine } from '../store/cart';
import { formatPrice } from '../utils/format';

export interface OrderRequest {
  name: string;
  phone: string;
  fulfillment?: string;
  lines: CartLine[];
  total: number;
  hasUnpriced: boolean;
}

/**
 * Mensagem de solicitação de atendimento (WhatsApp, Instagram Direct ou cópia).
 * Segue o modelo do briefing.
 */
export function buildOrderMessage(o: OrderRequest) {
  const items = o.lines
    .map((l) => {
      const price = l.product.price === null ? 'preço sob consulta' : `${l.qty} × ${formatPrice(l.product.price)}`;
      const ref = l.product.model ? ` – ref. ${l.product.model}` : '';
      return `• ${l.product.name}${ref} (${l.product.color.name}) — ${price}`;
    })
    .join('\n');
  const qty = o.lines.reduce((n, l) => n + l.qty, 0);
  const total = formatPrice(o.total) + (o.hasUnpriced ? ' + itens sob consulta' : '');
  const demo = o.lines.some((l) => l.product.demo);

  return [
    `Olá, meu nome é ${o.name.trim()}. Tenho interesse nestas armações:`,
    '',
    items,
    '',
    `Quantidade: ${qty}`,
    `Total: ${total}`,
    o.fulfillment ? `Forma de recebimento: ${o.fulfillment}` : null,
    `Telefone para contato: ${o.phone}`,
    '',
    'Gostaria de saber mais informações para finalizar o atendimento.',
    demo ? '\n(Pedido de teste — catálogo demonstrativo do site)' : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
