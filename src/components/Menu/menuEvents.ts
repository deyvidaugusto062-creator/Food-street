import type { CategoryId } from '../../data/menu';

const EVENT = 'foodstreet:menu-select';

/** Permite que outras seções (hero, destaques) abram uma aba do cardápio. */
export function selectMenuCategory(id: CategoryId) {
  window.dispatchEvent(new CustomEvent<CategoryId>(EVENT, { detail: id }));
}

export function onMenuCategorySelect(handler: (id: CategoryId) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<CategoryId>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
