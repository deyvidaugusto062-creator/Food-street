import type { Product } from '../types/product';

/**
 * CATÁLOGO DE ARMAÇÕES — fonte única dos produtos do site.
 *
 * ⚠️ Todos os itens abaixo são DEMONSTRATIVOS (demo: true): nomes, preços e disponibilidade
 * são ilustrativos e servem apenas para testar o layout, filtros e carrinho.
 * Substituir pelo catálogo oficial da Ótica Vetor antes da publicação.
 *
 * Como editar:
 *  - Adicionar: copie um bloco, troque `id` e `slug` (únicos, sem espaços) e os dados.
 *  - Remover: apague o bloco.
 *  - Preço: use ponto decimal (289.9 = R$ 289,90). Use `null` para "Preço sob consulta".
 *  - Fotos: veja o README (pasta assets-src/produtos + `npm run images`).
 *  - Disponibilidade: 'disponivel' | 'sob-encomenda' | 'esgotado' | 'consultar'.
 *  - Marca e material: preencher somente quando confirmados (senão, null).
 */

const img = (name: string, alt: string, width = 447, height = 447, kind: 'packshot' | 'modelo' | 'detalhe' = 'packshot') => ({
  src: `/images/produtos/${name}`,
  alt,
  width,
  height,
  kind,
});

