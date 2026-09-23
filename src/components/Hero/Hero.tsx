import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getCategoryLabel, getItem, heroItemId } from '../../data/menu';
import { business, links } from '../../data/business';
import { createPointerState } from '../../three/pointer';
import { useFinePointer, useMediaQuery, useReducedMotion } from '../../hooks/useMediaQuery';
import { useNow } from '../../hooks/useNow';
import { getOpenStatus, hoursFor, nowInSaoPaulo } from '../../utils/hours';
import { hasWebGL } from '../../utils/webgl';
import { Icon } from '../ui/Icon';
import { Price } from '../ui/Price';
import { selectMenuCategory } from '../Menu/menuEvents';
import './Hero.css';

const Hero3D = lazy(() => import('../Hero3D/Hero3D'));

const POSTER = '/images/burgers/renders/the-king-brooklyn';

function HeroPoster() {
  return (
    <img
      className="hero__poster"
      src={`${POSTER}-1000.webp`}
      srcSet={`${POSTER}-600.webp 600w, ${POSTER}-1000.webp 1000w`}
      sizes="(min-width: 1024px) 50vw, 90vw"
      width={1000}
      height={1000}
      alt="Ilustração 3D do The King Brooklyn"
      fetchPriority="high"
    />
  );
}

function TodayLine() {
  const now = useNow();
  const { weekday } = nowInSaoPaulo(now);
  const today = hoursFor(weekday);
  const status = getOpenStatus(now);
  return (
    <span className="hero__today">
      <Icon name="clock" />
      <span>
        Hoje{' '}
        <span className="tnum">{today?.closed ? 'fechado' : `${today?.open} – ${today?.close}`}</span>
      </span>
      {status.open ? <span className="status-dot">Aberto agora</span> : null}
    </span>
  );
}

