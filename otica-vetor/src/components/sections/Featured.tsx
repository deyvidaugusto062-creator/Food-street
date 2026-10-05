import { ProductCard } from '../products/ProductCard';
import { Icon } from '../ui/Icon';
import { useCatalog } from '../../services/catalog';
import { SHOP_URL } from '../../data/nav';

export function Featured() {
  const { products, status } = useCatalog();
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const list = featured.length ? featured : products.slice(0, 4);
  if (status === 'ready' && !list.length) return null;
  const hasDemo = list.some((p) => p.demo);

  return (
    <section id="destaques" className="section featured" aria-labelledby="destaques-title">
      <div className="container">
        <div className="section-head section-head--split">
          <div>
            <p className="eyebrow" data-reveal>
              Armações em destaque
            </p>
            <h2 id="destaques-title" data-reveal>
              Modelos para diferentes estilos
            </h2>
          </div>
          <div className="featured__aside" data-reveal>
            <p>Veja alguns modelos do catálogo, confira os detalhes e monte seu carrinho para falar com a equipe da ótica.</p>
            <a className="link-arrow" href={SHOP_URL}>
              Ver todas as armações <Icon name="arrowRight" />
            </a>
          </div>
        </div>

        {hasDemo && (
          <p className="demo-banner" data-reveal>
            <Icon name="info" />
            <span>
              <strong>Catálogo demonstrativo.</strong> Produtos, fotos e preços ilustrativos — serão substituídos pelo catálogo oficial da Ótica Vetor.
            </span>
          </p>
        )}

        <div className="pgrid" data-reveal-stagger>
          {status === 'loading'
            ? Array.from({ length: 4 }, (_, i) => <div key={i} className="pcard-skeleton" aria-hidden="true" />)
            : list.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}
