import { SHOW_PENDING } from '../config/site';
import { differentials, faq, gallery } from './content';

/** Seções que têm conteúdo para mostrar (as não confirmadas somem do site e do menu em produção) */
export const visible = {
  diferenciais: SHOW_PENDING || differentials.some((d) => d.confirmed),
  galeria: SHOW_PENDING || gallery.some((g) => g.authorized && g.src),
  faq: SHOW_PENDING || faq.some((f) => f.confirmed),
};

export type Page = 'home' | 'loja';

export const SHOP_URL = '/armacoes/';

export function navItems(page: Page) {
  const anchor = (id: string) => (page === 'home' ? `#${id}` : `/#${id}`);
  return [
    { label: 'Início', href: page === 'home' ? '#inicio' : '/' },
    { label: 'Armações', href: SHOP_URL, current: page === 'loja' },
    { label: 'Sobre', href: anchor('sobre') },
    visible.diferenciais && { label: 'Diferenciais', href: anchor('diferenciais') },
    visible.galeria && { label: 'Galeria', href: anchor('galeria') },
    visible.faq && { label: 'FAQ', href: anchor('faq') },
    { label: 'Localização', href: anchor('localizacao') },
    { label: 'Contato', href: anchor('contato') },
  ].filter(Boolean) as { label: string; href: string; current?: boolean }[];
}
