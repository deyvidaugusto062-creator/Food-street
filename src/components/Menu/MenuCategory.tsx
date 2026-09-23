import type { MenuCategory as Category, MenuItem } from '../../data/menu';
import { getCategoryItems } from '../../data/menu';
import { Price } from '../ui/Price';
import { ProductImage } from '../ui/ProductImage';
import { selectMenuCategory } from './menuEvents';

/** Preço principal + combo / com batata, com selo quando algo não foi confirmado */
function PriceBlock({ item }: { item: MenuItem }) {
  const isBurgerLike = item.category === 'burgers' || item.category === 'tunados' || (item.category === 'street' && !item.group?.startsWith('Linha'));
  return (
    <div className="menu-row__prices">
      {item.price !== undefined ? (
        <Price value={item.price} className="menu-row__price" />
      ) : (
        <span className="menu-row__price menu-row__price--muted">Valor a confirmar</span>
      )}
      {item.comboPrice !== undefined ? (
        <span className="combo-label">
          Combo <Price value={item.comboPrice} />
        </span>
      ) : null}
      {item.withFriesPrice !== undefined ? (
        <span className="combo-label">
          Com batata <Price value={item.withFriesPrice} />
        </span>
      ) : null}
      {isBurgerLike && item.comboPrice === undefined && item.needsConfirmation ? (
        <span className="combo-label">Combo a confirmar</span>
      ) : null}
    </div>
  );
}

function MenuRow({ item, thumb = false }: { item: MenuItem; thumb?: boolean }) {
  return (
    <li className={`menu-row${thumb ? ' menu-row--thumb' : ''}`}>
      {thumb ? <ProductImage item={item} className="menu-row__thumb" sizes="96px" showTag={false} /> : null}
      <div className="menu-row__body">
        <div className="menu-row__head">
          <h4 className="menu-row__name">{item.name}</h4>
          <span className="menu-row__leader" aria-hidden="true" />
          <PriceBlock item={item} />
        </div>
        {item.description ? <p className="menu-row__desc">{item.description}</p> : null}
        {item.note ? <p className="menu-row__note">{item.note}</p> : null}
      </div>
    </li>
  );
}

function TunadoCard({ item }: { item: MenuItem }) {
  return (
    <li className="tunado">
      <ProductImage item={item} className="tunado__media" sizes="(min-width: 1024px) 360px, 90vw" />
      <div className="tunado__body">
        <h4 className="tunado__name">{item.name}</h4>
        <p className="tunado__desc">{item.description}</p>
        <div className="tunado__prices">
          <Price value={item.price} className="tunado__price" />
          {item.comboPrice !== undefined ? (
            <span className="combo-label">
              Combo <Price value={item.comboPrice} />
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function groupBy(items: MenuItem[]) {
  const groups: { name?: string; items: MenuItem[] }[] = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  });
  return groups;
}

export function MenuCategory({ category }: { category: Category }) {
  const items = getCategoryItems(category.id);

  if (items.length === 0) {
    return <p className="menu-empty">Nenhum item nesta categoria no momento.</p>;
  }

  if (category.id === 'tunados') {
    return (
      <ul className="tunados">
        {items.map((item) => (
          <TunadoCard key={item.id} item={item} />
        ))}
      </ul>
    );
  }

  if (category.id === 'street') {
    return (
      <div className="menu-groups">
        {groupBy(items).map((group) => (
          <div className="menu-group" key={group.name ?? 'geral'}>
            {group.name ? (
              <div className="menu-group__head">
                <h4 className="menu-group__title">{group.name}</h4>
                {group.name === 'Linha Street' ? (
                  <p className="menu-group__note">
                    Smash de 90g, com opção de batata. Valores em confirmação com a casa.
                  </p>
                ) : null}
              </div>
            ) : null}
            <ul className="menu-list">
              {group.items.map((item) => (
                <MenuRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <ul className="menu-list">
        {items.map((item) => (
          <MenuRow key={item.id} item={item} thumb={category.id === 'destaques'} />
        ))}
      </ul>
      {category.id === 'bebidas' ? (
        <p className="menu-crossref">
          Caipirinha e gin estão em{' '}
          <button type="button" className="u-link" onClick={() => selectMenuCategory('doubles')}>
            Doubles
          </button>
          .
        </p>
      ) : null}
    </>
  );
}
