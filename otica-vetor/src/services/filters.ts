import type { Product } from '../types/product.ts';
import { SHAPE_LABEL, RIM_LABEL, AVAILABILITY_LABEL } from '../types/product.ts';

/**
 * Busca, filtros e ordenação do catálogo — lógica pura (sem React), testada em filters.test.ts.
 * Os filtros são gerados a partir dos dados: um filtro só aparece quando o catálogo tem
 * pelo menos duas opções diferentes para ele.
 */

export type FacetKey = 'brand' | 'color' | 'shape' | 'rim' | 'availability';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  swatch?: string;
}

export interface Facet {
  key: FacetKey;
  label: string;
  options: FacetOption[];
}

export type SortKey = 'relevancia' | 'menor-preco' | 'maior-preco' | 'nome';

export const SORT_LABEL: Record<SortKey, string> = {
  relevancia: 'Relevância',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  nome: 'Nome (A–Z)',
};

export interface FilterState {
  query: string;
  selected: Partial<Record<FacetKey, string[]>>;
  /** Faixa de preço [min, max]; null = sem restrição */
  price: [number, number] | null;
  sort: SortKey;
}

export const emptyFilters = (): FilterState => ({ query: '', selected: {}, price: null, sort: 'relevancia' });

const FACET_LABEL: Record<FacetKey, string> = {
  brand: 'Marca',
  color: 'Cor',
  shape: 'Formato',
  rim: 'Tipo de aro',
  availability: 'Disponibilidade',
};

const FACET_ORDER: FacetKey[] = ['shape', 'color', 'rim', 'brand', 'availability'];

const valueOf = (p: Product, key: FacetKey): string | null => {
  switch (key) {
    case 'brand':
      return p.brand;
    case 'color':
      return p.color.name;
    case 'shape':
      return p.shape;
    case 'rim':
      return p.rim;
    case 'availability':
      return p.availability;
  }
};

const labelOf = (key: FacetKey, value: string) => {
  if (key === 'shape') return SHAPE_LABEL[value as keyof typeof SHAPE_LABEL] ?? value;
  if (key === 'rim') return RIM_LABEL[value as keyof typeof RIM_LABEL] ?? value;
  if (key === 'availability') return AVAILABILITY_LABEL[value as keyof typeof AVAILABILITY_LABEL] ?? value;
  return value;
};

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Filtros disponíveis para este catálogo (só os que têm 2+ opções) */
export function buildFacets(products: Product[]): Facet[] {
  return FACET_ORDER.map((key) => {
    const map = new Map<string, FacetOption>();
    for (const p of products) {
      const value = valueOf(p, key);
      if (!value) continue;
      const opt = map.get(value) ?? { value, label: labelOf(key, value), count: 0, swatch: key === 'color' ? p.color.hex : undefined };
      opt.count++;
      map.set(value, opt);
    }
    const options = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return { key, label: FACET_LABEL[key], options };
  }).filter((f) => f.options.length >= 2);
}

/** Menor e maior preço do catálogo (ignora "sob consulta") */
export function priceBounds(products: Product[]): [number, number] | null {
  const prices = products.map((p) => p.price).filter((v): v is number => v !== null);
  if (prices.length < 2) return null;
  // múltiplos de 10, alinhados ao passo do controle deslizante
  return [Math.floor(Math.min(...prices) / 10) * 10, Math.ceil(Math.max(...prices) / 10) * 10];
}

const searchText = (p: Product) =>
  normalize(
    [p.name, p.model, p.brand, p.color.name, SHAPE_LABEL[p.shape], RIM_LABEL[p.rim], p.shortDescription, p.description, ...(p.details ?? [])]
      .filter(Boolean)
      .join(' '),
  );

export function applyFilters(products: Product[], state: FilterState): Product[] {
  const terms = normalize(state.query).split(/\s+/).filter(Boolean);

  const result = products.filter((p) => {
    if (terms.length) {
      const text = searchText(p);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    for (const [key, values] of Object.entries(state.selected) as [FacetKey, string[]][]) {
      if (!values?.length) continue;
      const v = valueOf(p, key);
      if (!v || !values.includes(v)) return false;
    }
    if (state.price) {
      if (p.price === null) return false;
      if (p.price < state.price[0] || p.price > state.price[1]) return false;
    }
    return true;
  });

  const byPrice = (dir: 1 | -1) => (a: Product, b: Product) => {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return (a.price - b.price) * dir;
  };

  switch (state.sort) {
    case 'menor-preco':
      return result.sort(byPrice(1));
    case 'maior-preco':
      return result.sort(byPrice(-1));
    case 'nome':
      return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    default:
      return result;
  }
}

export const activeFilterCount = (state: FilterState) =>
  Object.values(state.selected).reduce((n, v) => n + (v?.length ?? 0), 0) + (state.price ? 1 : 0);

/* ───────── Sincronização com a URL (?q=…&formato=…) — permite compartilhar uma busca ───────── */

const PARAM: Record<FacetKey, string> = {
  brand: 'marca',
  color: 'cor',
  shape: 'formato',
  rim: 'aro',
  availability: 'disponibilidade',
};

export function filtersToParams(state: FilterState, params = new URLSearchParams()) {
  for (const key of ['q', 'preco', 'ordem', ...Object.values(PARAM)]) params.delete(key);
  if (state.query) params.set('q', state.query);
  for (const [key, values] of Object.entries(state.selected) as [FacetKey, string[]][]) {
    if (values?.length) params.set(PARAM[key], values.join(','));
  }
  if (state.price) params.set('preco', `${state.price[0]}-${state.price[1]}`);
  if (state.sort !== 'relevancia') params.set('ordem', state.sort);
  return params;
}

export function filtersFromParams(params: URLSearchParams): FilterState {
  const state = emptyFilters();
  state.query = params.get('q') ?? '';
  for (const [key, name] of Object.entries(PARAM) as [FacetKey, string][]) {
    const raw = params.get(name);
    if (raw) state.selected[key] = raw.split(',').filter(Boolean);
  }
  const price = params.get('preco')?.match(/^(\d+)-(\d+)$/);
  if (price) state.price = [Number(price[1]), Number(price[2])];
  const sort = params.get('ordem');
  if (sort && sort in SORT_LABEL) state.sort = sort as SortKey;
  return state;
}
