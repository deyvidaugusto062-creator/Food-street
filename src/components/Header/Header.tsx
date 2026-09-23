import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import './Header.css';

const NAV = [
  { href: '#inicio', label: 'Início' },
  { href: '#cardapio', label: 'Cardápio' },
  { href: '#destaques', label: 'Destaques' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#avaliacoes', label: 'Avaliações' },
  { href: '#localizacao', label: 'Localização' },
];

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const SECTION_IDS = NAV.map((n) => n.href.slice(1));

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection(SECTION_IDS);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>('a, button');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      toggleRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <header className="site-header" data-scrolled={scrolled || undefined}>
      <div className="site-header__inner container">
        <a className="brand" href="#inicio" aria-label="Food Street Augusta — início">
          <span className="brand__name">Food Street</span>
          <span className="brand__sub">Burger and Bar • Since 2016</span>
        </a>

        <nav className="site-nav" aria-label="Principal">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  className="u-link"
                  href={item.href}
                  aria-current={active === item.href.slice(1) ? 'true' : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <a className="icon-btn" href="#localizacao" aria-label="Ver localização">
            <Icon name="pin" />
          </a>
          <a className="btn site-header__cta" href="#cardapio">
            Ver cardápio
          </a>
          <button
            ref={toggleRef}
            className="icon-btn menu-toggle"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      <div
        className="drawer"
        id="mobile-menu"
        data-open={open || undefined}
        inert={!open}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="drawer__panel" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer__top">
            <span className="brand__sub">Burger and Bar • Since 2016</span>
            <button className="icon-btn" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <nav aria-label="Menu móvel">
            <ol className="drawer__list">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={() => setOpen(false)} aria-current={active === item.href.slice(1) ? 'true' : undefined}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="drawer__foot">
            <p className="signage">R. Augusta, 1005 — São Paulo</p>
            <a className="btn" href="#cardapio" onClick={() => setOpen(false)}>
              Ver cardápio
              <Icon name="arrowRight" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
