import { useRef } from 'react';
import { useTilt } from '../../hooks/useTilt';
import { differentials, type Differential } from '../../data/content';
import { SHOW_PENDING } from '../../config/site';
import { visible } from '../../data/nav';

export function Differentials() {
  const items = differentials.filter((d) => d.confirmed || SHOW_PENDING);
  if (!visible.diferenciais || !items.length) return null;

  return (
    <section id="diferenciais" className="section section--dark differentials" aria-labelledby="diferenciais-title">
      <div className="differentials__bg" aria-hidden="true" />
      <div className="container">
        <div className="section-head">
          <p className="eyebrow" data-reveal>
            Diferenciais
          </p>
          <h2 id="diferenciais-title" data-reveal>
            Por que escolher a Ótica Vetor
          </h2>
        </div>
        <ol className="diff__grid" role="list" data-reveal-stagger>
          {items.map((d, i) => (
            <DiffCard key={d.title} item={d} index={i} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function DiffCard({ item, index }: { item: Differential; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  useTilt(ref, 6);
  return (
    <li ref={ref} className={`diff ${item.confirmed ? '' : 'diff--pending'}`} data-reveal>
      <span className="diff__num" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      {!item.confirmed && <p className="pending-tag">Pendente de confirmação</p>}
      <h3>{item.title}</h3>
      <p>{item.text}</p>
    </li>
  );
}
