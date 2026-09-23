import { business } from '../../data/business';
import { RevealLines } from '../ui/RevealLines';
import './About.css';

export function About() {
  return (
    <section id="sobre" className="section section--sand grain about" aria-labelledby="about-title">
      <div className="container about__grid">
        <p className="about__year tnum" aria-hidden="true" data-parallax="-10">
          {business.since}
        </p>
        <div className="about__text">
          <p className="eyebrow" data-reveal="">
            Desde {business.since}
          </p>
          <RevealLines
            as="h2"
            id="about-title"
            className="title"
            lines={['Burger and Bar', <>na <em>Rua Augusta</em></>]}
          />
          <p className="lede" data-reveal="">
            A Food Street está na Augusta desde {business.since}: burger direto da chapa, bar e a noite de São Paulo
            passando lá fora.
          </p>
          <dl className="about__facts" data-reveal="">
            <div>
              <dt>Casa</dt>
              <dd>{business.brand}</dd>
            </div>
            <div>
              <dt>Conceito</dt>
              <dd>{business.tagline}</dd>
            </div>
            <div>
              <dt>Endereço</dt>
              <dd>
                {business.address.street}, {business.address.number}
              </dd>
            </div>
            <div>
              <dt>Desde</dt>
              <dd className="tnum">{business.since}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
