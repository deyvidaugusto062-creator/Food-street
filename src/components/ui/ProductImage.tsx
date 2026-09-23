import { useState } from 'react';
import type { MenuItem } from '../../data/menu';
import './ProductImage.css';

interface ProductImageProps {
  item: MenuItem;
  sizes: string;
  priority?: boolean;
  /** Mostra a legenda "ilustração" quando a imagem não é foto real */
  showTag?: boolean;
  className?: string;
}

/**
 * Foto real (item.image) tem prioridade. Sem foto, usa a ilustração 3D gerada
 * a partir da receita. Sem nenhuma das duas, mostra um monograma discreto.
 */
export function ProductImage({ item, sizes, priority, showTag = true, className }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const cls = `product-image ${className ?? ''}`.trim();

  if (item.image && !failed) {
    return (
      <figure className={cls}>
        <img
          src={item.image}
          alt={item.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </figure>
    );
  }

  if (item.render && !failed) {
    return (
      <figure className={`${cls} product-image--render`}>
        <img
          src={`${item.render}-600.webp`}
          srcSet={`${item.render}-600.webp 600w, ${item.render}-1000.webp 1000w`}
          sizes={sizes}
          width={600}
          height={600}
          alt={`Ilustração 3D do ${item.name}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
        {showTag ? <figcaption className="product-image__tag">Ilustração</figcaption> : null}
      </figure>
    );
  }

  return (
    <figure className={`${cls} product-image--empty`} aria-hidden="true">
      <span className="product-image__monogram">{item.name.charAt(0)}</span>
    </figure>
  );
}
