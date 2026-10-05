import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Price } from '../ui/Price';
import { ProductGallery } from './ProductGallery';
import { useCatalog, findProduct } from '../../services/catalog';
import { useProductView } from '../../store/productView';
import { useCart } from '../../store/cart';
import { AVAILABILITY_LABEL, RIM_LABEL, SHAPE_LABEL, type Product } from '../../types/product';
import { MAX_QTY } from '../../config/site';
import './ProductModal.css';

/** Modal de detalhes da armação — aberto por ?produto=<slug> em qualquer página */
export function ProductModal() {
  const { slug, closeProduct } = useProductView();
  const { products, status } = useCatalog();
  const product = slug ? findProduct(products, slug) : undefined;
  // mantém o último produto durante a animação de saída
  const [shown, setShown] = useState<Product | undefined>(product);
  useEffect(() => {
    if (product) setShown(product);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const previous = document.title;
    document.title = `${product.name} | Ótica Vetor`;
    return () => {
      document.title = previous;
    };
  }, [product]);

  const open = Boolean(slug) && status !== 'loading';

  return (
    <Modal open={open} onClose={closeProduct} labelledBy="pm-title" variant="center" className="pm-dialog">
      <button type="button" className="icon-btn pm__close" onClick={closeProduct} aria-label="Fechar detalhes">
        <Icon name="close" />
      </button>
      {product || (shown && !slug) ? <ProductDetail product={(product ?? shown)!} /> : <NotFound onClose={closeProduct} />}
    </Modal>
  );
}

function NotFound({ onClose }: { onClose: () => void }) {
  return (
    <div className="pm__notfound">
      <h2 id="pm-title">Armação não encontrada</h2>
      <p>Este produto pode ter saído do catálogo. Veja as outras armações disponíveis.</p>
      <button type="button" className="btn" onClick={onClose}>
        Ver catálogo
      </button>
    </div>
  );
}

function ProductDetail({ product }: { product: Product }) {
  const { add, open: openCart } = useCart();
  const { closeProduct } = useProductView();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const unavailable = product.availability === 'esgotado';

  useEffect(() => {
    setQty(1);
    setAdded(false);
  }, [product.id]);

  const m = product.measurements;
  const specs: [string, string][] = [
    ['Cor', product.color.name],
    ['Formato', SHAPE_LABEL[product.shape]],
    ['Tipo de aro', RIM_LABEL[product.rim]],
    ...(product.brand ? ([['Marca', product.brand]] as [string, string][]) : []),
    ...(product.model ? ([['Modelo', product.model]] as [string, string][]) : []),
    ...(product.material ? ([['Material', product.material]] as [string, string][]) : []),
    ...(m && (m.lens || m.bridge || m.temple)
      ? ([['Medidas', [m.lens && `lente ${m.lens} mm`, m.bridge && `ponte ${m.bridge} mm`, m.temple && `haste ${m.temple} mm`].filter(Boolean).join(' · ')]] as [
          string,
          string,
        ][])
      : []),
  ];

  return (
    <div className="pm">
      <div className="pm__media">
        <ProductGallery product={product} />
      </div>

      <div className="pm__info">
        <div className="pm__badges">
          {product.demo && <span className="badge badge--demo">Produto demonstrativo</span>}
          <span className={`badge pm__avail pm__avail--${product.availability}`}>{AVAILABILITY_LABEL[product.availability]}</span>
        </div>
        <h2 id="pm-title" className="pm__title">
          {product.name}
        </h2>
        <Price value={product.price} demo={product.demo} className="pm__price" />
        <p className="pm__desc">{product.description}</p>

        <dl className="pm__specs">
          {specs.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                {k === 'Cor' && <span className="pm__dot" style={{ background: product.color.hex }} aria-hidden="true" />}
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {product.details && product.details.length > 0 && (
          <ul className="pm__details" role="list">
            {product.details.map((d) => (
              <li key={d}>
                <Icon name="check" /> {d}
              </li>
            ))}
          </ul>
        )}

        <div className="pm__buy">
          <div className="qty" role="group" aria-label="Quantidade">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Diminuir quantidade">
              <Icon name="minus" />
            </button>
            <output aria-live="polite">{qty}</output>
            <button type="button" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY} aria-label="Aumentar quantidade">
              <Icon name="plus" />
            </button>
          </div>
          <button
            type="button"
            className="btn pm__add"
            disabled={unavailable}
            onClick={() => {
              add(product.id, qty);
              setAdded(true);
            }}
          >
            <Icon name={added ? 'check' : 'bag'} />
            {unavailable ? 'Indisponível' : added ? 'Adicionado ao carrinho' : 'Adicionar ao carrinho'}
          </button>
        </div>
        {added && (
          <button
            type="button"
            className="link-arrow pm__gocart"
            onClick={() => {
              closeProduct();
              setTimeout(openCart, 260);
            }}
          >
            Ver carrinho e solicitar atendimento <Icon name="arrowRight" />
          </button>
        )}

        <p className="pm__note">
          <Icon name="info" />
          <span>
            O pedido é finalizado diretamente com a equipe da ótica, que confirma disponibilidade e valores. O site não realiza cobranças.
            {product.demo && ' Este é um produto demonstrativo, que será substituído pelo catálogo oficial.'}
          </span>
        </p>
      </div>
    </div>
  );
}
