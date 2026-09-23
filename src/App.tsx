import { Header } from './components/Header/Header';
import { Hero } from './components/Hero/Hero';
import { FeaturedProducts } from './components/FeaturedProducts/FeaturedProducts';
import { Menu } from './components/Menu/Menu';
import { Manifesto } from './components/Manifesto/Manifesto';
import { StreetBand } from './components/StreetBand/StreetBand';
import { Gallery } from './components/Gallery/Gallery';
import { Reviews } from './components/Reviews/Reviews';
import { About } from './components/About/About';
import { Location } from './components/Location/Location';
import { CTA } from './components/CTA/CTA';
import { Footer } from './components/Footer/Footer';
import { useScrollAnimations } from './hooks/useScrollAnimations';

export function App() {
  useScrollAnimations();
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <Hero />
        <FeaturedProducts />
        <Menu />
        <Manifesto />
        <StreetBand />
        <Gallery />
        <Reviews />
        <About />
        <Location />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
