import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Modal } from '../ui/Modal';
import { useCart } from '../../store/cart';
import { navItems, SHOP_URL, type Page } from '../../data/nav';
import { business, telLink } from '../../data/business';
import './Header.css';

export function Header({ page }: { page: Page }) {
  const items = navItems(page);
  const { count, open: openCart } = useCart();
  const [solid, setSolid] = useState(page !== 'home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [bump, setBump] = useState(false);
  const prevCount = useRef(count);

  // fundo de vidro depois que a página rola
  useEffect(() => {
    if (page !== 'home') return;
    const onScroll = () => setSolid(scrollY > 24);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [page]);

  // destaca no menu a seção visível
  useEffect(() => {
    if (page !== 'home') return;
    const ids = items.map((i) => i.href).filter((h) => h.startsWith('#')).map((h) => h.slice(1));
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [page]);

  // pequeno "pulo" no contador quando um item entra no carrinho
  useEffect(() => {
    if (count > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  const isCurrent = (href: string, current?: boolean) => current || (href.startsWith('#') && href.slice(1) === active);

  return (
    <>
      <header className={`header ${solid ? 'is-solid' : 'is-overlay on-dark'}`}>
        <div className="header__inner container">
          <a className="header__brand" href={page === 'home' ? '#inicio' : '/'} aria-label={`${business.name} — página inicial`}>
            <Logo />
          </a>

          <nav className="header__nav" aria-label="Principal">
            <ul role="list">
              {items.map((item) => (
                <li key={item.href}>
                  <a href={item.href} aria-current={isCurrent(item.href, item.current) ? (item.current ? 'page' : 'true') : undefined}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header__actions">
            {page !== 'loja' && (
              <a className="btn btn--sm header__cta" href={SHOP_URL}>
                Comprar armações
              </a>
            )}
            <button
              type="button"
              className={`icon-btn header__cart ${bump ? 'is-bump' : ''}`}
              onClick={openCart}
              aria-label={`Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            >
              <Icon name="bag" />
              {count > 0 && (
                <span className="header__count" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>
            <button type="button" className="icon-btn header__burger" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-haspopup="dialog">
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} variant="fullscreen" label="Menu" className="menu-dialog">
        <div className="mobile-menu on-dark">
          <div className="mobile-menu__top container">
            <Logo />
            <button type="button" className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" autoFocus>
              <Icon name="close" />
            </button>
          </div>
          <nav className="mobile-menu__nav container" aria-label="Menu principal">
            <ol role="list">
              {items.map((item, i) => (
                <li key={item.href} style={{ '--i': i } as CSSProperties}>
                  <a href={item.href} onClick={() => setMenuOpen(false)} aria-current={item.current ? 'page' : undefined}>
                    <span className="mobile-menu__num">{String(i + 1).padStart(2, '0')}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="mobile-menu__foot container">
            <a href={telLink} className="btn btn--mint btn--block">
              <Icon name="phone" /> {business.phone.display}
            </a>
            <a href={business.instagram.url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--block">
              <Icon name="instagram" /> {business.instagram.handle}
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
