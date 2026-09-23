import { useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, CustomEase);

// mesma curva do CSS (--ease-out)
const EASE_OUT = CustomEase.create('fsOut', '0.25,0.46,0.45,0.94');

/**
 * Revelações e profundidade no scroll, declaradas por atributos:
 *  [data-reveal-lines] → títulos linha por linha (máscara)
 *  [data-reveal]       → opacidade + translateY
 *  [data-reveal-group] → filhos em sequência
 *  [data-reveal-clip]  → revelação por clip-path
 *  [data-parallax="-12"] → yPercent durante a passagem da seção
 * Tudo é desligado com prefers-reduced-motion.
 */
export function useScrollAnimations() {
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray<HTMLElement>('[data-reveal-lines]').forEach((el) => {
        gsap.from(el.querySelectorAll('.line > span'), {
          yPercent: 106,
          duration: 0.6,
          ease: EASE_OUT,
          stagger: 0.07,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 18,
          duration: 0.5,
          ease: EASE_OUT,
          delay: 0.12,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((el) => {
        gsap.from(el.children, {
          autoAlpha: 0,
          y: 14,
          duration: 0.5,
          ease: EASE_OUT,
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      });

      ScrollTrigger.batch('[data-reveal-clip]', {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { clipPath: 'inset(18% 0% 0% 0% round 6px)', autoAlpha: 0 },
            { clipPath: 'inset(0% 0% 0% 0% round 6px)', autoAlpha: 1, duration: 0.6, ease: EASE_OUT, stagger: 0.08 },
          ),
      });

      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
        const amount = Number(el.dataset.parallax) || -10;
        gsap.fromTo(
          el,
          { yPercent: -amount / 2 },
          {
            yPercent: amount / 2,
            ease: 'none',
            scrollTrigger: {
              trigger: el.closest('section') ?? el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
    });

    // o cardápio muda de altura ao trocar de aba
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('foodstreet:layout', refresh);
    // fontes carregadas mudam a altura dos títulos
    document.fonts?.ready.then(refresh);

    return () => {
      window.removeEventListener('foodstreet:layout', refresh);
      mm.revert();
    };
  }, []);
}
