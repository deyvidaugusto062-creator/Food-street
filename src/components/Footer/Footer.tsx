import { business, getWhatsAppLink, links } from '../../data/business';
import './Footer.css';

export function Footer() {
  const { address, phone } = business;
  const whatsapp = getWhatsAppLink();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <p className="brand__name">Food Street</p>
          <p className="footer__tag">{business.tagline}</p>
          <p className="footer__tag">Since {business.since}</p>
        </div>
        <nav aria-label="Rodapé — site">
          <ul className="footer__links">
            <li><a className="u-link" href="#cardapio">Cardápio</a></li>
            <li><a className="u-link" href="#destaques">Destaques</a></li>
            <li><a className="u-link" href="#sobre">Sobre</a></li>
            <li><a className="u-link" href="#avaliacoes">Avaliações</a></li>
          </ul>
        </nav>
        <nav aria-label="Rodapé — visita">
          <ul className="footer__links">
            <li><a className="u-link" href="#localizacao">Localização</a></li>
            <li><a className="u-link" href="#horarios">Horários</a></li>
            <li><a className="u-link" href="#contato">Contato</a></li>
          </ul>
        </nav>
        <address className="footer__contact">
          <a className="u-link" href={links.maps} target="_blank" rel="noopener noreferrer">
            {address.street}, {address.number}
          </a>
          <span>
            {address.city} — {address.state}
          </span>
          <a className="u-link tnum" href={links.phone}>
            {phone.display}
          </a>
          {whatsapp ? (
            <a className="u-link" href={whatsapp} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          ) : null}
        </address>
      </div>
      <svg className="footer__wordmark" viewBox="0 0 1000 124" aria-hidden="true" focusable="false">
        <text x="0" y="112" textLength="1000" lengthAdjust="spacingAndGlyphs">
          FOOD STREET
        </text>
      </svg>
      <div className="container footer__bottom">
        <p>© Food Street Augusta</p>
        <p>Imagens dos burgers: ilustrações 3D, não são fotos dos produtos.</p>
      </div>
    </footer>
  );
}
