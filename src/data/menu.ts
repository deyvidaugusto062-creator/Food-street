/**
 * CARDÁPIO — Food Street Augusta
 *
 * Para alterar um preço, edite o campo `price` (ou `comboPrice`) do item.
 * Valores em reais, com ponto decimal: 49.9 = R$ 49,90.
 *
 * `needsConfirmation: true` marca itens cujo dado ainda precisa ser confirmado
 * pela casa (preço conflitante, combo duvidoso, preço sem produto definido).
 * No site: sem `price` aparece "Valor a confirmar"; burger sem `comboPrice`
 * aparece "Combo a confirmar"; a Linha Street traz um aviso no grupo.
 * Depois de confirmar, corrija o dado e remova `needsConfirmation` e `confirmationNote`.
 */

export type CategoryId =
  | 'destaques'
  | 'entradas'
  | 'burgers'
  | 'tunados'
  | 'street'
  | 'doubles'
  | 'bebidas'
  | 'sobremesas';

export type ItemCategory = Exclude<CategoryId, 'destaques'>;

export interface MenuItem {
  id: string;
  name: string;
  category: ItemCategory;
  /** Preço do item sozinho */
  price?: number;
  /** Preço do combo, quando houver */
  comboPrice?: number;
  /** Preço com batata (linha Street) */
  withFriesPrice?: number;
  description?: string;
  /** Frase curta de apoio, exibida em itálico */
  note?: string;
  /** Foto real do produto (ex.: '/images/burgers/king-brooklyn.webp'). Tem prioridade sobre a ilustração. */
  image?: string;
  /**
   * Ilustração 3D gerada a partir da receita em `stacks.ts`
   * (npm run render:burgers). Sempre identificada como ilustração no site.
   */
  render?: string;
  featured?: boolean;
  /** Subgrupo dentro da categoria */
  group?: string;
  needsConfirmation?: boolean;
  /** Explica o que falta confirmar (não aparece no site) */
  confirmationNote?: string;
}

export interface MenuCategory {
  id: CategoryId;
  label: string;
  intro?: string;
}

export const categories: MenuCategory[] = [
  { id: 'destaques', label: 'Destaques', intro: 'Os pedidos que abrem a noite.' },
  { id: 'entradas', label: 'Entradas', intro: 'Para dividir enquanto o burger sai da chapa.' },
  { id: 'burgers', label: 'Burgers', intro: 'Burger de 180g, no pão brioche ou no pão preto.' },
  { id: 'tunados', label: 'Tunados', intro: 'Mais carne, mais queijo, mais fome.' },
  { id: 'street', label: 'Street' },
  { id: 'doubles', label: 'Doubles' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'sobremesas', label: 'Sobremesas' },
];

