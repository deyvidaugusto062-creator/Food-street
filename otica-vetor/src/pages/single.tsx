/**
 * Entrada da versão de arquivo único (npm run build:single).
 * Junta início e loja num só HTML: a loja fica em #/armacoes.
 */
import { useEffect, useState } from 'react';
import { boot } from './boot';
import { AppShell } from '../components/layout/AppShell';
import { Hero } from '../components/hero/Hero';
import { Featured } from '../components/sections/Featured';
import { About } from '../components/sections/About';
import { Differentials } from '../components/sections/Differentials';
import { Gallery } from '../components/sections/Gallery';
import { Faq } from '../components/sections/Faq';
import { Location } from '../components/sections/Location';
import { Contact } from '../components/sections/Contact';
import { Shop } from '../components/shop/Shop';
import '../components/products/ProductCard.css';
import '../components/sections/sections.css';

const isShop = () => location.hash.startsWith('#/armacoes');

function SingleFileSite() {
  const [shop, setShop] = useState(isShop);

  useEffect(() => {
    const onHash = () => setShop(isShop());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // ao trocar de "página", vai para o topo ou para a seção do link (#sobre, #contato…)
  useEffect(() => {
    document.title = shop ? 'Comprar armações | Ótica Vetor — São Paulo' : 'Ótica Vetor | Ótica no Jardim Prudência, São Paulo';
    const id = location.hash.slice(1);
    const target = !shop && id ? document.getElementById(id) : null;
    requestAnimationFrame(() => (target ? target.scrollIntoView() : scrollTo(0, 0)));
  }, [shop]);

  return (
    <AppShell page={shop ? 'loja' : 'home'}>
      {shop ? (
        <Shop />
      ) : (
        <>
          <Hero />
          <Featured />
          <About />
          <Differentials />
          <Gallery />
          <Faq />
          <Location />
          <Contact />
        </>
      )}
    </AppShell>
  );
}

boot(<SingleFileSite />);
