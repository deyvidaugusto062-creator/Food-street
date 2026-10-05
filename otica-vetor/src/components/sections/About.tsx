import { useRef } from 'react';
import { Icon } from '../ui/Icon';
import { useTilt } from '../../hooks/useTilt';
import { about } from '../../data/content';
import { business, addressLine, mapLinks, telLink } from '../../data/business';
import { hoursSummary } from '../../data/hours';
import { SHOW_PENDING } from '../../config/site';
import { imageSources } from '../../utils/asset';

const photo = imageSources('/images/produtos/demo-06-redonda-metal-dourada');

export function About() {
  const visual = useRef<HTMLDivElement>(null);
  useTilt(visual, 5);
  const pending = about.pendingFields.filter((f) => !f.value);

  return (
    <section id="sobre" className="section about" aria-labelledby="sobre-title">
      <div className="container about__grid">
        <div className="about__visual" ref={visual} data-reveal="scale">
          <div className="about__lens">
            <picture>
              {photo.avif && <source srcSet={photo.avif} type="image/avif" />}
              <img
                src={photo.webp}
                alt="Mulher usando armação redonda de aro fino dourado (imagem ilustrativa)"
                width={315}
                height={419}
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>
          <div className="about__ring" aria-hidden="true" />
          <div className="about__card about__card--a">
            <Icon name="pin" />
            <span>
              <strong>{addressLine}</strong>
              {business.address.neighborhood} · São Paulo
            </span>
          </div>
          <div className="about__card about__card--b">
            <Icon name="glasses" />
            <span>
              <strong>Armações</strong>e produtos ópticos
            </span>
          </div>
        </div>

        <div className="about__copy">
          <p className="eyebrow" data-reveal>
            Sobre
          </p>
          <h2 id="sobre-title" data-reveal>
            {about.title}
          </h2>
          <p className="about__lead" data-reveal>
            {about.lead}
          </p>
          {about.paragraphs.map((p) => (
            <p key={p} className="about__text" data-reveal>
              {p}
            </p>
          ))}

          <dl className="about__facts" data-reveal-stagger>
            <div data-reveal>
              <dt>Endereço</dt>
              <dd>
                <a href={mapLinks.open} target="_blank" rel="noopener noreferrer">
                  {addressLine} — {business.address.neighborhood}
                </a>
              </dd>
            </div>
            <div data-reveal>
              <dt>Telefone</dt>
              <dd>
                <a href={telLink}>{business.phone.display}</a>
              </dd>
            </div>
            <div data-reveal>
              <dt>Instagram</dt>
              <dd>
                <a href={business.instagram.url} target="_blank" rel="noopener noreferrer">
                  {business.instagram.handle}
                </a>
              </dd>
            </div>
            <div data-reveal>
              <dt>Horário</dt>
              <dd>
                {hoursSummary[0].days}, {hoursSummary[0].time}
              </dd>
            </div>
          </dl>

          {SHOW_PENDING && pending.length > 0 && (
            <div className="pending about__pending" data-reveal>
              <p className="pending-tag">Campos a preencher com a ótica (visível só em desenvolvimento)</p>
              <ul role="list">
                {pending.map((f) => (
                  <li key={f.label}>[CONFIRMAR] {f.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
