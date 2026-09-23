import { useRef } from 'react';
import { business, links } from '../../data/business';
import { useInView } from '../../hooks/useInView';

/** Mapa do Google sem chave de API; só carrega quando chega perto da tela. */
export function MapEmbed() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, '400px', true);
  const { address } = business;
  return (
    <div className="map" ref={ref}>
      {near ? (
        <iframe
          title={`Mapa: ${business.name}, ${address.street}, ${address.number}`}
          src={links.mapEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : null}
      <a className="map__fallback" href={links.maps} target="_blank" rel="noopener noreferrer">
        {address.street}, {address.number} — abrir no Google Maps
      </a>
    </div>
  );
}
