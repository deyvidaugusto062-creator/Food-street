import { useEffect, useState, type RefObject } from 'react';

/**
 * true enquanto o elemento estiver (perto de estar) na tela.
 * Com `once`, fica true depois da primeira vez.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '0px', once = false): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (once) {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
        return;
      }
      setInView(entry.isIntersecting);
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, once]);
  return inView;
}
