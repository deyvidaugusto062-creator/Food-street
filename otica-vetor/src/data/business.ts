/**
 * Dados da empresa.
 *
 * ⚠️ PENDENTE DE VALIDAÇÃO: endereço, telefone, Instagram e horários foram informados no
 * briefing e precisam ser confirmados com o responsável antes da publicação definitiva.
 */

/** Domínio final do site, sem barra no fim (ex.: 'https://www.oticavetor.com.br').
 *  Enquanto vazio, o build não gera URLs absolutas, canonical nem sitemap. */
export const SITE_URL: string = '';

/**
 * WhatsApp oficial — somente dígitos, com 55 + DDD (ex.: '5511999999999').
 * NÃO preencher com número não confirmado. Enquanto vazio, nenhum botão de WhatsApp aparece
 * e a finalização do pedido usa apenas os canais confirmados (telefone, Instagram e loja).
 */
export const WHATSAPP_NUMBER: string = '';

export const business = {
  name: 'Ótica Vetor',
  segment: 'Ótica — armações e produtos ópticos',
  address: {
    street: 'Av. Cupecê',
    number: '3861',
    neighborhood: 'Jardim Prudência',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '04365-001',
    country: 'BR',
  },
  phone: {
    display: '(11) 5625-4354',
    e164: '+551156254354',
  },
  instagram: {
    handle: '@oticavetorsp',
    url: 'https://www.instagram.com/oticavetorsp/',
    /** Abre a conversa direta (Direct) no Instagram */
    directUrl: 'https://ig.me/m/oticavetorsp',
  },
} as const;

const { address } = business;

export const addressLine = `${address.street}, ${address.number}`;
export const addressFull = `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.postalCode}`;

const mapQuery = encodeURIComponent(`${business.name}, ${addressFull}`);

export const mapLinks = {
  /** Abre o endereço no Google Maps (app no celular) */
  open: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
  /** Rota até a loja */
  directions: `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`,
  /** Mapa incorporado — carregado só quando o visitante pede (não usa chave de API) */
  embed: `https://www.google.com/maps?q=${mapQuery}&output=embed&hl=pt-BR`,
};

export const telLink = `tel:${business.phone.e164}`;

export const whatsappLink = (message?: string) =>
  WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}${message ? `?text=${encodeURIComponent(message)}` : ''}`
    : null;