export function Hero() {
  const item = getItem(heroItemId)!;
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const wide = useMediaQuery('(min-width: 1024px)', true);
  const pointer = useMemo(() => createPointerState(), []);
  const [use3D, setUse3D] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [cursor, setCursor] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const numeralRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUse3D(hasWebGL());
  }, []);

  // Paralaxe 2.5D pelo mouse: fundo quase parado, número 1005 médio, burger e
  // ingredientes (no 3D) mais intensos. Texto fica estático.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !finePointer || reducedMotion) return;
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      pointer.x = cx;
      pointer.y = cy;
      if (glowRef.current) glowRef.current.style.transform = `translate3d(${cx * 14}px, ${-cy * 10}px, 0)`;
      if (numeralRef.current) numeralRef.current.style.transform = `translate3d(${cx * -26}px, ${cy * 16}px, 0)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
    };
  }, [finePointer, reducedMotion, pointer]);

  // Arraste para girar: acompanha o dedo 1:1 e herda a velocidade ao soltar
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !interactive) return;
    let lastX = 0;
    let lastT = 0;
    let startX = 0;
    let startY = 0;
    let decided = false;
    const SENS = 0.011;

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      lastX = startX = e.clientX;
      startY = e.clientY;
      lastT = performance.now();
      decided = e.pointerType === 'mouse';
      pointer.velocity = 0;
      if (decided) {
        pointer.dragging = true;
        stage.setPointerCapture(e.pointerId);
      }
    };
    const move = (e: PointerEvent) => {
      if (cursorRef.current) {
        const r = stage.getBoundingClientRect();
        cursorRef.current.style.transform = `translate3d(${e.clientX - r.left}px, ${e.clientY - r.top}px, 0)`;
      }
      if (!decided && e.buttons) {
        // toque: só gira se o gesto for horizontal; vertical continua rolando a página
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > 8 && dx > dy) {
          decided = true;
          pointer.dragging = true;
          stage.setPointerCapture(e.pointerId);
        } else if (dy > 8) {
          decided = true;
        }
      }
      if (!pointer.dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dt = Math.max(1, now - lastT) / 1000;
      pointer.spin += dx * SENS;
      pointer.velocity = pointer.velocity * 0.6 + ((dx * SENS) / dt) * 0.4;
      lastX = e.clientX;
      lastT = now;
      pointer.invalidate?.();
    };
    const up = (e: PointerEvent) => {
      if (!pointer.dragging) return;
      pointer.dragging = false;
      if (performance.now() - lastT > 80) pointer.velocity = 0;
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      pointer.invalidate?.();
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    return () => {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
    };
  }, [interactive, pointer]);

  return (
    <section id="inicio" ref={sectionRef} className="hero grain" aria-labelledby="hero-title">
      <div className="hero__backdrop" aria-hidden="true">
        <div className="hero__glow" ref={glowRef} />
        <div className="hero__numeral-wrap" data-parallax="-12">
          <div className="hero__numeral tnum" ref={numeralRef}>
            1005
          </div>
        </div>
      </div>

      <div className="hero__layout container">
        <div className="hero__content">
          <p className="eyebrow hero-in" style={{ '--d': 0 } as CSSProperties}>
            Food Street • Burger and Bar
          </p>
          <h1 id="hero-title" className="display hero__title">
            <span className="line"><span>Burger,</span></span>
            <span className="line"><span><em>amigos</em></span></span>
            <span className="line"><span>e bons</span></span>
            <span className="line"><span>momentos.</span></span>
          </h1>
          <p className="lede hero-in" style={{ '--d': 5 } as CSSProperties}>
            Na Augusta, a noite tem sabor. Burgers, drinks e bons momentos no coração de São Paulo.
          </p>
          <div className="hero__ctas hero-in" style={{ '--d': 6 } as CSSProperties}>
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

        <div
          className="hero__stage"
          ref={stageRef}
          data-interactive={interactive || undefined}
          onPointerEnter={() => finePointer && interactive && setCursor(true)}
          onPointerLeave={() => setCursor(false)}
          role="img"
          aria-label={`Ilustração 3D do ${item.name}, montado camada por camada`}
        >
          {use3D ? (
            <Suspense fallback={null}>
              <Hero3D
                pointer={pointer}
                reducedMotion={reducedMotion}
                layout={wide ? 'wide' : 'compact'}
                onReady={() => setInteractive(true)}
                onFail={() => {
                  setUse3D(false);
                  setInteractive(false);
                }}
              />
            </Suspense>
          ) : (
            <HeroPoster />
          )}
          {finePointer ? (
            <div className="drag-cursor" ref={cursorRef} data-visible={cursor || undefined} aria-hidden="true">
              <span>Arraste</span>
            </div>
          ) : null}
          {interactive ? (
            <p className="hero__hint" aria-hidden="true">
              <Icon name="drag" />
              Arraste para girar
            </p>
          ) : null}
        </div>

        <aside className="hero-card hero-in" style={{ '--d': 8 } as CSSProperties} aria-labelledby="hero-card-title">
          <p className="hero-card__label">{getCategoryLabel(item.category)}</p>
          <h2 className="hero-card__name" id="hero-card-title">
            {item.name}
          </h2>
          <p className="hero-card__desc">{item.description}</p>
          <div className="hero-card__prices">
            <Price value={item.price} className="hero-card__price" />
            {item.comboPrice ? (
              <span className="hero-card__combo">
                Combo <Price value={item.comboPrice} />
              </span>
            ) : null}
          </div>
          <a
            className="hero-card__link u-link"
            href="#cardapio"
            onClick={() => selectMenuCategory(item.category)}
          >
            Ver {getCategoryLabel(item.category).toLowerCase()} no cardápio
          </a>
        </aside>
      </div>

      <div className="hero__bar container hero-in" style={{ '--d': 9 } as CSSProperties}>
        <span className="hero__address">
          <Icon name="pin" />
          <span>
            {business.address.street}, {business.address.number}
            <span className="hero__address-sub">
              {business.address.neighborhood} — {business.address.city}
            </span>
          </span>
        </span>
        <TodayLine />
        <span className="hero__city signage">São Paulo • SP</span>
      </div>

      <p className="hero__vertical signage" aria-hidden="true">
        Augusta → Since 2016 — SP / BR
      </p>
    </section>
  );
}
