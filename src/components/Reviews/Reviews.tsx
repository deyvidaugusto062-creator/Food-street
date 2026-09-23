import { useLayoutEffect, useRef, useState } from 'react';
import { reviews, type Review } from '../../data/reviews';
import { Icon } from '../ui/Icon';
import { RevealLines } from '../ui/RevealLines';
import './Reviews.css';

function Stars({ value, max }: { value: number; max: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name="star" className={i < value ? 'is-on' : undefined} />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  // o botão só aparece quando o texto realmente passa do limite
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const check = () => setClamped(el.scrollHeight - el.clientHeight > 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  const meta = [review.occasion, review.priceRange ? `Faixa de preço ${review.priceRange}` : null].filter(Boolean);

  return (
    <li className="review-card">
      <article aria-labelledby={`review-${review.id}`}>
        <span className="review-card__mark" aria-hidden="true">
          “
        </span>
        <blockquote className="review-card__quote">
          <p ref={textRef} className="review-card__text" data-expanded={expanded || undefined} id={`review-text-${review.id}`}>
            {review.text}
          </p>
        </blockquote>
        {clamped || expanded ? (
          <button
            type="button"
            className="review-card__more u-link"
            aria-expanded={expanded}
            aria-controls={`review-text-${review.id}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Mostrar menos' : 'Ler avaliação completa'}
          </button>
        ) : null}

        {review.ratings ? (
          <dl className="review-card__ratings">
            {review.ratings.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>
                  <Stars value={r.value} max={r.max} />
                  <span className="tnum">
                    {r.value}/{r.max}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <footer className="review-card__foot">
          <p className="review-card__author" id={`review-${review.id}`}>
            {review.author}
          </p>
          {meta.length ? <p className="review-card__meta">{meta.join(' — ')}</p> : null}
          {review.details ? (
            <dl className="review-card__details">
              {review.details.map((d) => (
                <div key={d.label}>
                  <dt>{d.label}</dt>
                  <dd>{d.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </footer>
      </article>
    </li>
  );
}

export function Reviews() {
  return (
    <section id="avaliacoes" className="section section--cream grain reviews" aria-labelledby="reviews-title">
      <div className="container">
        <header className="reviews__head">
          <p className="eyebrow" data-reveal="">
            Avaliações de clientes
          </p>
          <RevealLines as="h2" id="reviews-title" className="title" lines={['Quem viveu', <>a <em>experiência</em></>]} />
        </header>
      </div>
      <ul className="reviews__list" aria-label="Avaliações de clientes">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </ul>
    </section>
  );
}
