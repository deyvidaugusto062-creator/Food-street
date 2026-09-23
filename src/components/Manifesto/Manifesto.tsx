import { Icon, type IconName } from '../ui/Icon';
import { RevealLines } from '../ui/RevealLines';
import './Manifesto.css';

const ATTRIBUTES: { icon: IconName; label: string }[] = [
  { icon: 'burger', label: 'Burgers preparados na hora' },
  { icon: 'glass', label: 'Bar' },
  { icon: 'street', label: 'Rua Augusta' },
  { icon: 'people', label: 'Bons momentos' },
];

export function Manifesto() {
  return (
    <section className="section section--ink grain manifesto" aria-labelledby="manifesto-title">
      <div className="container manifesto__grid">
        <div className="manifesto__text">
          <p className="eyebrow" data-reveal="">
            Food Street Augusta
          </p>
          <RevealLines
            as="h2"
            id="manifesto-title"
            className="title manifesto__title"
            lines={['A noite fica', 'melhor quando é', <em key="c">compartilhada.</em>]}
          />
          <p className="lede" data-reveal="">
            Burger, bar, amigos e bons momentos no coração da Rua Augusta.
          </p>
        </div>
        <ul className="manifesto__list" data-reveal-group="">
          {ATTRIBUTES.map((attr) => (
            <li key={attr.label}>
              <Icon name={attr.icon} />
              <span>{attr.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
