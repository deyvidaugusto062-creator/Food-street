import { SINGLE_FILE } from '../config/site';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Produto aberto no modal, sincronizado com a URL (?produto=<slug>), para que o link
 * de uma armação possa ser compartilhado e o botão "voltar" do celular feche o modal.
 */

const PARAM = 'produto';

interface Value {
  slug: string | null;
  openProduct: (slug: string) => void;
  closeProduct: () => void;
}

const Ctx = createContext<Value | null>(null);

const fromUrl = () => new URLSearchParams(location.search).get(PARAM);

export function ProductViewProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(fromUrl);
  const pushed = useRef(false);

  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      setSlug(fromUrl());
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const openProduct = useCallback((next: string) => {
    if (SINGLE_FILE) return setSlug(next); // arquivo local: sem alterar a URL
    const url = new URL(location.href);
    url.searchParams.set(PARAM, next);
    if (fromUrl()) history.replaceState(history.state, '', url);
    else {
      history.pushState({ modal: true }, '', url);
      pushed.current = true;
    }
    setSlug(next);
  }, []);

  const closeProduct = useCallback(() => {
    setSlug(null);
    if (SINGLE_FILE) return;
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      const url = new URL(location.href);
      url.searchParams.delete(PARAM);
      history.replaceState(history.state, '', url);
    }
  }, []);

  const value = useMemo(() => ({ slug, openProduct, closeProduct }), [slug, openProduct, closeProduct]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductView() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProductView precisa estar dentro de <ProductViewProvider>');
  return ctx;
}
