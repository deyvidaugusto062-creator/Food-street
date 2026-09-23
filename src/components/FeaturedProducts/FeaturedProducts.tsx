import { useCallback, useEffect, useRef, useState } from 'react';
import { getCategoryLabel, getFeatured } from '../../data/menu';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { Icon } from '../ui/Icon';
import { Price } from '../ui/Price';
import { ProductImage } from '../ui/ProductImage';
import { RevealLines } from '../ui/RevealLines';
import { selectMenuCategory } from '../Menu/menuEvents';
import './FeaturedProducts.css';

export function FeaturedProducts() {
  const items = getFeatured();
  const railRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setEdges({ start: rail.scrollLeft <= 4, end: rail.scrollLeft >= max - 4 });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateEdges();
    rail.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      rail.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges]);

  const scrollByCard = (dir: 1 | -1) => {
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>('.product-card');
    if (!rail || !card) return;
    const gap = parseFloat(getComputedStyle(card.parentElement!).columnGap) || 24;
    rail.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <section id="destaques" className="section section--cream grain featured" aria-labelledby="featured-title">
      <div className="container featured__head">
        <div className="featured__intro">
          <p className="eyebrow" data-reveal="">
            Direto da chapa
          </p>
          <RevealLines as="h2" id="featured-title" className="title" lines={['Escolha o seu', <em key="f">favorito</em>]} />
          <p className="lede" data-reveal="">
            Burgers preparados na hora para acompanhar sua noite na Augusta.
          </p>
        </div>
        <div className="featured__controls">
          <button
            type="button"
            className="round-btn"
            aria-label="Burger anterior"
            aria-controls="featured-rail"
            disabled={edges.start}
            onClick={() => scrollByCard(-1)}
          >
            <Icon name="arrowLeft" />
          </button>
          <button
            type="button"
            className="round-btn"
            aria-label="Próximo burger"
            aria-controls="featured-rail"
            disabled={edges.end}
            onClick={() => scrollByCard(1)}
          >
            <Icon name="arrowRight" />
          </button>
        </div>
      </div>

      <div className="rail" id="featured-rail" ref={railRef} role="region" aria-label="Burgers em destaque" tabIndex={0}>
        <ul className="rail__track">
          {items.map((item) => (
            <li key={item.id} className="product-card">
              <ProductImage
                item={item}
                className="product-card__media"
                sizes="(min-width: 1024px) 400px, 80vw"
              />
              <div className="product-card__body">
                <p className="product-card__cat">{getCategoryLabel(item.category)}</p>
                <h3 className="product-card__name">
                  <a href="#cardapio" onClick={() => selectMenuCategory(item.category)}>
                    {item.name}
                  </a>
                </h3>
                <p className="product-card__desc">{item.description}</p>
                <div className="product-card__prices">
                  {item.price !== undefined ? (
                    <Price value={item.price} className="product-card__price" />
                  ) : (
                    <span className="product-card__price product-card__price--muted">Valor a confirmar</span>
                  )}
                  {item.comboPrice ? (
                    <span className="combo-label">
                      Combo <Price value={item.comboPrice} />
                    </span>
                  ) : null}
                  {item.withFriesPrice ? (
                    <span className="combo-label">
                      Com batata <Price value={item.withFriesPrice} />
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
