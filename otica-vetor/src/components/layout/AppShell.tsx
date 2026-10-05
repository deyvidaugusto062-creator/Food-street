import type { ReactNode } from 'react';
import { CartProvider } from '../../store/cart';
import { ProductViewProvider } from '../../store/productView';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '../cart/CartDrawer';
import { ProductModal } from '../products/ProductModal';
import { Toast } from '../ui/Toast';
import { useReveal } from '../../hooks/useReveal';
import type { Page } from '../../data/nav';

/** Estrutura comum às páginas: provedores, cabeçalho, rodapé, carrinho e modal de produto */
export function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  useReveal();
  return (
    <CartProvider>
      <ProductViewProvider>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Header page={page} />
        <main id="conteudo" tabIndex={-1}>
          {children}
        </main>
        <Footer page={page} />
        <CartDrawer />
        <ProductModal />
        <Toast />
      </ProductViewProvider>
    </CartProvider>
  );
}
