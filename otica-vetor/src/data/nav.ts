import { SHOW_PENDING, SINGLE_FILE } from '../config/site';
import { differentials, faq, gallery } from './content';

/** Seções que têm conteúdo para mostrar (as não confirmadas somem do site e do menu em produção) */
export const visible = {
  diferenciais: SHOW_PENDING || differentials.some((d) => d.confirmed),
  galeria: SHOW_PENDING || gallery.some((g) => g.authorized && g.src),
  faq: SHOW_PENDING || faq.some((f) => f.confirmed),
};

export type Page = 'home' | 'loja';

export const SHOP_URL = SINGLE_FILE ? '#/armacoes' : '/armacoes/';
export const HOME_URL = SINGLE_FILE ? '#inicio' : '/';

/** Link de um produto (abre o modal; no site publicado também funciona como URL direta) */
export const productHref = (slug: string) => (SINGLE_FILE ? SHOP_URL : `${SHOP_URL}?produto=${slug}`);

export function navItems(page: Page) {
  const anchor = (id: string) => (page === 'home' || SINGLE_FILE ? `#${id}` : `/#${id}`);
  return [
    { label: 'Início', href: page === 'home' ? '#inicio' : HOME_URL },
    { label: 'Armações', href: SHOP_URL, current: page === 'loja' },
    { label: 'Sobre', href: anchor('sobre') },
    visible.diferenciais && { label: 'Diferenciais', href: anchor('diferenciais') },
    visible.galeria && { label: 'Galeria', href: anchor('galeria') },
    visible.faq && { label: 'FAQ', href: anchor('faq') },
    { label: 'Localização', href: anchor('localizacao') },
    { label: 'Contato', href: anchor('contato') },
  ].filter(Boolean) as { label: string; href: string; current?: boolean }[];
}
