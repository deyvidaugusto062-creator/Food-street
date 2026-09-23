import { useReducedMotion } from '../../hooks/useMediaQuery';
import { ShaderCanvas } from '../ui/ShaderCanvas';
import { RevealLines } from '../ui/RevealLines';
import './StreetBand.css';

/** Faixa de transição em tela cheia com profundidade em camadas. */
export function StreetBand() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="band" aria-labelledby="band-title">
      <div className="band__bg" data-parallax="-8">
        <ShaderCanvas className="band__canvas" reducedMotion={reducedMotion} />
      </div>
      <div className="band__inner container">
        <p className="band__tag signage" data-parallax="-40" aria-hidden="true">
          Augusta →
        </p>
        <RevealLines
          as="h2"
          id="band-title"
          className="display band__title"
          lines={['Street é food.', <em key="n">Food é noite.</em>]}
        />
        <p className="band__sub signage" data-reveal="">
          Seu rolê tem sabor.
        </p>
        <p className="band__num tnum" data-parallax="-24" aria-hidden="true">
          1005
        </p>
      </div>
    </section>
  );
}
