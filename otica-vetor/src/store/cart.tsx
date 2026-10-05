import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Product } from '../types/product';
import { useCatalog } from '../services/catalog';
import { MAX_QTY } from '../config/site';

/**
 * Carrinho: guarda apenas { id, qty } no localStorage. Preço, nome e foto vêm sempre do
 * catálogo atual — se um preço mudar, o carrinho já mostra o valor novo; itens removidos
 * do catálogo somem do carrinho.
 */

const STORAGE_KEY = 'oticavetor.carrinho.v1';

export interface CartEntry {
  id: string;
  qty: number;
}

export interface CartLine {
  product: Product;
  qty: number;
  /** null quando o produto é "sob consulta" */
  lineTotal: number | null;
}

type Action =
  | { type: 'add'; id: string; qty: number }
  | { type: 'set'; id: string; qty: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'replace'; entries: CartEntry[] };

const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.round(n) || 1));

function reducer(state: CartEntry[], action: Action): CartEntry[] {
  switch (action.type) {
    case 'add': {
      const found = state.find((e) => e.id === action.id);
      if (found) return state.map((e) => (e.id === action.id ? { ...e, qty: clamp(e.qty + action.qty) } : e));
      return [...state, { id: action.id, qty: clamp(action.qty) }];
    }
    case 'set':
      return state.map((e) => (e.id === action.id ? { ...e, qty: clamp(action.qty) } : e));
    case 'remove':
      return state.filter((e) => e.id !== action.id);
    case 'clear':
      return [];
    case 'replace':
      return action.entries;
  }
}

function read(): CartEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data)
      ? data.filter((e) => e && typeof e.id === 'string' && Number.isFinite(e.qty)).map((e) => ({ id: e.id, qty: clamp(e.qty) }))
      : [];
  } catch {
    return [];
  }
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  /** Soma dos itens com preço */
  total: number;
  /** Há itens "sob consulta" (sem preço) */
  hasUnpriced: boolean;
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Último aviso para o leitor de tela / toast */
  notice: { id: number; text: string } | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [entries, dispatch] = useReducer(reducer, undefined, read);
  const { products, status } = useCatalog();
  const [isOpen, setOpen] = useState(false);
  const [notice, setNotice] = useState<CartContextValue['notice']>(null);
  const noticeId = useRef(0);

  // persiste
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* modo privado / armazenamento cheio: o carrinho segue funcionando na sessão */
    }
  }, [entries]);

  // sincroniza entre abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) dispatch({ type: 'replace', entries: read() });
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, []);

  const lines = useMemo<CartLine[]>(() => {
    const out: CartLine[] = [];
    for (const e of entries) {
      const product = products.find((p) => p.id === e.id);
      if (product) out.push({ product, qty: e.qty, lineTotal: product.price === null ? null : product.price * e.qty });
    }
    return out;
  }, [entries, products]);

  // remove itens que não existem mais no catálogo
  useEffect(() => {
    if (status === 'ready' && lines.length !== entries.length) {
      dispatch({ type: 'replace', entries: entries.filter((e) => products.some((p) => p.id === e.id)) });
    }
  }, [status, lines.length, entries, products]);

  const say = useCallback((text: string) => setNotice({ id: ++noticeId.current, text }), []);

  const value = useMemo<CartContextValue>(() => {
    const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? 'Item';
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((n, l) => n + (l.lineTotal ?? 0), 0),
      hasUnpriced: lines.some((l) => l.lineTotal === null),
      add: (id, qty = 1) => {
        dispatch({ type: 'add', id, qty });
        say(`${nameOf(id)} adicionada ao carrinho`);
      },
      setQty: (id, qty) => dispatch({ type: 'set', id, qty }),
      remove: (id) => {
        dispatch({ type: 'remove', id });
        say(`${nameOf(id)} removida do carrinho`);
      },
      clear: () => dispatch({ type: 'clear' }),
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      notice,
    };
  }, [lines, products, isOpen, notice, say]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart precisa estar dentro de <CartProvider>');
  return ctx;
}
