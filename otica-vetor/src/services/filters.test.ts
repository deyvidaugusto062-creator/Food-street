import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types/product';
import { applyFilters, buildFacets, emptyFilters, filtersFromParams, filtersToParams, priceBounds } from './filters.ts';

const base = (over: Partial<Product>): Product => ({
  id: 'x',
  slug: 'x',
  name: 'X',
  model: null,
  brand: null,
  shortDescription: '',
  description: '',
  price: 100,
  color: { name: 'Preto', hex: '#000' },
  shape: 'redondo',
  rim: 'aro-fechado',
  material: null,
  measurements: null,
  availability: 'consultar',
  images: [],
  ...over,
});

const catalog: Product[] = [
  base({ id: 'a', name: 'Redonda Ótima', price: 300, color: { name: 'Dourado', hex: '#c90' } }),
  base({ id: 'b', name: 'Quadrada', shape: 'quadrado', price: 200 }),
  base({ id: 'c', name: 'Sem preço', shape: 'quadrado', price: null }),
];

test('busca ignora acentos e caixa', () => {
  const r = applyFilters(catalog, { ...emptyFilters(), query: 'OTIMA' });
  assert.deepEqual(r.map((p) => p.id), ['a']);
});

test('filtros só aparecem com 2+ opções', () => {
  const keys = buildFacets(catalog).map((f) => f.key);
  assert.ok(keys.includes('shape'));
  assert.ok(keys.includes('color'));
  assert.ok(!keys.includes('brand')); // nenhum produto com marca
  assert.ok(!keys.includes('availability')); // todos "consultar"
});

test('filtro por formato e faixa de preço', () => {
  const r = applyFilters(catalog, { ...emptyFilters(), selected: { shape: ['quadrado'] }, price: [150, 250] });
  assert.deepEqual(r.map((p) => p.id), ['b']);
});

test('ordenação por preço deixa "sob consulta" no fim', () => {
  const r = applyFilters(catalog, { ...emptyFilters(), sort: 'menor-preco' });
  assert.deepEqual(r.map((p) => p.id), ['b', 'a', 'c']);
});

test('limites de preço ignoram null', () => {
  assert.deepEqual(priceBounds(catalog), [200, 300]);
});

test('ida e volta pela URL', () => {
  const state = { ...emptyFilters(), query: 'preta', selected: { shape: ['redondo', 'gatinho'] }, price: [100, 200] as [number, number], sort: 'nome' as const };
  assert.deepEqual(filtersFromParams(filtersToParams(state)), state);
});
