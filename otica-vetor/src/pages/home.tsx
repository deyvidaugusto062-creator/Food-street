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
import '../components/products/ProductCard.css';
import '../components/sections/sections.css';

boot(
  <AppShell page="home">
    <Hero />
    <Featured />
    <About />
    <Differentials />
    <Gallery />
    <Faq />
    <Location />
    <Contact />
  </AppShell>,
);
