import { boot } from './boot';
import { AppShell } from '../components/layout/AppShell';
import { Shop } from '../components/shop/Shop';
import '../components/products/ProductCard.css';
import '../components/sections/sections.css';

boot(
  <AppShell page="loja">
    <Shop />
  </AppShell>,
);
