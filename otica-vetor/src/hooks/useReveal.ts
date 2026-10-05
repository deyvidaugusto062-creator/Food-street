import { useEffect } from 'react';
import { prefersReducedMotion } from '../utils/perf';

/**
 * Revela elementos [data-reveal] quando entram na tela. Um único IntersectionObserver
 * para a página toda; novos elementos (ex.: resultados filtrados) são observados via MutationObserver.
 * `data-reveal-stagger` no pai escalona os filhos.
 */
export function useReveal() {
  useEffect(() => {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const root = document.documentElement;
    root.classList.add('js-reveal');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // revela também o que ficou para trás (ex.: salto direto por um link do menu)
          if (!entry.isIntersecting && entry.boundingClientRect.top > 0) continue;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    const seen = new WeakSet<Element>();
    const scan = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const parent = el.parentElement?.closest<HTMLElement>('[data-reveal-stagger]');
        if (parent) {
          const siblings = [...parent.querySelectorAll(':scope [data-reveal]')];
          const i = siblings.indexOf(el);
          el.style.setProperty('--reveal-delay', `${Math.min(i, 8) * 70}ms`);
        }
        io.observe(el);
      });
    };

    scan(document);
    const mo = new MutationObserver(() => scan(document));
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}
