/**
 * Chaves de configuração do site. Tudo que liga/desliga funcionalidades fica aqui.
 */

/**
 * Mostra os marcadores administrativos ([CONFIRMAR …], fotos pendentes, perguntas sem resposta).
 * - `npm run dev` → ligado
 * - `npm run build:preview` → ligado (versão para revisão com o cliente)
 * - `npm run build` → desligado: conteúdo não confirmado simplesmente não aparece
 */
export const SHOW_PENDING: boolean = import.meta.env.DEV || import.meta.env.VITE_SHOW_PENDING === 'true';

/**
 * Futura API do catálogo. Quando definida (VITE_CATALOG_API_URL no .env), o site busca os produtos
 * nessa URL (JSON no formato de src/types/product.ts) em vez de usar src/data/products.ts.
 */
export const CATALOG_API_URL: string = import.meta.env.VITE_CATALOG_API_URL ?? '';

/**
 * Endpoint real que recebe o formulário de contato (ex.: Formspree, função serverless, API própria).
 * Enquanto vazio, o formulário NÃO é exibido — o site nunca simula um envio.
 * O endpoint deve aceitar POST JSON { nome, telefone, mensagem } e responder 2xx em caso de sucesso.
 */
export const CONTACT_FORM_ENDPOINT: string = import.meta.env.VITE_CONTACT_FORM_ENDPOINT ?? '';

/**
 * Formas de receber o pedido — preencher SOMENTE se a ótica confirmar a operação
 * (ex.: ['Retirar na loja', 'Entrega']). Vazio = a pergunta não aparece na finalização.
 */
export const FULFILLMENT_OPTIONS: string[] = [];

/** Quantidade máxima por item no carrinho */
export const MAX_QTY = 10;

/**
 * Versão "arquivo único" (npm run build:single): um só HTML que abre direto do computador,
 * sem servidor. Navegação por #/armacoes e imagens embutidas no próprio arquivo.
 */
export const SINGLE_FILE: boolean = import.meta.env.VITE_SINGLE_FILE === 'true';
