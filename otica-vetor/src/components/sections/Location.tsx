import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { business, mapLinks } from '../../data/business';
import { hours } from '../../data/hours';
import { getOpenStatus, nowInSaoPaulo } from '../../utils/hours';
import { useNow } from '../../hooks/useNow';
import { SHOW_PENDING } from '../../config/site';

export function Location() {
  const [mapOn, setMapOn] = useState(false);
  const now = useNow();
  const status = getOpenStatus(now);
  const today = nowInSaoPaulo(now).weekday;
  const { address } = business;

  return (
    <section id="localizacao" className="section location" aria-labelledby="localizacao-title">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow" data-reveal>
            Localização
          </p>
          <h2 id="localizacao-title" data-reveal>
            Encontre a {business.name}
          </h2>
        </div>

        <div className="location__grid">
          <div className="location__map" data-reveal="scale">
            {mapOn ? (
              <iframe
                title={`Mapa: ${business.name}, ${address.street}, ${address.number}`}
                src={mapLinks.embed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="map-facade">
                <svg className="map-facade__art" viewBox="0 0 600 420" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <pattern id="mf-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M30 0H0V30" fill="none" stroke="rgb(17 17 17 / .07)" />
                    </pattern>
                  </defs>
                  <rect width="600" height="420" fill="url(#mf-grid)" />
                  <path d="M-20 300 C 140 270, 260 250, 620 120" stroke="#fff" strokeWidth="26" fill="none" />
                  <path d="M180 -20 L 260 440" stroke="#fff" strokeWidth="14" />
                  <path d="M420 -20 L 380 440" stroke="#fff" strokeWidth="10" />
                  <path d="M-20 120 L 620 200" stroke="#fff" strokeWidth="8" />
                  <path d="M60 440 L 140 -20" stroke="#fff" strokeWidth="8" />
                  <text x="380" y="196" fontSize="13" fill="rgb(17 17 17 / .55)" fontFamily="sans-serif" transform="rotate(-21 380 196)">
                    Av. Cupecê
                  </text>
                </svg>
                <div className="map-facade__pin" aria-hidden="true">
                  <span />
                  <Icon name="pin" />
                </div>
                <button type="button" className="btn btn--light map-facade__btn" onClick={() => setMapOn(true)}>
                  <Icon name="map" /> Carregar mapa interativo
                </button>
                <p className="map-facade__note">O mapa do Google é carregado apenas quando você pedir.</p>
              </div>
            )}
          </div>

          <div className="location__info">
            <div className="loc-card" data-reveal>
              <h3>Endereço</h3>
              <address>
                {address.street}, {address.number}
                <br />
                {address.neighborhood}
                <br />
                {address.city} - {address.state}
                <br />
                CEP {address.postalCode}
              </address>
              <div className="loc-card__actions">
                <a className="btn" href={mapLinks.open} target="_blank" rel="noopener noreferrer">
                  <Icon name="pin" /> Abrir no mapa
                </a>
                <a className="btn btn--ghost" href={mapLinks.directions} target="_blank" rel="noopener noreferrer">
                  <Icon name="route" /> Como chegar
                </a>
              </div>
            </div>

            <div className="loc-card" data-reveal>
              <div className="loc-card__row">
                <h3>Horário de funcionamento</h3>
                <span className={`open-pill ${status.open ? 'is-open' : ''}`}>{status.open ? 'Aberto agora' : 'Fechado agora'}</span>
              </div>
              <table className="hours">
                <caption className="visually-hidden">Horário de funcionamento por dia da semana</caption>
                <tbody>
                  {hours.map((h) => (
                    <tr key={h.day} className={h.day === today ? 'is-today' : ''} aria-current={h.day === today ? 'date' : undefined}>
                      <th scope="row">
                        {h.label}
                        {h.day === today && <span className="hours__today">hoje</span>}
                      </th>
                      <td>{h.open && h.close ? `${h.open} – ${h.close}` : 'Fechado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {SHOW_PENDING && (
                <p className="pending loc-card__pending">
                  <span className="pending-tag">Observação interna</span>
                  Horários informados no briefing — validar com o responsável antes da publicação definitiva (incluindo feriados).
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
