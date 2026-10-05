import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { ProductImage } from '../ui/ProductImage';
import { gallery, GALLERY_LABEL, type GalleryItem } from '../../data/content';
import { SHOW_PENDING } from '../../config/site';
import { visible } from '../../data/nav';

/** Somente fotos autorizadas pela ótica são publicadas; as pendentes aparecem como marcadores em desenvolvimento */
export function Gallery() {
  const photos = gallery.filter((g) => g.authorized && g.src);
  const tiles = gallery.filter((g) => (g.authorized && g.src) || SHOW_PENDING);
  const [index, setIndex] = useState<number | null>(null);

  if (!visible.galeria || !tiles.length) return null;

  return (
    <section id="galeria" className="section gallery" aria-labelledby="galeria-title">
      <div className="container">
        <div className="section-head section-head--split">
          <div>
            <p className="eyebrow" data-reveal>
              Galeria
            </p>
            <h2 id="galeria-title" data-reveal>
              Estilo de perto
            </h2>
          </div>
          <p data-reveal>Armações, detalhes e o ambiente da loja. Toque em uma foto para ampliar.</p>
        </div>

        <ul className="gallery__grid" role="list" data-reveal-stagger>
          {tiles.map((item, i) =>
            item.authorized && item.src ? (
              <li key={i} className={`gallery__tile gallery__tile--${i % 5}`} data-reveal="scale">
                <button type="button" onClick={() => setIndex(photos.indexOf(item))} aria-label={`Ampliar: ${item.caption}`}>
                  <ProductImage photo={item} className={item.fit === 'contain' ? 'is-contain' : ''} sizes="(max-width: 700px) 50vw, 400px" />
                  <span className="gallery__cap">
                    <span>{GALLERY_LABEL[item.category]}</span>
                    {item.caption}
                  </span>
                </button>
              </li>
            ) : (
              <li key={i} className={`gallery__tile gallery__tile--${i % 5} gallery__tile--pending pending`} data-reveal="scale">
                <p className="pending-tag">Foto pendente</p>
                <p>
                  <strong>{GALLERY_LABEL[item.category]}</strong>
                  <br />
                  Inserir somente foto autorizada pela ótica
                </p>
              </li>
            ),
          )}
        </ul>
      </div>

      <Lightbox items={photos} index={index} onIndex={setIndex} />
    </section>
  );
}

function Lightbox({ items, index, onIndex }: { items: GalleryItem[]; index: number | null; onIndex: (i: number | null) => void }) {
  const [last, setLast] = useState(0);
  useEffect(() => {
    if (index !== null) setLast(index);
  }, [index]);
  const i = index ?? last;
  const item = items[i];
  const go = (dir: 1 | -1) => onIndex((i + dir + items.length) % items.length);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!item) return null;

  return (
    <Modal open={index !== null} onClose={() => onIndex(null)} variant="fullscreen" labelledBy="lb-caption" className="lightbox">
      <div className="lightbox__inner on-dark">
        <button type="button" className="icon-btn lightbox__close" onClick={() => onIndex(null)} aria-label="Fechar galeria" autoFocus>
          <Icon name="close" />
        </button>
        <figure className="lightbox__figure" key={item.src}>
          <ProductImage photo={item} priority />
          <figcaption id="lb-caption">
            <span>
              {i + 1} / {items.length}
            </span>
            {item.caption}
          </figcaption>
        </figure>
        {items.length > 1 && (
          <>
            <button type="button" className="icon-btn lightbox__nav lightbox__nav--prev" onClick={() => go(-1)} aria-label="Foto anterior">
              <Icon name="arrowLeft" />
            </button>
            <button type="button" className="icon-btn lightbox__nav lightbox__nav--next" onClick={() => go(1)} aria-label="Próxima foto">
              <Icon name="arrowRight" />
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
