import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { Product } from '../../types/product';
import { SHAPE_LABEL, RIM_LABEL } from '../../types/product';
import { ProductImage } from '../ui/ProductImage';
import { Price } from '../ui/Price';
import { Icon } from '../ui/Icon';
import { useTilt } from '../../hooks/useTilt';
import { useCart } from '../../store/cart';
import { useProductView } from '../../store/productView';
import { SHOP_URL } from '../../data/nav';
import './ProductCard.css';

export function ProductCard({ product, headingLevel = 3 }: { product: Product; headingLevel?: 2 | 3 }) {
  const ref = useRef<HTMLElement>(null);
  useTilt(ref);
  const { add } = useCart();
  const { openProduct } = useProductView();
  const [added, setAdded] = useState(false);
  const H = `h${headingLevel}` as 'h2' | 'h3';

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(t);
  }, [added]);

  const href = `${SHOP_URL}?produto=${product.slug}`;
  const open = (e: ReactMouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openProduct(product.slug);
  };
  const [main, alt] = product.images;
  const titleId = `pc-${product.id}`;
  const unavailable = product.availability === 'esgotado';

  return (
    <article ref={ref} className="pcard" aria-labelledby={titleId} data-reveal>
      <div className="pcard__media">
        {main && <ProductImage photo={main} className={`pcard__img ${main.kind === 'modelo' ? 'is-photo' : ''}`} sizes="(max-width: 640px) 90vw, 360px" />}
        {alt && <ProductImage photo={alt} className={`pcard__img pcard__img--alt ${alt.kind !== 'packshot' ? 'is-photo' : ''}`} aria-hidden="true" alt="" />}
        <span className="pcard__glare" aria-hidden="true" />
        <div className="pcard__badges">
          {product.demo && <span className="badge badge--demo">Produto demonstrativo</span>}
        </div>
        <span className="pcard__swatch" title={product.color.name}>
          <span style={{ background: product.color.hex }} aria-hidden="true" />
          <span className="visually-hidden">Cor: </span>
          {product.color.name}
        </span>
      </div>

      <div className="pcard__body">
        <p className="pcard__meta">
          {SHAPE_LABEL[product.shape]} · {RIM_LABEL[product.rim]}
          {product.brand && <> · {product.brand}</>}
        </p>
        <H className="pcard__title" id={titleId}>
          <a href={href} onClick={open}>
            {product.name}
          </a>
        </H>
        <p className="pcard__desc">{product.shortDescription}</p>
        <Price value={product.price} demo={product.demo} className="pcard__price" />
        <div className="pcard__actions">
          <a href={href} onClick={open} className="btn btn--ghost btn--sm" aria-label={`Ver detalhes: ${product.name}`}>
            Ver detalhes
          </a>
          <button
            type="button"
            className={`btn btn--sm pcard__add ${added ? 'is-added' : ''}`}
            disabled={unavailable}
            onClick={() => {
              add(product.id);
              setAdded(true);
            }}
            aria-label={`Adicionar ao carrinho: ${product.name}`}
          >
            <Icon name={added ? 'check' : 'bag'} />
            <span>{unavailable ? 'Indisponível' : added ? 'Adicionado' : 'Adicionar'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
