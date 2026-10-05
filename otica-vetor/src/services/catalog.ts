import { useEffect, useState } from 'react';
import type { Product } from '../types/product';
import { products as localProducts } from '../data/products';
import { CATALOG_API_URL } from '../config/site';

/**
 * Camada de acesso ao catálogo. Hoje lê src/data/products.ts; quando houver backend,
 * basta definir VITE_CATALOG_API_URL (JSON: Product[]) — nenhum componente precisa mudar.
 */

type Status = 'ready' | 'loading' | 'error';

let cache: Product[] | null = CATALOG_API_URL ? null : localProducts;
let pending: Promise<Product[]> | null = null;

function isProduct(p: unknown): p is Product {
  const o = p as Product;
  return Boolean(o && typeof o.id === 'string' && typeof o.slug === 'string' && typeof o.name === 'string' && Array.isArray(o.images));
}

export function loadCatalog(): Promise<Product[]> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch(CATALOG_API_URL, { headers: { Accept: 'application/json' } })
    .then((r) => {
      if (!r.ok) throw new Error(`Catálogo: HTTP ${r.status}`);
      return r.json();
    })
    .then((data: unknown) => {
      const list = (Array.isArray(data) ? data : []).filter(isProduct);
      cache = list;
      return list;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useCatalog() {
  const [state, setState] = useState<{ products: Product[]; status: Status }>(() =>
    cache ? { products: cache, status: 'ready' } : { products: [], status: 'loading' },
  );

  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadCatalog()
      .then((products) => alive && setState({ products, status: 'ready' }))
      .catch((err) => {
        console.error(err);
        if (alive) setState({ products: [], status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export const findProduct = (products: Product[], idOrSlug: string) =>
  products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
