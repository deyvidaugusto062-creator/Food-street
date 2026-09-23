import { business, getWhatsAppLink, links } from '../../data/business';
import { Icon } from '../ui/Icon';
import { RevealLines } from '../ui/RevealLines';
import { StreetSign } from '../ui/StreetSign';
import { Hours } from './Hours';
import { MapEmbed } from './MapEmbed';
import './Location.css';

export function Location() {
  const { address, phone } = business;
  const whatsapp = getWhatsAppLink();
  return (
    <section id="localizacao" className="section section--ink grain location" aria-labelledby="location-title">
      <div className="container">
        <header className="location__head">
          <div>
            <p className="eyebrow" data-reveal="">
              Localização
            </p>
            <RevealLines
              as="h2"
              id="location-title"
              className="display location__title"
              lines={['A noite começa', <>na <em>Augusta.</em></>]}
            />
          </div>
          <div className="location__sign" data-parallax="-14">
            <StreetSign />
          </div>
        </header>

        <div className="location__grid">
          <div className="location__col">
            <div className="contact" id="contato">
              <h3 className="contact__title">Endereço</h3>
              <address className="contact__address">
                {address.streetShort}, {address.number}
                <br />
                {address.neighborhood}
                <br />
                {address.city} — {address.state}
                <br />
                <span className="tnum">{address.postalCode}</span>
              </address>
              <a className="contact__phone tnum" href={links.phone}>
                <Icon name="phone" />
                {phone.display}
              </a>
              <div className="contact__actions">
                <a className="btn" href={links.maps} target="_blank" rel="noopener noreferrer">
                  Abrir no mapa
                  <Icon name="arrowUpRight" />
                </a>
                <a className="btn btn--ghost" href={links.directions} target="_blank" rel="noopener noreferrer">
                  Como chegar
                  <Icon name="arrowUpRight" />
                </a>
                {whatsapp ? (
                  <a className="btn btn--ghost" href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <Icon name="whatsapp" />
                    Chamar no WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
            <Hours />
          </div>
          <MapEmbed />
        </div>
      </div>
    </section>
  );
}
