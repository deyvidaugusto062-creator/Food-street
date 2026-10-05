/**
 * Modelo de dados de uma armação.
 * O mesmo formato serve para o catálogo local (src/data/products.ts) e para uma futura API
 * (src/services/catalog.ts) — os componentes só conhecem este tipo.
 */

export type FrameShape = 'redondo' | 'quadrado' | 'retangular' | 'gatinho' | 'oval' | 'aviador' | 'hexagonal';
export type RimType = 'aro-fechado' | 'meio-aro' | 'sem-aro';
export type Availability = 'disponivel' | 'sob-encomenda' | 'esgotado' | 'consultar';

export interface ProductPhoto {
  /**
   * Caminho da foto. Sem extensão (ex.: '/images/produtos/foto') o site usa as versões
   * .avif e .webp geradas por `npm run images`. Com extensão (ex.: URL de uma API) usa o arquivo direto.
   */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** packshot = produto isolado, modelo = foto no rosto, detalhe = recorte aproximado */
  kind?: 'packshot' | 'modelo' | 'detalhe';
}

export interface Product {
  id: string;
  /** Usado na URL: /armacoes/?produto=<slug> */
  slug: string;
  name: string;
  /** Código/modelo do fabricante — null quando não informado */
  model: string | null;
  /** Marca — preencher SOMENTE quando confirmada pela ótica */
  brand: string | null;
  shortDescription: string;
  description: string;
  /** Preço em reais (49.9 = R$ 49,90). null = "Preço sob consulta" */
  price: number | null;
  color: { name: string; hex: string };
  shape: FrameShape;
  rim: RimType;
  /** Material — null quando não confirmado */
  material: string | null;
  /** Medidas em mm (lente, ponte, haste), quando informadas */
  measurements: { lens?: number; bridge?: number; temple?: number } | null;
  availability: Availability;
  images: ProductPhoto[];
  /** Informações adicionais em lista */
  details?: string[];
  /** Aparece em "Armações em destaque" na página inicial */
  featured?: boolean;
  /** Produto demonstrativo — exibe o selo e o aviso para substituir pelo catálogo oficial */
  demo?: boolean;
  /** Futuro: caminho de um modelo .glb da armação (ativa a aba "3D" no produto) */
  model3d?: string;
  /** Futuro: sequência de fotos 360° (ativa o giro arrastando) */
  spin360?: string[];
}

export const SHAPE_LABEL: Record<FrameShape, string> = {
  redondo: 'Redondo',
  quadrado: 'Quadrado',
  retangular: 'Retangular',
  gatinho: 'Gatinho',
  oval: 'Oval',
  aviador: 'Aviador',
  hexagonal: 'Hexagonal',
};

export const RIM_LABEL: Record<RimType, string> = {
  'aro-fechado': 'Aro fechado',
  'meio-aro': 'Meio aro',
  'sem-aro': 'Sem aro (parafusada)',
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  disponivel: 'Disponível na loja',
  'sob-encomenda': 'Sob encomenda',
  esgotado: 'Indisponível no momento',
  consultar: 'Consultar disponibilidade',
};
