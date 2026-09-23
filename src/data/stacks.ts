/**
 * RECEITAS 3D — usadas para montar o burger do hero e gerar as ilustrações
 * dos cards (npm run render:burgers).
 *
 * As camadas vão de baixo para cima, entre o pão de baixo e o pão de cima,
 * e seguem os ingredientes descritos no cardápio. São ilustrações, não fotos.
 */

export type Bun = 'brioche' | 'preto';

export type LayerKind =
  | 'patty' // burger 180g
  | 'smash' // smash 90g
  | 'chicken'
  | 'cheddar'
  | 'mozzarella'
  | 'bacon'
  | 'pickles'
  | 'onion-rings'
  | 'red-onion'
  | 'minced-onion'
  | 'caramelized-onion'
  | 'lettuce'
  | 'arugula'
  | 'tomato'
  | 'egg'
  | 'bbq'
  | 'mayo'
  | 'ketchup';

export interface Stack {
  bun: Bun;
  layers: LayerKind[];
}

export const stacks: Record<string, Stack> = {
  'the-king-brooklyn': {
    bun: 'preto',
    layers: ['smash', 'cheddar', 'smash', 'mozzarella', 'smash', 'cheddar', 'bacon', 'pickles', 'onion-rings', 'bbq'],
  },
  'food-street-2-0': {
    bun: 'brioche',
    layers: ['mayo', 'patty', 'cheddar', 'patty', 'mozzarella', 'tomato', 'pickles', 'mayo'],
  },
  'the-boss': {
    bun: 'brioche',
    layers: ['mayo', 'smash', 'mozzarella', 'smash', 'mozzarella', 'smash', 'mozzarella', 'bacon', 'red-onion'],
  },
  'street-chicken': {
    bun: 'brioche',
    layers: ['mayo', 'chicken', 'cheddar', 'tomato', 'bbq'],
  },
  augustas: {
    bun: 'preto',
    layers: ['patty', 'mozzarella', 'bacon', 'onion-rings', 'bbq'],
  },
  'brooklyn-pickles': {
    bun: 'preto',
    layers: ['mayo', 'patty', 'cheddar', 'bacon', 'pickles', 'minced-onion', 'ketchup'],
  },
};
