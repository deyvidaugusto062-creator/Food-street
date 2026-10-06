/*
 * ATALAIA PURIFICADORES — CONFIGURAÇÃO DO SITE
 * ------------------------------------------------------------
 * Este é o arquivo para editar contatos, preços, produtos, imagens
 * e integrações. Não é preciso mexer no HTML para trocar esses dados.
 *
 * Itens marcados com [A CONFIRMAR] ainda dependem de informação da empresa.
 */
window.ATALAIA_CONFIG = {
  company: {
    name: 'Atalaia Purificadores',
    slogan: 'Beba água limpa.',
    tagline: 'Água limpa é Atalaia.',
  },

  contact: {
    // Somente números, com DDI 55 + DDD. Usado em todos os links do WhatsApp.
    whatsappNumber: '5511954319514',
    whatsappDisplay: '(11) 95431-9514',
    instagramHandle: '@atalaia_purificadores',
    instagramUrl: 'https://www.instagram.com/atalaia_purificadores/',
    region: 'São Paulo – SP',
  },

  // Mensagens prontas dos botões simples de WhatsApp (data-wa="..." no HTML).
  whatsappMessages: {
    general: 'Olá! Vim pelo site da Atalaia Purificadores e gostaria de mais informações.',
    float: 'Olá! Vim pelo site da Atalaia Purificadores e gostaria de mais informações.',
    coverage: 'Olá! Gostaria de confirmar o atendimento da Atalaia Purificadores para minha região.',
  },

  /*
   * PROMOÇÃO
   * - Sem `endDate`: cada visitante recebe um prazo de `durationHours` a partir da
   *   primeira visita. O prazo fica salvo no navegador (localStorage), então
   *   atualizar a página NÃO reinicia o contador.
   * - Com `endDate` (ex.: '2026-12-31T23:59:59-03:00'): todos os visitantes veem
   *   o mesmo prazo real, definido pelo administrador. Recomendado em produção.
   * - Para lançar uma NOVA promoção depois que a atual terminar, troque `id`.
   */
  promotion: {
    id: 'oferta-purificador-novo-01',
    endDate: null,
    durationHours: 24,
    originalPrice: 600,
    promoPrice: 450,
    productName: 'Purificador de Água Novo',
    model: '[MODELO A CONFIRMAR]',
    condition: 'Novo',
    image: 'assets/products/purificador-branco.svg',
    imageAlt: 'Ilustração de purificador de água branco com painel azul',
  },

  /*
   * PRODUTOS
   * category: 'novo' ou 'seminovo'. Para adicionar um produto, copie um bloco.
   * Imagens: coloque as fotos reais em assets/products/ e atualize `image`.
   * Se tiver versões otimizadas, informe `imageWebp` e/ou `imageAvif`.
   * `illustrative: true` mostra o aviso "Imagem ilustrativa" no card.
   */
  categories: {
    novo: { title: 'Purificadores Novos', price: 600, description: 'Equipamentos novos, prontos para instalar.' },
    seminovo: { title: 'Purificadores Seminovos', price: 450, description: 'Ótima opção para economizar sem abrir mão de água limpa.' },
  },

  products: [
    {
      id: 'novo-01',
      category: 'novo',
      name: 'Purificador de Água',
      model: '[MODELO A CONFIRMAR]',
      condition: 'Novo',
      price: 600,
      description: 'Uma opção prática para quem busca água limpa, facilidade de uso e excelente custo-benefício.',
      features: [
        'Equipamento novo',
        'Instalação em São Paulo sob consulta',
        'Atendimento direto pelo WhatsApp',
        'Especificações técnicas: [A CONFIRMAR]',
      ],
      image: 'assets/products/purificador-branco.svg',
      imageAlt: 'Ilustração de purificador de água branco com painel azul',
      illustrative: true,
    },
    {
      id: 'seminovo-01',
      category: 'seminovo',
      name: 'Purificador de Água',
      model: '[MODELO A CONFIRMAR]',
      condition: 'Seminovo',
      price: 450,
      description: 'Uma opção prática para quem busca água limpa, facilidade de uso e excelente custo-benefício.',
      features: [
        'Equipamento seminovo',
        'Instalação em São Paulo sob consulta',
        'Atendimento direto pelo WhatsApp',
        'Especificações técnicas: [A CONFIRMAR]',
      ],
      image: 'assets/products/purificador-prata.svg',
      imageAlt: 'Ilustração de purificador de água prata com painel escuro',
      illustrative: true,
    },
  ],

  services: ['Limpeza', 'Troca de filtro', 'Sanitização completa', 'Instalação'],

  problems: [
    'Água com gosto estranho',
    'Água com cheiro estranho',
    'Água turva',
    'Água com resíduos',
    'Água com pouca pressão',
    'Alto consumo de energia',
    'Outro problema',
  ],

  // Fotos do carrossel da primeira seção.
  heroSlides: [
    { image: 'assets/products/purificador-branco.svg', alt: 'Ilustração de purificador de água branco com painel azul', caption: 'Purificadores novos' },
    { image: 'assets/products/purificador-prata.svg', alt: 'Ilustração de purificador de água prata', caption: 'Purificadores seminovos' },
    { image: 'assets/products/instalacao-parede.svg', alt: 'Ilustração de purificador instalado na parede da cozinha', caption: 'Instalação em São Paulo' },
    { image: 'assets/products/refil-filtro.svg', alt: 'Ilustração de refil de filtro para purificador', caption: 'Troca de filtro' },
  ],

  // Galeria. Substitua pelas fotos reais e defina illustrative: false.
  gallery: [
    { image: 'assets/products/purificador-branco.svg', alt: 'Ilustração de purificador de água branco', caption: 'Purificador branco com painel azul', illustrative: true },
    { image: 'assets/products/purificador-prata.svg', alt: 'Ilustração de purificador de água prata', caption: 'Purificador prata', illustrative: true },
    { image: 'assets/products/purificador-grafite.svg', alt: 'Ilustração de purificador de água grafite', caption: 'Purificador grafite', illustrative: true },
    { image: 'assets/products/purificador-azul.svg', alt: 'Ilustração de purificador de água azul claro', caption: 'Purificador azul claro', illustrative: true },
    { image: 'assets/products/instalacao-parede.svg', alt: 'Ilustração de purificador instalado na parede', caption: 'Purificador instalado na parede', illustrative: true },
    { image: 'assets/products/refil-filtro.svg', alt: 'Ilustração de refil de filtro', caption: 'Refil de filtro', illustrative: true },
  ],

  integrations: {
    // Busca de endereço pelo CEP (API pública, gratuita, sem chave).
    cep: {
      enabled: true,
      url: 'https://viacep.com.br/ws/{cep}/json/',
      timeoutMs: 7000,
    },
    /*
     * Geocodificação reversa (coordenadas → endereço). DESATIVADA por padrão.
     * Sem ela, o site guarda as coordenadas, inclui um link do mapa na mensagem
     * e pede ao cliente para confirmar o endereço manualmente.
     * Para ativar com o Nominatim (OpenStreetMap), defina enabled: true e
     * revise a política de uso: https://operations.osmfoundation.org/policies/nominatim/
     * Para uso comercial com volume maior, prefira um provedor com chave própria.
     */
    reverseGeocoding: {
      enabled: false,
      url: 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language=pt-BR',
      timeoutMs: 8000,
    },
  },

  reviews: {
    maxName: 60,
    minComment: 10,
    maxComment: 500,
    // Mostra aviso de que as avaliações ficam só neste navegador.
    // Desative depois de conectar o backend (ver js/reviews.js).
    showLocalNotice: true,
  },
};
