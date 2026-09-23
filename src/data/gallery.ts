/**
 * GALERIA — "Noite na Augusta"
 *
 * Tiles do tipo 'photo' são espaços reservados para fotografias reais da casa.
 * Para publicar uma foto: coloque o arquivo em /public/images/gallery/
 * e preencha `src` (ex.: '/images/gallery/salao-noite.webp') e `alt`.
 * Enquanto `src` estiver vazio, o tile mostra um espaço reservado discreto.
 *
 * Use somente fotos autorizadas pela casa.
 */

export type GalleryShape = 'tall' | 'wide' | 'square';

export type GalleryTile =
  | { id: string; kind: 'photo'; category: string; alt: string; src?: string; shape: GalleryShape }
  | { id: string; kind: 'render'; itemId: string; shape: GalleryShape }
  | { id: string; kind: 'type'; lines: string[]; caption: string; shape: GalleryShape };

export const gallery: GalleryTile[] = [
  { id: 'ambiente-1', kind: 'photo', category: 'Ambiente', alt: 'Salão da Food Street à noite', src: '', shape: 'tall' },
  { id: 'render-king', kind: 'render', itemId: 'the-king-brooklyn', shape: 'square' },
  { id: 'drinks-1', kind: 'photo', category: 'Drinks', alt: 'Caipirinhas no balcão', src: '', shape: 'square' },
  { id: 'type-augusta', kind: 'type', lines: ['R. Augusta', '1005'], caption: 'Consolação, São Paulo', shape: 'wide' },
  { id: 'burgers-1', kind: 'photo', category: 'Burgers', alt: 'Burger saindo da chapa', src: '', shape: 'tall' },
  { id: 'noite-1', kind: 'photo', category: 'Noite', alt: 'Fachada na Rua Augusta à noite', src: '', shape: 'wide' },
  { id: 'type-since', kind: 'type', lines: ['Since', '2016'], caption: 'Burger and Bar', shape: 'square' },
  { id: 'detalhes-1', kind: 'photo', category: 'Detalhes', alt: 'Detalhes do balcão', src: '', shape: 'square' },
];
