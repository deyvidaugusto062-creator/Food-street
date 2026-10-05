import { business, addressFull } from './business';
import { hoursSummary } from './hours';

/**
 * Conteúdo institucional.
 *
 * Regra: só vai ao ar o que estiver confirmado pela Ótica Vetor.
 * Itens com `confirmed: false` aparecem apenas na versão de desenvolvimento/revisão
 * (veja SHOW_PENDING em src/config/site.ts) como marcadores administrativos.
 */

export interface Pending {
  confirmed: boolean;
}

/* ───────────────────────── Sobre ───────────────────────── */

export const about = {
  title: 'Conheça a Ótica Vetor',
  lead: `A ${business.name} é uma ótica no ${business.address.neighborhood}, em São Paulo, dedicada a armações e produtos ópticos para diferentes estilos.`,
  /** Parágrafos confirmados (vazio até a ótica fornecer o texto) */
  paragraphs: [] as string[],
  /** Campos a preencher com a empresa — exibidos só como marcadores em desenvolvimento */
  pendingFields: [
    { label: 'História da ótica', value: '' },
    { label: 'Ano de fundação / tempo de mercado', value: '' },
    { label: 'Equipe', value: '' },
    { label: 'Serviços oferecidos', value: '' },
    { label: 'Marcas trabalhadas', value: '' },
    { label: 'Certificações', value: '' },
  ],
};

/* ───────────────────────── Diferenciais ───────────────────────── */

export interface Differential extends Pending {
  title: string;
  text: string;
}

/** Substituir pelos diferenciais confirmados e trocar `confirmed` para true. */
export const differentials: Differential[] = [
  { title: '[CONFIRMAR DIFERENCIAL 01]', text: 'Descrição curta do diferencial, informada pela ótica.', confirmed: false },
  { title: '[CONFIRMAR DIFERENCIAL 02]', text: 'Descrição curta do diferencial, informada pela ótica.', confirmed: false },
  { title: '[CONFIRMAR DIFERENCIAL 03]', text: 'Descrição curta do diferencial, informada pela ótica.', confirmed: false },
];

/* ───────────────────────── Galeria ───────────────────────── */

export type GalleryCategory = 'fachada' | 'interior' | 'ambiente' | 'armacoes' | 'produtos';

export interface GalleryItem {
  category: GalleryCategory;
  /** Caminho sem extensão (usa .avif/.webp) — vazio = foto pendente */
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  /** Somente fotos autorizadas pela ótica */
  authorized: boolean;
  /** 'contain' para foto de produto em fundo branco; 'cover' (padrão) para ambiente/pessoas */
  fit?: 'cover' | 'contain';
}

export const GALLERY_LABEL: Record<GalleryCategory, string> = {
  fachada: 'Fachada',
  interior: 'Interior',
  ambiente: 'Ambiente',
  armacoes: 'Armações',
  produtos: 'Produtos',
};

export const gallery: GalleryItem[] = [
  { category: 'fachada', src: '', alt: 'Fachada da Ótica Vetor', caption: 'Fachada da loja', width: 4, height: 5, authorized: false },
  { category: 'interior', src: '', alt: 'Interior da Ótica Vetor', caption: 'Interior da loja', width: 4, height: 3, authorized: false },
  {
    category: 'armacoes',
    src: '/images/produtos/demo-06-redonda-metal-dourada',
    alt: 'Mulher usando armação redonda de aro fino dourado',
    caption: 'Redonda de aro fino dourado — imagem ilustrativa',
    width: 315,
    height: 419,
    authorized: true,
  },
  {
    category: 'armacoes',
    src: '/images/produtos/demo-01-redonda-azul',
    fit: 'contain',
    alt: 'Armação redonda azul translúcida com hastes em tom amadeirado',
    caption: 'Redonda azul translúcida — imagem ilustrativa',
    width: 447,
    height: 447,
    authorized: true,
  },
  { category: 'ambiente', src: '', alt: 'Ambiente de atendimento da Ótica Vetor', caption: 'Atendimento', width: 4, height: 3, authorized: false },
  {
    category: 'armacoes',
    src: '/images/produtos/demo-02-redonda-metal-preta',
    alt: 'Homem usando armação redonda de aro fino preto',
    caption: 'Redonda de metal preta — imagem ilustrativa',
    width: 447,
    height: 447,
    authorized: true,
  },
  {
    category: 'armacoes',
    src: '/images/produtos/demo-04-quadrada-preta',
    fit: 'contain',
    alt: 'Armação quadrada preta vista de frente',
    caption: 'Quadrada preta — imagem ilustrativa',
    width: 547,
    height: 365,
    authorized: true,
  },
  { category: 'produtos', src: '', alt: 'Produtos ópticos da Ótica Vetor', caption: 'Produtos e acessórios', width: 4, height: 5, authorized: false },
];

/* ───────────────────────── FAQ ───────────────────────── */

export interface FaqItem extends Pending {
  topic: string;
  question: string;
  answer: string;
}

/**
 * Perguntas frequentes. As respostas `confirmed: true` usam somente dados já informados
 * (endereço, telefone, horários) ou descrevem o funcionamento do próprio site.
 * As demais aguardam a política oficial da ótica — não inventar condições comerciais.
 */
export const faq: FaqItem[] = [
  {
    topic: 'Atendimento',
    question: 'Como funciona a compra pelo site?',
    answer:
      'Você escolhe as armações, adiciona ao carrinho e envia sua solicitação. O pedido é finalizado diretamente com a equipe da ótica, que confirma disponibilidade, valores e próximos passos. O site não realiza cobranças.',
    confirmed: true,
  },
  {
    topic: 'Horários',
    question: 'Qual é o horário de funcionamento?',
    answer: hoursSummary.map((h) => `${h.days}: ${h.time}`).join(' · ') + '.',
    confirmed: true,
  },
  {
    topic: 'Localização',
    question: 'Onde fica a Ótica Vetor?',
    answer: `${addressFull}.`,
    confirmed: true,
  },
  {
    topic: 'Atendimento',
    question: 'Como falo com a ótica?',
    answer: `Pelo telefone ${business.phone.display}, pelo Instagram ${business.instagram.handle} ou pessoalmente na loja.`,
    confirmed: true,
  },
  { topic: 'Pagamento', question: 'Quais são as formas de pagamento?', answer: '[CONFIRMAR COM A ÓTICA]', confirmed: false },
  { topic: 'Retirada', question: 'Posso retirar meu pedido na loja?', answer: '[CONFIRMAR COM A ÓTICA]', confirmed: false },
  { topic: 'Entrega', question: 'Vocês fazem entrega?', answer: '[CONFIRMAR COM A ÓTICA]', confirmed: false },
  { topic: 'Produtos', question: 'As armações podem receber lentes de grau?', answer: '[CONFIRMAR COM A ÓTICA]', confirmed: false },
  { topic: 'Disponibilidade', question: 'Todas as armações do site estão na loja?', answer: '[CONFIRMAR COM A ÓTICA]', confirmed: false },
];