export const products: Product[] = [
  {
    id: 'demo-01',
    slug: 'demo-01-redonda-azul-translucida',
    name: 'Redonda Azul Translúcida',
    model: null,
    brand: null,
    shortDescription: 'Formato redondo, frente azul translúcida e hastes em tom amadeirado.',
    description:
      'Armação de formato redondo com frente em azul translúcido e hastes com acabamento em tom amadeirado. Ponte em formato de “buraco de fechadura”, que dá um ar clássico ao rosto.',
    price: 289.9,
    color: { name: 'Azul translúcido', hex: '#4A6491' },
    shape: 'redondo',
    rim: 'aro-fechado',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-01-redonda-azul', 'Armação redonda azul translúcida com hastes em tom amadeirado, vista em ângulo'),
      img('demo-01-redonda-azul-detalhe', 'Detalhe da junção entre a frente azul e a haste amadeirada', 230, 175, 'detalhe'),
    ],
    details: ['Frente translúcida', 'Hastes em tom amadeirado', 'Ponte estilo buraco de fechadura'],
    featured: true,
    demo: true,
  },
  {
    id: 'demo-02',
    slug: 'demo-02-redonda-metal-preta',
    name: 'Redonda Metal Preta',
    model: null,
    brand: null,
    shortDescription: 'Aro redondo fino em metal preto, leve e discreto.',
    description:
      'Armação redonda de aro fino na cor preta, com ponte fina. Um desenho minimalista que funciona no dia a dia e em ocasiões mais formais.',
    price: 249.9,
    color: { name: 'Preto', hex: '#1E2124' },
    shape: 'redondo',
    rim: 'aro-fechado',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-02-redonda-metal-preta', 'Homem usando armação redonda de aro fino preto', 447, 447, 'modelo'),
      img('demo-02-redonda-metal-preta-detalhe', 'Detalhe da armação redonda preta no rosto', 240, 130, 'detalhe'),
    ],
    details: ['Aro fino', 'Ponte fina'],
    demo: true,
  },
  {
    id: 'demo-03',
    slug: 'demo-03-gatinho-sem-aro-dourada',
    name: 'Gatinho Sem Aro Dourada',
    model: null,
    brand: null,
    shortDescription: 'Lentes parafusadas em formato gatinho com ponte e hastes douradas.',
    description:
      'Armação sem aro (parafusada) com lentes em formato gatinho, ponte e hastes finas em tom dourado e ponteiras escuras. Visual leve, quase invisível no rosto.',
    price: 379.9,
    color: { name: 'Dourado', hex: '#C8A96B' },
    shape: 'gatinho',
    rim: 'sem-aro',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-03-gatinho-sem-aro', 'Armação sem aro em formato gatinho com hastes douradas, vista de cima'),
      img('demo-03-gatinho-sem-aro-detalhe', 'Detalhe da ponte dourada e das plaquetas da armação sem aro', 230, 150, 'detalhe'),
    ],
    details: ['Sem aro (lentes parafusadas)', 'Hastes finas', 'Ponteiras escuras'],
    featured: true,
    demo: true,
  },
  {
    id: 'demo-04',
    slug: 'demo-04-quadrada-preta',
    name: 'Quadrada Preta',
    model: null,
    brand: null,
    shortDescription: 'Frente quadrada com aro encorpado em preto brilhante.',
    description:
      'Armação quadrada de aro encorpado em preto brilhante, com cantos suavizados. Presença marcante e proporções equilibradas para quem gosta de óculos com personalidade.',
    price: 319.9,
    color: { name: 'Preto', hex: '#121314' },
    shape: 'quadrado',
    rim: 'aro-fechado',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-04-quadrada-preta', 'Armação quadrada preta vista de frente', 547, 365),
      img('demo-04-quadrada-preta-detalhe', 'Detalhe do aro encorpado da armação quadrada preta', 257, 270, 'detalhe'),
    ],
    details: ['Aro encorpado', 'Acabamento brilhante', 'Cantos suavizados'],
    featured: true,
    demo: true,
  },
  {
    id: 'demo-05',
    slug: 'demo-05-retangular-cristal',
    name: 'Retangular Cristal',
    model: null,
    brand: null,
    shortDescription: 'Retangular transparente, leve no visual e fácil de combinar.',
    description:
      'Armação retangular totalmente transparente (cristal), com hastes no mesmo tom. Combina com qualquer cor de roupa e deixa o rosto em evidência.',
    price: 269.9,
    color: { name: 'Cristal', hex: '#DCE5E7' },
    shape: 'retangular',
    rim: 'aro-fechado',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-05-retangular-cristal', 'Armação retangular transparente vista de frente'),
      img('demo-05-retangular-cristal-detalhe', 'Detalhe da dobradiça da armação transparente', 197, 190, 'detalhe'),
    ],
    details: ['Frente transparente', 'Hastes transparentes'],
    featured: true,
    demo: true,
  },
  {
    id: 'demo-06',
    slug: 'demo-06-redonda-metal-dourada',
    name: 'Redonda Metal Dourada',
    model: null,
    brand: null,
    shortDescription: 'Redonda de aro fino dourado, delicada e luminosa.',
    description:
      'Armação redonda de aro fino em tom dourado claro. Ilumina o rosto e traz um toque retrô ao visual.',
    price: 259.9,
    color: { name: 'Dourado', hex: '#D9B98E' },
    shape: 'redondo',
    rim: 'aro-fechado',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-06-redonda-metal-dourada', 'Mulher usando armação redonda de aro fino dourado', 315, 419, 'modelo'),
      img('demo-06-redonda-metal-dourada-detalhe', 'Detalhe da armação redonda dourada no rosto', 185, 110, 'detalhe'),
    ],
    details: ['Aro fino', 'Tom dourado claro'],
    demo: true,
  },
  {
    id: 'demo-07',
    slug: 'demo-07-meio-aro-prata',
    name: 'Meio Aro Prata',
    model: null,
    brand: null,
    shortDescription: 'Retangular meio aro em prata, com fio na parte inferior.',
    description:
      'Armação retangular de meio aro em tom prata: aro superior em metal e lentes presas por fio na parte inferior. Visual executivo e leve, com plaquetas.',
    price: 339.9,
    color: { name: 'Prata', hex: '#A9ADB1' },
    shape: 'retangular',
    rim: 'meio-aro',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-07-meio-aro-prata', 'Armação retangular meio aro prata vista de frente'),
      img('demo-07-meio-aro-prata-detalhe', 'Detalhe da ponte e das plaquetas da armação meio aro', 210, 160, 'detalhe'),
    ],
    details: ['Meio aro (fio inferior)', 'Com plaquetas', 'Hastes com ponteiras estampadas'],
    demo: true,
  },
  {
    id: 'demo-08',
    slug: 'demo-08-retangular-preta-fosca',
    name: 'Retangular Preta Fosca',
    model: null,
    brand: null,
    shortDescription: 'Retangular de linhas retas em preto fosco, hastes largas.',
    description:
      'Armação retangular em preto fosco com hastes largas e linhas retas. Um desenho contemporâneo e sóbrio, pensado para o uso diário.',
    price: 229.9,
    color: { name: 'Preto fosco', hex: '#24272C' },
    shape: 'retangular',
    rim: 'aro-fechado',
    material: null,
    measurements: null,
    availability: 'consultar',
    images: [
      img('demo-08-retangular-preta-fosca', 'Armação retangular preta fosca vista em ângulo'),
      img('demo-08-retangular-preta-fosca-detalhe', 'Detalhe da haste larga da armação preta fosca', 220, 190, 'detalhe'),
    ],
    details: ['Acabamento fosco', 'Hastes largas'],
    demo: true,
  },
];
