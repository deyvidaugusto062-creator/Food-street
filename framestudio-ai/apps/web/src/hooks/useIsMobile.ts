import { useEffect, useState } from 'react';

const query = '(max-width: 820px), (pointer: coarse) and (max-width: 1100px)';

/** Interface móvel dedicada em telas pequenas ou dispositivos touch compactos. */
export function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
