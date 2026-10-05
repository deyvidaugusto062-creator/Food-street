import { Fragment, lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../ui/Icon';
import { FINISHES, type FinishKey } from '../../three/finishes';
import { getFxTier, hasWebGL } from '../../utils/perf';
import { getOpenStatus } from '../../utils/hours';
import { useNow } from '../../hooks/useNow';
import { business, mapLinks, telLink } from '../../data/business';
import { SHOP_URL } from '../../data/nav';
import { imageSources } from '../../utils/asset';
import './Hero.css';

const poster = imageSources('/images/hero/armacao-3d');

/** Three.js só é baixado depois da primeira pintura, e nunca com "reduzir movimento" ou sem WebGL */
const HeroScene = lazy(() => import('../../three/HeroScene'));

const TITLE = 'Encontre a armação que combina com você.';

export function Hero() {
  const [finish, setFinish] = useState<FinishKey>('laranja');
  const [load3d, setLoad3d] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const tier = useRef(getFxTier());
  const can3d = tier.current !== 'off' && hasWebGL();
  const now = useNow();
  const status = getOpenStatus(now);

  // carrega a cena sob demanda: quando o palco está (ou vai entrar) na tela e o navegador está ocioso.
  // No celular o palco fica abaixo dos botões, então o Three.js só é baixado se o visitante rolar até ele.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el || !can3d) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '150px' });
    io.observe(el);
    return () => io.disconnect();
  }, [can3d]);

  // em celulares/aparelhos modestos, espera a primeira interação (toque, rolagem, tecla) antes de baixar o 3D:
  // a primeira dobra aparece rápido com a imagem estática, e o 3D entra em seguida
  const [interacted, setInteracted] = useState(tier.current === 'full');
  useEffect(() => {
    if (interacted || !can3d) return;
    const go = () => setInteracted(true);
    const events = ['pointerdown', 'touchstart', 'scroll', 'keydown', 'wheel'] as const;
    events.forEach((ev) => addEventListener(ev, go, { once: true, passive: true }));
    return () => events.forEach((ev) => removeEventListener(ev, go));
  }, [interacted, can3d]);

  useEffect(() => {
    if (!can3d || !near || !interacted) return;
    const start = () => setLoad3d(true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1500 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(start, 300);
    return () => clearTimeout(t);
  }, [can3d, near, interacted]);

  // pausa a renderização quando o hero sai da tela
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="inicio" className="hero on-dark" aria-labelledby="hero-title">
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__grid-lines" />
        <div className="hero__glow" />
      </div>

      <div className="container hero__layout">
        <div className="hero__copy">
          <p className="eyebrow hero__in" style={{ '--d': '0ms' } as CSSProperties}>
            Ótica · {business.address.neighborhood} · São Paulo
          </p>
          <h1 id="hero-title" className="hero__title" aria-label={TITLE}>
            {TITLE.split(' ').map((word, i) => (
              <Fragment key={i}>
                {i > 0 && ' '}
                <span className="hero__word" aria-hidden="true">
                  <span style={{ '--d': `${120 + i * 55}ms` } as CSSProperties}>{word}</span>
                </span>
              </Fragment>
            ))}
          </h1>
          <p className="hero__lead hero__in" style={{ '--d': '520ms' } as CSSProperties}>
            Conheça a {business.name} e descubra modelos para diferentes estilos.
          </p>
          <div className="hero__ctas hero__in" style={{ '--d': '620ms' } as CSSProperties}>
            <a className="btn btn--mint" href={SHOP_URL}>
              Ver armações <Icon name="arrowRight" />
            </a>
            <a className="btn btn--ghost" href="#sobre">
              Conhecer a {business.name}
            </a>
          </div>

          <ul className="hero__facts hero__in" role="list" style={{ '--d': '760ms' } as CSSProperties}>
            <li>
              <span className={`hero__status ${status.open ? 'is-open' : ''}`} aria-hidden="true" />
              <span>
                {status.open ? (
                  <>
                    <strong>Aberto agora</strong> · até {status.closesAt}
                  </>
                ) : (
                  <>
                    <strong>Fechado agora</strong>
                    {status.nextOpen && (
                      <>
                        {' '}
                        · abre {status.nextOpen.today ? 'hoje' : status.nextOpen.tomorrow ? 'amanhã' : status.nextOpen.label.toLowerCase()} às{' '}
                        {status.nextOpen.at}
                      </>
                    )}
                  </>
                )}
              </span>
            </li>
            <li>
              <Icon name="pin" />
              <a href={mapLinks.open} target="_blank" rel="noopener noreferrer">
                {business.address.street}, {business.address.number}
              </a>
            </li>
            <li>
              <Icon name="phone" />
              <a href={telLink}>{business.phone.display}</a>
            </li>
          </ul>
        </div>

        <div className={`hero__stage ${ready ? 'is-ready' : ''}`} ref={stage}>
          <div className="hero__rings" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <svg className="hero__vector" viewBox="0 0 400 40" aria-hidden="true">
            <path d="M8 20h384" />
            <path d="M8 12v16M392 12v16" />
            <path d="m20 14-12 6 12 6M380 14l12 6-12 6" />
          </svg>

          <picture className="hero__poster">
            {poster.avif && <source srcSet={poster.avif} type="image/avif" />}
            <img
              src={poster.webp}
              alt="Armação 3D ilustrativa em acetato laranja, suspensa no ar"
              width={1200}
              height={900}
              fetchPriority="high"
            />
          </picture>

          {load3d && (
            <div className="hero3d" aria-hidden="true">
              <Suspense fallback={null}>
                <HeroScene finish={finish} quality={tier.current === 'full' ? 'full' : 'lite'} active={active} onReady={() => setReady(true)} />
              </Suspense>
            </div>
          )}

          {can3d && (
            <fieldset className="hero__finishes">
              <legend className="visually-hidden">Acabamento do modelo 3D ilustrativo</legend>
              {FINISHES.map((f) => (
                <label key={f.key} className="hero__swatch" title={f.label}>
                  <input type="radio" name="hero-finish" value={f.key} checked={finish === f.key} onChange={() => setFinish(f.key)} />
                  <span style={{ background: f.swatch }} aria-hidden="true" />
                  <span className="visually-hidden">{f.label}</span>
                </label>
              ))}
            </fieldset>
          )}
          <p className="hero__hint">
            {can3d ? (
              <>
                <Icon name="rotate" /> Arraste para girar · modelo 3D ilustrativo
              </>
            ) : (
              'Modelo 3D ilustrativo'
            )}
          </p>
        </div>
      </div>

      <a className="hero__scroll" href="#destaques" aria-label="Ir para armações em destaque">
        <span />
      </a>
    </section>
  );
}
