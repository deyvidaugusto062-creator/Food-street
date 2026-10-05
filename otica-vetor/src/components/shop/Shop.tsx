import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { ProductCard } from '../products/ProductCard';
import { Filters } from './Filters';
import { useCatalog } from '../../services/catalog';
import {
  activeFilterCount,
  applyFilters,
  buildFacets,
  emptyFilters,
  filtersFromParams,
  filtersToParams,
  priceBounds,
  SORT_LABEL,
  type FacetKey,
  type FilterState,
  type SortKey,
} from '../../services/filters';
import { formatPrice, pluralize } from '../../utils/format';
import { business, telLink } from '../../data/business';
import './Shop.css';

export function Shop() {
  const { products, status } = useCatalog();
  const [state, setState] = useState<FilterState>(() => filtersFromParams(new URLSearchParams(location.search)));
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const facets = useMemo(() => buildFacets(products), [products]);
  const bounds = useMemo(() => priceBounds(products), [products]);
  const results = useMemo(() => applyFilters(products, state), [products, state]);
  const active = activeFilterCount(state);
  const hasDemo = products.some((p) => p.demo);

  // mantém a busca na URL (link compartilhável), sem criar entradas no histórico
  useEffect(() => {
    const params = filtersToParams(state, new URLSearchParams(location.search));
    const qs = params.toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
  }, [state]);

  const labelOf = (key: FacetKey, value: string) => facets.find((f) => f.key === key)?.options.find((o) => o.value === value)?.label ?? value;
  const chips = [
    ...(Object.entries(state.selected) as [FacetKey, string[]][]).flatMap(([key, values]) => (values ?? []).map((value) => ({ key, value }))),
  ];
  const clearAll = () => setState({ ...emptyFilters(), sort: state.sort });

  return (
    <>
      <section className="shop-hero on-dark" aria-labelledby="shop-title">
        <div className="shop-hero__bg" aria-hidden="true" />
        <div className="container">
          <nav aria-label="Você está em" className="crumbs">
            <ol role="list">
              <li>
                <a href="/">Início</a>
              </li>
              <li aria-current="page">Armações</li>
            </ol>
          </nav>
          <h1 id="shop-title" className="shop-hero__title">
            Comprar armações
          </h1>
          <p className="shop-hero__lead">
            Busque, filtre e monte seu carrinho. O pedido é finalizado por atendimento com a equipe da {business.name} — sem pagamento pelo site.
          </p>
        </div>
      </section>

      <section className="shop container" aria-label="Catálogo de armações">
        {hasDemo && (
          <p className="demo-banner shop__demo">
            <Icon name="info" />
            <span>
              <strong>Catálogo demonstrativo.</strong> Os produtos, fotos e preços abaixo são ilustrativos e serão substituídos pelo catálogo oficial da ótica.
            </span>
          </p>
        )}

        <div className="shop__toolbar">
          <div className="search">
            <Icon name="search" />
            <label htmlFor="busca" className="visually-hidden">
              Pesquisar armações
            </label>
            <input
              ref={searchRef}
              id="busca"
              type="search"
              className="input search__input"
              placeholder="Pesquisar armações"
              autoComplete="off"
              enterKeyHint="search"
              value={state.query}
              onChange={(e) => setState({ ...state, query: e.target.value })}
            />
            {state.query && (
              <button
                type="button"
                className="search__clear"
                onClick={() => {
                  setState({ ...state, query: '' });
                  searchRef.current?.focus();
                }}
                aria-label="Limpar busca"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <button type="button" className="btn btn--ghost shop__filter-btn" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
            <Icon name="filter" /> Filtros{active > 0 && <span className="shop__badge">{active}</span>}
          </button>

          <div className="shop__sort">
            <label htmlFor="ordem">Ordenar</label>
            <div className="select">
              <select id="ordem" className="input" value={state.sort} onChange={(e) => setState({ ...state, sort: e.target.value as SortKey })}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABEL[k]}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" />
            </div>
          </div>
        </div>

        <div className="shop__layout">
          <aside className="shop__aside" aria-label="Filtros">
            <div className="shop__aside-head">
              <h2>Filtros</h2>
              {active > 0 && (
                <button type="button" className="shop__clear" onClick={clearAll}>
                  Limpar
                </button>
              )}
            </div>
            <Filters facets={facets} bounds={bounds} state={state} onChange={setState} idPrefix="f-side" />
          </aside>

          <div className="shop__results">
            <div className="shop__status">
              <p aria-live="polite" aria-atomic="true">
                {status === 'loading' ? 'Carregando catálogo…' : pluralize(results.length, 'armação encontrada', 'armações encontradas')}
              </p>
              {(chips.length > 0 || state.price) && (
                <ul className="shop__chips" role="list" aria-label="Filtros ativos">
                  {chips.map(({ key, value }) => (
                    <li key={`${key}-${value}`}>
                      <button
                        type="button"
                        className="active-chip"
                        onClick={() => setState({ ...state, selected: { ...state.selected, [key]: state.selected[key]!.filter((v) => v !== value) } })}
                        aria-label={`Remover filtro ${labelOf(key, value)}`}
                      >
                        {labelOf(key, value)} <Icon name="close" />
                      </button>
                    </li>
                  ))}
                  {state.price && (
                    <li>
                      <button type="button" className="active-chip" onClick={() => setState({ ...state, price: null })} aria-label="Remover filtro de preço">
                        {formatPrice(state.price[0])} – {formatPrice(state.price[1])} <Icon name="close" />
                      </button>
                    </li>
                  )}
                  <li>
                    <button type="button" className="shop__clear" onClick={clearAll}>
                      Limpar tudo
                    </button>
                  </li>
                </ul>
              )}
            </div>

            {status === 'error' && (
              <div className="shop__empty">
                <h2>Não foi possível carregar o catálogo</h2>
                <p>
                  Tente novamente em instantes ou fale com a ótica pelo telefone <a href={telLink}>{business.phone.display}</a>.
                </p>
              </div>
            )}

            {status === 'ready' && results.length === 0 && (
              <div className="shop__empty">
                <div className="cart__empty-art" aria-hidden="true">
                  <Icon name="search" />
                </div>
                <h2>Nenhuma armação encontrada</h2>
                <p>Tente outro termo de busca ou remova alguns filtros.</p>
                <button type="button" className="btn" onClick={() => setState(emptyFilters())}>
                  Limpar busca e filtros
                </button>
              </div>
            )}

            {results.length > 0 && (
              <div className="pgrid" data-reveal-stagger>
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} headingLevel={2} />
                ))}
              </div>
            )}

            <p className="shop__help">
              Procura um modelo específico? Ligue para <a href={telLink}>{business.phone.display}</a> ou fale pelo{' '}
              <a href={business.instagram.url} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} variant="drawer" labelledBy="filters-title" className="filters-dialog">
        <header className="cart__head">
          <span className="cart__head-icon" aria-hidden="true">
            <Icon name="filter" />
          </span>
          <div>
            <h2 id="filters-title">Filtros</h2>
            <p>{pluralize(active, 'filtro ativo', 'filtros ativos')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setSheetOpen(false)} aria-label="Fechar filtros">
            <Icon name="close" />
          </button>
        </header>
        <div className="filters-dialog__body">
          <Filters facets={facets} bounds={bounds} state={state} onChange={setState} idPrefix="f-sheet" />
        </div>
        <footer className="cart__foot filters-dialog__foot">
          <button type="button" className="btn btn--ghost" onClick={clearAll} disabled={!active}>
            Limpar
          </button>
          <button type="button" className="btn" onClick={() => setSheetOpen(false)}>
            Ver {pluralize(results.length, 'resultado', 'resultados')}
          </button>
        </footer>
      </Modal>
    </>
  );
}
