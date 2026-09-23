import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { categories, type CategoryId } from '../../data/menu';
import { RevealLines } from '../ui/RevealLines';
import { MenuCategory } from './MenuCategory';
import { onMenuCategorySelect } from './menuEvents';
import './Menu.css';

function DonenessNote() {
  return (
    <aside className="doneness" aria-labelledby="doneness-title">
      <h3 className="doneness__title" id="doneness-title">
        O ponto da casa
      </h3>
      <p>O ponto padrão dos nossos burgers é vermelho.</p>
      <p className="doneness__alt">Prefere mais passado? Avise na hora do pedido.</p>
    </aside>
  );
}

export function Menu() {
  const [active, setActive] = useState<CategoryId>('destaques');
  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const firstRender = useRef(true);

  useEffect(() => onMenuCategorySelect(setActive), []);

  // indicador desliza até a aba ativa (só transform)
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const indicator = indicatorRef.current;
    const tab = tabs?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!tabs || !indicator || !tab) return;
    indicator.style.transform = `translateY(${tab.offsetTop}px)`;
    indicator.style.height = `${tab.offsetHeight}px`;
    // no celular, a aba ativa entra na área visível dos chips
    if (!firstRender.current && tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollTo({ left: tab.offsetLeft - 16, behavior: 'smooth' });
    }
    firstRender.current = false;
    // o conteúdo muda de altura: avisa o ScrollTrigger
    window.dispatchEvent(new Event('foodstreet:layout'));
  }, [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = categories.findIndex((c) => c.id === active);
    let next = idx;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (idx + 1) % categories.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (idx - 1 + categories.length) % categories.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = categories.length - 1;
    else return;
    e.preventDefault();
    const id = categories[next].id;
    setActive(id);
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus();
  };

  return (
    <section id="cardapio" className="section section--char grain menu" aria-labelledby="menu-title">
      <div className="container">
        <header className="menu__head">
          <RevealLines as="h2" id="menu-title" className="display menu__title" lines={['Cardápio']} />
          <p className="menu__lede" data-reveal="">
            Entradas, burgers, tunados, doubles e sobremesas. Valores em reais.
          </p>
        </header>

        <div className="menu__layout">
          <div className="menu__aside">
            <div
              className="menu__tabs"
              role="tablist"
              aria-label="Categorias do cardápio"
              ref={tabsRef}
              onKeyDown={onKeyDown}
            >
              <span className="menu__indicator" ref={indicatorRef} aria-hidden="true" />
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  id={`tab-${cat.id}`}
                  data-tab={cat.id}
                  aria-selected={active === cat.id}
                  aria-controls={`panel-${cat.id}`}
                  tabIndex={active === cat.id ? 0 : -1}
                  className="menu__tab"
                  onClick={() => setActive(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <DonenessNote />
          </div>

          <div className="menu__panels">
            {categories.map((cat) => (
              <div
                key={cat.id}
                role="tabpanel"
                id={`panel-${cat.id}`}
                aria-labelledby={`tab-${cat.id}`}
                hidden={active !== cat.id}
                className="menu__panel"
                tabIndex={0}
              >
                <header className="menu__panel-head">
                  <h3 className="menu__panel-title">{cat.label}</h3>
                  {cat.intro ? <p className="menu__panel-intro">{cat.intro}</p> : null}
                </header>
                <MenuCategory category={cat} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
