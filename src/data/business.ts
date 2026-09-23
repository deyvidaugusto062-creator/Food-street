/**
 * Dados institucionais da Food Street Augusta.
 * Tudo que aparece no site sobre endereço, telefone e contato sai daqui.
 */

export const business = {
  name: 'Food Street Augusta',
  brand: 'Food Street',
  tagline: 'Burger and Bar',
  since: 2016,
  address: {
    street: 'Rua Augusta',
    streetShort: 'R. Augusta',
    number: '1005',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01305-100',
    country: 'BR',
  },
  phone: {
    display: '(11) 3151-5005',
    /** Formato internacional usado no link tel: */
    e164: '+551131515005',
  },
} as const;

/**
 * WhatsApp — ainda NÃO confirmado.
 * Preencha somente com o número oficial, só dígitos, com DDI e DDD.
 * Exemplo de formato: '5511900000000'
 * Enquanto estiver vazio, nenhum botão de WhatsApp aparece no site.
 */
export const WHATSAPP_NUMBER: string = '';
export const WHATSAPP_MESSAGE = 'Olá! Vim pelo site da Food Street Augusta.';

/**
 * Endereço do site publicado (ex.: 'https://www.foodstreetaugusta.com.br').
 * Usado nos dados estruturados e nas meta tags. Deixe vazio até ter o domínio.
 */
export const SITE_URL: string = '';

const mapsQuery = `Food Street Augusta, ${business.address.streetShort}, ${business.address.number} - ${business.address.neighborhood}, ${business.address.city} - ${business.address.state}, ${business.address.postalCode}`;

export const links = {
  /** Abre o local no Google Maps */
  maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
  /** Abre a rota até o local */
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`,
  /** Mapa incorporado (não precisa de chave de API) */
  mapEmbed: `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`,
  phone: `tel:${business.phone.e164}`,
} as const;

/** Retorna o link do WhatsApp ou null quando o número não estiver configurado. */
export function getWhatsAppLink(): string | null {
  const digits = WHATSAPP_NUMBER.replace(/\D/g, '');
  if (digits.length < 12) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}
