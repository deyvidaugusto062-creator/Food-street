import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { business, addressLine, mapLinks, telLink, whatsappLink } from '../../data/business';
import { hoursSummary } from '../../data/hours';
import { navItems, type Page } from '../../data/nav';
import './Footer.css';

export function Footer({ page }: { page: Page }) {
  const wa = whatsappLink();
  const { address } = business;
  return (
    <footer className="footer on-dark">
      <div className="footer__glow" aria-hidden="true" />
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo />
          <p>Armações e produtos ópticos no {address.neighborhood}, em São Paulo.</p>
          <div className="footer__social">
            <a
              href={business.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn footer__social-btn"
              aria-label={`Instagram ${business.instagram.handle} (abre em nova aba)`}
            >
              <Icon name="instagram" />
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="icon-btn footer__social-btn" aria-label="WhatsApp (abre em nova aba)">
                <Icon name="whatsapp" />
              </a>
            )}
            <a href={telLink} className="icon-btn footer__social-btn" aria-label={`Ligar para ${business.phone.display}`}>
              <Icon name="phone" />
            </a>
          </div>
        </div>

        <nav aria-label="Rodapé">
          <h2 className="footer__title">Navegação</h2>
          <ul role="list" className="footer__list">
            {navItems(page).map((i) => (
              <li key={i.href}>
                <a href={i.href}>{i.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="footer__title">Visite</h2>
          <address className="footer__list">
            <a href={mapLinks.open} target="_blank" rel="noopener noreferrer">
              {addressLine}
              <br />
              {address.neighborhood} · {address.city} - {address.state}
              <br />
              CEP {address.postalCode}
            </a>
            <a href={telLink}>{business.phone.display}</a>
          </address>
        </div>

        <div>
          <h2 className="footer__title">Horários</h2>
          <dl className="footer__hours">
            {hoursSummary.map((h) => (
              <div key={h.days}>
                <dt>{h.days}</dt>
                <dd>{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="container footer__bottom">
        <p>
          © {new Date().getFullYear()} {business.name}. Todos os direitos reservados.
        </p>
        <p>Imagens de produtos meramente ilustrativas.</p>
      </div>
    </footer>
  );
}
