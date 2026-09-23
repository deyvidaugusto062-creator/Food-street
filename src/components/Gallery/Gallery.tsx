import { useState } from 'react';
import { gallery, type GalleryTile } from '../../data/gallery';
import { getItem } from '../../data/menu';
import { ProductImage } from '../ui/ProductImage';
import { RevealLines } from '../ui/RevealLines';
import './Gallery.css';

function PhotoTile({ tile }: { tile: Extract<GalleryTile, { kind: 'photo' }> }) {
  const [failed, setFailed] = useState(false);
  if (tile.src && !failed) {
    return (
      <figure className="tile__figure">
        <img src={tile.src} alt={tile.alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
        <figcaption className="tile__caption">{tile.category}</figcaption>
      </figure>
    );
  }
  // espaço reservado para foto real da casa (ver src/data/gallery.ts)
  return (
    <div className="tile__placeholder" data-category={tile.category}>
      <span className="tile__ph-label">{tile.category}</span>
      <span className="tile__ph-note">Foto da casa em breve</span>
    </div>
  );
}

function Tile({ tile }: { tile: GalleryTile }) {
  if (tile.kind === 'photo') return <PhotoTile tile={tile} />;
  if (tile.kind === 'render') {
    const item = getItem(tile.itemId);
    if (!item) return null;
    return (
      <figure className="tile__render">
        <ProductImage item={item} sizes="(min-width: 1024px) 25vw, 50vw" showTag={false} />
        <figcaption className="tile__caption">
          {item.name}
          <span className="tile__caption-note">Ilustração 3D</span>
        </figcaption>
      </figure>
    );
  }
  return (
    <div className="tile__type">
      <p className="tile__type-lines">
        {tile.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      <p className="tile__type-caption">{tile.caption}</p>
    </div>
  );
}

export function Gallery() {
  return (
    <section className="section section--char grain gallery" aria-labelledby="gallery-title">
      <div className="container">
        <header className="gallery__head">
          <RevealLines as="h2" id="gallery-title" className="title" lines={[<>Noite na <em>Augusta</em></>]} />
          <p className="gallery__lede" data-reveal="">
            Burgers, drinks e a Augusta acesa lá fora.
          </p>
        </header>
        <ul className="gallery__grid">
          {gallery.map((tile) => (
            <li key={tile.id} className={`tile tile--${tile.shape} tile--${tile.kind}`} data-reveal-clip="">
              <Tile tile={tile} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