export const menu: MenuItem[] = [
  /* ───────────── ENTRADAS ───────────── */
  {
    id: 'batata-palito',
    name: 'Batata Palito',
    category: 'entradas',
    price: 31.9,
    description: '500g de batata palito crocante.',
  },
  {
    id: 'batata-crinkle',
    name: 'Batata Crinkle',
    category: 'entradas',
    price: 36.9,
    description:
      'Batata crinkle temperada com Lemon Pepper, alho e alecrim. Acompanha maionese de manjericão.',
  },
  {
    id: 'batata-cheddar-bacon',
    name: 'Batata com Cheddar e Bacon',
    category: 'entradas',
    price: 68.9,
    description: '500g de batata palito, cheddar e bacon.',
  },
  {
    id: 'onion-rings',
    name: 'Onion Rings',
    category: 'entradas',
    price: 35.9,
    description: 'Anéis de cebola empanados e crocantes. Acompanha barbecue de cerveja.',
  },
  {
    id: 'chicken-crazy',
    name: 'Chicken Crazy',
    category: 'entradas',
    price: 58.9,
    description:
      'Pedaços de frango marinados no limão e pimenta-do-reino, empanados e crocantes. Acompanha maionese defumada e barbecue de cerveja.',
  },
  {
    id: 'trio-salgados',
    name: 'Trio de Salgados',
    category: 'entradas',
    price: 33.9,
    description: '1 coxinha, 1 bolinha de queijo e 1 croquete de carne. Acompanha maionese de alho.',
  },

  /* ───────────── BURGERS ───────────── */
  {
    id: 'food-street',
    name: 'Food Street',
    category: 'burgers',
    price: 45.9,
    comboPrice: 64.9,
    description: 'Burger de 180g, mussarela, picles e maionese de alho no pão brioche.',
  },
  {
    id: 'subway',
    name: 'Subway',
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, mussarela, picles, rúcula, bacon e maionese defumada no pão brioche.',
  },
  {
    id: 'blt',
    name: 'BLT',
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, cheddar, bacon, alface, tomate e maionese de manjericão no pão preto.',
  },
  {
    id: 'mcn',
    name: 'MCN',
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, mussarela, cheddar, bacon, barbecue de cerveja e maionese defumada no pão brioche.',
  },
  {
    id: 'rappa',
    name: 'Rappa',
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, cheddar, bacon, cebola caramelizada e maionese de manjericão no pão preto.',
  },
  {
    id: 'cheese-burger',
    name: 'Cheese Burger',
    category: 'burgers',
    price: 38.9,
    comboPrice: 57.9,
    description: 'Burger de 180g, mussarela e maionese de alho no pão brioche.',
    note: 'O clássico bem-feito.',
  },
  {
    id: 'cheese-salada',
    name: 'Cheese Salada',
    category: 'burgers',
    price: 45.9,
    comboPrice: 64.9,
    description:
      'Burger de 180g, mussarela, alface, tomate, cebola roxa e maionese de manjericão no pão brioche.',
  },
  {
    id: 'augustas',
    name: "Augusta's",
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, mussarela, bacon, onion rings e barbecue de cerveja no pão preto.',
  },
  {
    id: 'station',
    name: 'Station',
    category: 'burgers',
    price: 49.9,
    description:
      'Burger de 180g, cheddar, ovo com gema mole, alface, tomate e maionese de manjericão no pão brioche.',
    needsConfirmation: true,
    confirmationNote:
      'O material original tem uma possível inconsistência no preço do combo. Informe o valor do combo em `comboPrice` após confirmar.',
  },
  {
    id: 'cheese-egg-bacon',
    name: 'Cheese Egg Bacon',
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, mussarela, cheddar, bacon, ovo com gema mole e maionese de manjericão no pão brioche.',
  },
  {
    id: 'brooklyn-pickles',
    name: 'Brooklyn Pickles',
    category: 'burgers',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Burger de 180g, cheddar, cebola roxa picada, ketchup, bacon, picles e maionese defumada no pão preto.',
  },
  {
    id: 'poseidon',
    name: 'Poseidon Burger',
    category: 'burgers',
    description: 'Burger de porco, camarão, vinagrete de maxixe e rúcula.',
    image: '/images/burgers/poseidon.webp',
    featured: true,
    needsConfirmation: true,
    confirmationNote:
      'Item do post "Raio-X do burger" (Instagram), sem preço no material. Preencha `price` e `comboPrice`.',
  },

  /* ───────────── TUNADOS ───────────── */
  {
    id: 'the-king-brooklyn',
    name: 'The King Brooklyn',
    category: 'tunados',
    price: 69.9,
    comboPrice: 85,
    description:
      'Três smashes de 90g, cheddar, mussarela, bacon, picles, onion rings e barbecue de cerveja no pão preto.',
  },
  {
    id: 'food-street-2-0',
    name: 'Food Street 2.0',
    category: 'tunados',
    price: 69.9,
    comboPrice: 85,
    description:
      '2 burgers de 180g, cheddar, mussarela, tomate, picles e maionese de alho no pão brioche.',
  },
  {
    id: 'crazy-cheddar',
    name: 'Crazy Cheddar',
    category: 'tunados',
    price: 78.9,
    description: 'Burger de 180g coberto com muito cheddar, 500g de batata palito e bacon.',
  },
  {
    id: 'the-boss',
    name: 'The Boss',
    category: 'tunados',
    price: 69.9,
    comboPrice: 85,
    description:
      'Três smashes de 90g, mussarela, bacon, cebola roxa e maionese defumada no pão brioche.',
  },

  /* ───────────── STREET ───────────── */
  {
    id: 'street-chicken',
    name: 'Street Chicken',
    category: 'street',
    group: 'Street Chicken',
    price: 49.9,
    comboPrice: 69.9,
    description:
      'Sobrecoxa de frango empanada, cheddar, tomate, barbecue e maionese de alho no pão brioche.',
  },

  /*
   * LINHA STREET (smash 90g)
   * Estes valores vieram de outra parte do material fornecido e podem ser
   * de outro período/cardápio. Mantidos separados da tabela principal até
   * a casa confirmar se estão vigentes.
   */
  {
    id: 'street-cheese-burger',
    name: 'Cheese Burger',
    category: 'street',
    group: 'Linha Street',
    price: 18,
    withFriesPrice: 27,
    description: 'Pão brioche, smash 90g, mussarela e maionese de alho.',
    image: '/images/burgers/street-cheese-burger.webp',
    featured: true,
    needsConfirmation: true,
    confirmationNote: 'Preço de outra versão do cardápio. Confirmar se está vigente.',
  },
  {
    id: 'street-brooklyn-burger',
    name: 'Brooklyn Burger',
    category: 'street',
    group: 'Linha Street',
    price: 18,
    withFriesPrice: 27,
    description: 'Pão preto, smash 90g, cheddar e barbecue.',
    image: '/images/burgers/street-brooklyn-burger.webp',
    featured: true,
    needsConfirmation: true,
    confirmationNote: 'Preço de outra versão do cardápio. Confirmar se está vigente.',
  },
  {
    id: 'street-pc-burger',
    name: 'PC Burger',
    category: 'street',
    group: 'Linha Street',
    price: 23,
    withFriesPrice: 32,
    description: 'Pão preto, dois smashes de 90g e maionese de manjericão.',
    image: '/images/burgers/street-pc-burger.webp',
    featured: true,
    needsConfirmation: true,
    confirmationNote: 'Preço de outra versão do cardápio. Confirmar se está vigente.',
  },
  {
    id: 'street-bacon',
    name: 'Street Bacon',
    category: 'street',
    group: 'Linha Street',
    price: 23,
    withFriesPrice: 32,
    description: 'Pão brioche, smash 90g, mussarela, bacon e maionese defumada.',
    image: '/images/burgers/street-bacon.webp',
    featured: true,
    needsConfirmation: true,
    confirmationNote: 'Preço de outra versão do cardápio. Confirmar se está vigente.',
  },
  {
    id: 'street-dog',
    name: 'Street Dog',
    category: 'street',
    group: 'Linha Street',
    price: 16,
    withFriesPrice: 25,
    description: 'Pão brioche, duas salsichas, ketchup, maionese, mostarda e alface.',
    image: '/images/burgers/street-dog.webp',
    featured: true,
    needsConfirmation: true,
    confirmationNote: 'Preço de outra versão do cardápio. Confirmar se está vigente.',
  },

  /* ───────────── DOUBLES ───────────── */
  { id: 'double-coxinha', name: 'Double Coxinha', category: 'doubles', price: 15 },
  { id: 'double-croquete', name: 'Double Croquete de Carne', category: 'doubles', price: 15 },
  { id: 'double-bolinha-queijo', name: 'Double Bolinha de Queijo', category: 'doubles', price: 15 },
  { id: 'double-caipirinha', name: 'Double Caipirinha', category: 'doubles', price: 15 },
  { id: 'double-gin', name: 'Double Gin', category: 'doubles', price: 25 },

  /* ───────────── BEBIDAS ───────────── */
  { id: 'cha-mate-refil', name: 'Chá Mate Refil', category: 'bebidas', price: 18 },

  /* ───────────── SOBREMESAS ─────────────
   * O material informa três valores (R$ 16,00, R$ 24,00 e R$ 35,00) sem deixar
   * claro qual pertence a cada sobremesa. Os preços ficam sem exibição até a
   * confirmação — veja DESSERT_PRICES_TO_ASSIGN abaixo.
   */
  {
    id: 'pudim',
    name: 'Pudim de leite artesanal',
    category: 'sobremesas',
    needsConfirmation: true,
    confirmationNote: 'Preço não associado com certeza. Opções informadas: 16, 24 ou 35.',
  },
  {
    id: 'vaka-loka',
    name: 'Vaka-Loka',
    category: 'sobremesas',
    needsConfirmation: true,
    confirmationNote: 'Preço não associado com certeza. Opções informadas: 16, 24 ou 35.',
  },
  {
    id: 'bolo-chocolate',
    name: 'Bolo de chocolate com calda',
    category: 'sobremesas',
    needsConfirmation: true,
    confirmationNote: 'Preço não associado com certeza. Opções informadas: 16, 24 ou 35.',
  },
];

