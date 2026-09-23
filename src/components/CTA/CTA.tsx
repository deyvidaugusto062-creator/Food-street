import { business, links } from '../../data/business';
import { useReducedMotion } from '../../hooks/useMediaQuery';
import { Icon } from '../ui/Icon';
import { RevealLines } from '../ui/RevealLines';
import { ShaderCanvas } from '../ui/ShaderCanvas';
import './CTA.css';

export function CTA() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="cta__bg" data-parallax="-10">
        <ShaderCanvas className="cta__canvas" warmth={1.6} reducedMotion={reducedMotion} />
      </div>
      <div className="container cta__inner">
        <RevealLines as="h2" id="cta-title" className="display cta__title" lines={['Seu rolê', <em key="s">tem sabor.</em>]} />
        <p className="cta__sub" data-reveal="">
          {business.name} — {business.tagline}
        </p>
        <div className="cta__buttons" data-reveal="">
          <a className="btn" href="#cardapio">
            Ver cardápio
            <Icon name="arrowRight" />
          </a>
          <a className="btn btn--ghost" href={links.directions} target="_blank" rel="noopener noreferrer">
            Como chegar
            <Icon name="arrowUpRight" />
          </a>
        </div>
      </div>
    </section>
  );
}
