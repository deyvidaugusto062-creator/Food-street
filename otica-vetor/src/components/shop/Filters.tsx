import type { CSSProperties } from 'react';
import type { Facet, FacetKey, FilterState } from '../../services/filters';
import { formatPrice } from '../../utils/format';

interface Props {
  facets: Facet[];
  bounds: [number, number] | null;
  state: FilterState;
  onChange: (next: FilterState) => void;
  idPrefix: string;
}

/** Painel de filtros (gerado a partir do catálogo) — usado na lateral e na gaveta do celular */
export function Filters({ facets, bounds, state, onChange, idPrefix }: Props) {
  const toggle = (key: FacetKey, value: string) => {
    const current = state.selected[key] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...state, selected: { ...state.selected, [key]: next } });
  };

  const price = state.price ?? bounds;
  const setPrice = (i: 0 | 1, v: number) => {
    if (!bounds || !price) return;
    const next: [number, number] = [...price];
    next[i] = v;
    if (next[0] > next[1]) next[i === 0 ? 1 : 0] = v;
    onChange({ ...state, price: next[0] <= bounds[0] && next[1] >= bounds[1] ? null : next });
  };

  return (
    <div className="filters">
      {bounds && price && (
        <fieldset className="filters__group">
          <legend>Preço</legend>
          <div className="range" style={{ '--a': `${((price[0] - bounds[0]) / (bounds[1] - bounds[0])) * 100}%`, '--b': `${((price[1] - bounds[0]) / (bounds[1] - bounds[0])) * 100}%` } as CSSProperties}>
            <label className="visually-hidden" htmlFor={`${idPrefix}-pmin`}>
              Preço mínimo
            </label>
            <input
              id={`${idPrefix}-pmin`}
              type="range"
              min={bounds[0]}
              max={bounds[1]}
              step={10}
              value={price[0]}
              onChange={(e) => setPrice(0, Number(e.target.value))}
              aria-valuetext={formatPrice(price[0])}
            />
            <label className="visually-hidden" htmlFor={`${idPrefix}-pmax`}>
              Preço máximo
            </label>
            <input
              id={`${idPrefix}-pmax`}
              type="range"
              min={bounds[0]}
              max={bounds[1]}
              step={10}
              value={price[1]}
              onChange={(e) => setPrice(1, Number(e.target.value))}
              aria-valuetext={formatPrice(price[1])}
            />
          </div>
          <p className="range__values">
            <span>{formatPrice(price[0])}</span>
            <span>{formatPrice(price[1])}</span>
          </p>
        </fieldset>
      )}

      {facets.map((facet) => (
        <fieldset key={facet.key} className="filters__group">
          <legend>{facet.label}</legend>
          <div className="filters__options">
            {facet.options.map((opt) => {
              const checked = state.selected[facet.key]?.includes(opt.value) ?? false;
              return (
                <label key={opt.value} className={`chip ${checked ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(facet.key, opt.value)} />
                  {opt.swatch && <span className="chip__swatch" style={{ background: opt.swatch }} aria-hidden="true" />}
                  <span>{opt.label}</span>
                  <span className="chip__count" aria-label={`${opt.count} produtos`}>
                    {opt.count}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