/** Valores informados para as sobremesas, ainda sem produto associado. Não exibidos no site. */
export const DESSERT_PRICES_TO_ASSIGN = [16, 24, 35] as const;

/** Ordem dos destaques (seção "Escolha o seu favorito" e aba Destaques) */
export const featuredOrder = [
  'poseidon',
  'street-bacon',
  'street-pc-burger',
  'street-brooklyn-burger',
  'street-cheese-burger',
  'street-dog',
];

/**
 * Item exibido no card do hero. Com o burger 3D (HERO_PHOTO vazio em
 * src/config/scene.ts), use o mesmo burger de HERO_STACK_ID.
 */
export const heroItemId = 'poseidon';

export function getItem(id: string): MenuItem | undefined {
  return menu.find((item) => item.id === id);
}

/** Itens com `featured: true`, na ordem de `featuredOrder` (os demais vão ao fim) */
export function getFeatured(): MenuItem[] {
  const rank = (id: string) => {
    const i = featuredOrder.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return menu.filter((item) => item.featured).sort((a, b) => rank(a.id) - rank(b.id));
}

export function getCategoryItems(id: CategoryId): MenuItem[] {
  if (id === 'destaques') return getFeatured();
  return menu.filter((item) => item.category === id);
}

export function getCategoryLabel(id: ItemCategory): string {
  return categories.find((c) => c.id === id)?.label ?? id;
}
