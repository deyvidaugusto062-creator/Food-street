import { faq } from '../../data/content';
import { SHOW_PENDING } from '../../config/site';
import { visible } from '../../data/nav';
import { Icon } from '../ui/Icon';
import { business, telLink } from '../../data/business';

export function Faq() {
  const items = faq.filter((f) => f.confirmed || SHOW_PENDING);
  if (!visible.faq || !items.length) return null;

  return (
    <section id="faq" className="section section--tint faq" aria-labelledby="faq-title">
      <div className="container faq__grid">
        <div className="section-head faq__head">
          <p className="eyebrow" data-reveal>
            FAQ
          </p>
          <h2 id="faq-title" data-reveal>
            Perguntas frequentes
          </h2>
          <p data-reveal>Não encontrou o que procura? Fale com a equipe da ótica.</p>
          <a className="btn btn--ghost" href={telLink} data-reveal>
            <Icon name="phone" /> {business.phone.display}
          </a>
        </div>

        <div className="faq__list" data-reveal-stagger>
          {items.map((f) => (
            <details key={f.question} className={`faq__item ${f.confirmed ? '' : 'pending'}`} data-reveal name="faq">
              <summary>
                <span className="faq__topic">{f.topic}</span>
                <span className="faq__q">{f.question}</span>
                <span className="faq__icon" aria-hidden="true">
                  <Icon name="plus" />
                </span>
              </summary>
              <div className="faq__a">
                {!f.confirmed && <p className="pending-tag">Resposta pendente — visível só em desenvolvimento</p>}
                <p>{f.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
