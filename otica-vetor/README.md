# Ótica Vetor — site institucional + catálogo + loja de armações

Site da **Ótica Vetor** (Av. Cupecê, 3861 — Jardim Prudência, São Paulo).

React + Vite + TypeScript, com armação 3D procedural em Three.js / React Three Fiber,
catálogo com busca e filtros, carrinho persistente e finalização por atendimento.
Projeto independente dentro desta pasta (`otica-vetor/`).

> ⚠️ **Antes de publicar:** veja a seção [Pendências de confirmação](#pendências-de-confirmação).
> O catálogo atual é **demonstrativo**, e endereço, telefone, Instagram e horários ainda precisam
> ser validados com o responsável.

---

## Como rodar

Requisito: **Node.js 20.19+** (ou 22.12+).

```bash
cd otica-vetor
npm install
npm run dev            # http://localhost:5173  (mostra os marcadores [CONFIRMAR …])
```

| Comando                 | O que faz |
| ----------------------- | --------- |
| `npm run build`         | Build de **produção** em `dist/`. Conteúdo não confirmado não aparece. |
| `npm run build:preview` | Build para **revisão com o cliente**: igual ao de produção, mas com os marcadores pendentes visíveis. |
| `npm run preview`       | Serve o `dist/` localmente. |
| `npm test`              | Testes da busca, filtros e ordenação. |
| `npm run typecheck`     | Checagem de tipos. |
| `npm run images`        | Gera AVIF/WebP das fotos de `assets-src/produtos/`. |
| `npm run render:poster` | Regera a imagem estática do 3D do hero (com `npm run dev` rodando). |
| `npm run render:og`     | Regera `public/og.jpg` (imagem de compartilhamento). |

### Publicar

O `dist/` é estático (não precisa de servidor). Páginas: `/` e `/armacoes/`.

- **Vercel:** importe o repositório e defina *Root Directory* = `otica-vetor`. O `vercel.json` já traz cache e cabeçalhos de segurança.
- **Netlify:** *Base directory* = `otica-vetor` (o `netlify.toml` define build e pasta). `public/_headers` e `public/_redirects` já estão prontos.

Depois de ter o domínio, preencha `SITE_URL` em `src/data/business.ts` — isso ativa canonical,
URLs absolutas no Open Graph/Schema.org e o `sitemap.xml`.

---

## Onde alterar cada coisa

Todo o conteúdo fica centralizado em `src/data/` e `src/config/` — não é preciso mexer nos componentes.

| O que                                          | Arquivo |
| ---------------------------------------------- | ------- |
| **Armações** (produtos, preços, fotos, estoque) | `src/data/products.ts` |
| Endereço, telefone, Instagram, domínio          | `src/data/business.ts` |
| **WhatsApp**                                    | `src/data/business.ts` → `WHATSAPP_NUMBER` |
| Horários                                        | `src/data/hours.ts` |
| Sobre, diferenciais, galeria, FAQ               | `src/data/content.ts` |
| Formulário de contato, retirada/entrega, API do catálogo | `src/config/site.ts` (+ `.env`) |
| Cores, fontes, espaçamentos, curvas de animação | `src/styles/tokens.css` |
| Logotipo (provisório)                           | `src/components/ui/Logo.tsx` e `public/favicon.svg` |
| Acabamentos do 3D do hero                       | `src/three/finishes.ts` |

### Catálogo de armações

Cada produto em `src/data/products.ts`:

```ts
{
  id: 'vetor-001',                 // único
  slug: 'redonda-acetato-preta',   // vira /armacoes/?produto=redonda-acetato-preta
  name: 'Redonda Acetato Preta',
  model: 'VT-001',                 // ou null
  brand: null,                     // preencher SÓ quando a marca for confirmada
  shortDescription: '…',           // card
  description: '…',                // página do produto
  price: 349.9,                    // R$ 349,90 — use null para "Preço sob consulta"
  color: { name: 'Preto', hex: '#111111' },
  shape: 'redondo',                // redondo | quadrado | retangular | gatinho | oval | aviador | hexagonal
  rim: 'aro-fechado',              // aro-fechado | meio-aro | sem-aro
  material: null,                  // ex.: 'Acetato' — só se confirmado
  measurements: { lens: 50, bridge: 20, temple: 145 },  // ou null
  availability: 'disponivel',      // disponivel | sob-encomenda | esgotado | consultar
  images: [{ src: '/images/produtos/vt-001', alt: '…', width: 1200, height: 1200, kind: 'packshot' }],
  details: ['Hastes com flex'],    // informações adicionais (opcional)
  featured: true,                  // aparece em "Armações em destaque"
}
```

- **Adicionar/remover:** copie ou apague um bloco. **Alterar preço:** troque `price`.
- **Remover o modo demonstrativo:** apague os produtos `demo-*` (ou retire `demo: true`). O selo
  "Produto demonstrativo", o "Preço ilustrativo" e o aviso de catálogo demonstrativo somem sozinhos.
- **Filtros** são gerados a partir dos dados: um filtro (marca, cor, formato, aro, disponibilidade)
  só aparece quando o catálogo tem pelo menos duas opções diferentes. A faixa de preço usa o menor e o
  maior preço cadastrados. Ex.: o filtro de **marca** aparece assim que houver marcas preenchidas.
- **Fotos:** coloque o original em `assets-src/produtos/`, rode `npm run images` e use o caminho
  **sem extensão** em `src` (o site entrega AVIF/WebP). URLs com extensão (de uma API/CDN) também funcionam.
  O script deixa o fundo quase branco das fotos de produto totalmente branco, para o produto "flutuar" no card.
- **3D/360° por produto (futuro):** preencha `model3d: '/models/vt-001.glb'` (ativa a aba **3D**,
  com giro e zoom) ou `spin360: ['/images/360/vt-001-01.webp', …]` (ativa a aba **360°**, girando ao arrastar).
- **API/banco de dados:** defina `VITE_CATALOG_API_URL` no `.env` com uma URL que responda um JSON
  `Product[]` (mesmo formato acima). Nenhum componente precisa mudar (`src/services/catalog.ts`).

### WhatsApp

```ts
// src/data/business.ts
export const WHATSAPP_NUMBER: string = '5511XXXXXXXXX'; // só dígitos, 55 + DDD — NÃO usar número não confirmado
```

Vazio (hoje): nenhum botão de WhatsApp aparece; a finalização do pedido oferece **copiar a mensagem**,
**Instagram Direct** e **ligar para a loja**. Preenchido: aparecem o botão "Enviar pelo WhatsApp"
(com a mensagem do pedido pronta), o card no Contato e o ícone no rodapé.

### Carrinho e finalização

- Carrinho salvo no `localStorage` (persiste entre páginas e abas). Guarda só `id` + quantidade;
  preço e nome vêm sempre do catálogo atual.
- **Não há pagamento pelo site** — isso é dito no carrinho, no produto e no FAQ.
- A finalização pede **nome** e **telefone** e monta a mensagem:
  *"Olá, meu nome é [NOME]. Tenho interesse nestas armações: … Quantidade … Total … Gostaria de saber
  mais informações para finalizar o atendimento."*
- **Retirada/entrega:** só aparece se `FULFILLMENT_OPTIONS` (em `src/config/site.ts`) for preenchido
  com opções confirmadas, ex.: `['Retirar na loja']`.

### Formulário de contato

Não é exibido hoje, porque não há backend. Para ativar, defina `VITE_CONTACT_FORM_ENDPOINT`
(Formspree, função serverless, API própria) que aceite `POST` JSON `{ nome, telefone, mensagem }`.
A mensagem de sucesso só aparece se o servidor responder 2xx.

### Sobre, diferenciais, galeria e FAQ

Em `src/data/content.ts`:

- **Diferenciais:** troque os `[CONFIRMAR DIFERENCIAL 0X]` pelos textos da ótica e marque `confirmed: true`.
  Enquanto nenhum estiver confirmado, a seção e o item do menu **não aparecem em produção**.
- **Galeria:** cada foto tem `authorized` — só fotos autorizadas pela ótica são publicadas. Fachada,
  interior, ambiente e produtos estão como espaços pendentes.
- **FAQ:** perguntas de pagamento, retirada, entrega, lentes e disponibilidade aguardam resposta da
  ótica (`confirmed: false`) e não aparecem em produção.
- **Sobre:** `paragraphs` recebe o texto institucional; `pendingFields` lista o que falta
  (história, fundação, equipe, serviços, marcas, certificações).

---

## Experiência 3D e movimento

- **Hero:** armação 3D procedural (montada por código, sem arquivos pesados): aros chanfrados, ponte,
  dobradiças e hastes que se abrem na entrada; lentes com reflexo de antirreflexo; iluminação de estúdio
  gerada em tempo real. Segue o mouse, gira ao arrastar (com inércia), flutua e inclina com a rolagem.
  Os botões de acabamento (verde, tartaruga, cristal, preto) trocam o material — são **ilustrativos**.
- **Carregamento sob demanda:** o Three.js (~250 kB gzip) só é baixado depois da primeira pintura,
  quando o palco está na tela. Em celulares e aparelhos modestos, só depois da primeira interação
  (toque/rolagem); até lá aparece a imagem estática gerada da própria cena. A cena pausa fora da tela,
  limita a resolução e reduz a qualidade se o FPS cair.
- **Níveis de efeito** (`src/utils/perf.ts`): `full` (desktop), `lite` (celular/aparelho modesto:
  materiais mais leves, sem blur pesado, sem inclinação por cursor) e `off` (sem WebGL ou com
  **reduzir movimento**: imagem estática e nenhuma animação automática).
- **Cards e painéis** inclinam seguindo o cursor (só com mouse), com brilho e profundidade;
  no toque, resposta leve ao pressionar. Revelação suave no scroll e paralaxe por CSS
  (`animation-timeline`) onde houver suporte.
- **Direção "Sedance 2.5":** aplicada como referência de direção visual, conforme o briefing —
  curvas de animação naturais (`--ease-out`, `--ease-spring`), transições curtas, hierarquia forte,
  profundidade e componentes com acabamento premium. Os tokens de movimento estão em `src/styles/tokens.css`.

## Desempenho, acessibilidade e SEO

- Lighthouse (build de produção, emulação de celular): **Desempenho 97 · Acessibilidade 100 ·
  Boas práticas 100 · SEO 100** na página inicial; **100/100/100/100** na loja (desktop).
- AVIF/WebP com dimensões reservadas e lazy loading; fontes latinas pré-carregadas; mapa do Google
  carregado só quando o visitante pede; CSS e JS divididos por página.
- HTML semântico, um H1 por página, navegação por teclado, foco visível, diálogos nativos
  (`<dialog>`) com foco preso e Esc, `aria-live` no carrinho e nos resultados, alvos de toque ≥ 44 px,
  `prefers-reduced-motion`.
- SEO local: title/description por página, Open Graph + `og.jpg`, `robots.txt`, `sitemap.xml`
  (quando `SITE_URL` estiver preenchido), Schema.org `Optician` (endereço, telefone, horários,
  Instagram) e `BreadcrumbList` na loja — somente com os dados informados. Produtos demonstrativos
  não geram dados estruturados.

## Estrutura

```
otica-vetor/
  index.html              página inicial
  armacoes/index.html     loja (Comprar armações)
  assets-src/produtos/    fotos originais (entrada do npm run images)
  public/images/          fotos otimizadas, pôster do 3D
  scripts/                otimização de imagens, pôster do 3D, og.jpg
  src/
    data/                 conteúdo editável (produtos, empresa, horários, textos)
    config/site.ts        chaves (pendências, API, formulário, retirada/entrega)
    services/             catálogo (local/API), filtros (+ testes), mensagem do pedido
    store/                carrinho e produto aberto (URL)
    components/           layout, hero, produtos, loja, carrinho, seções
    three/                armação procedural, cena do hero, visualizador .glb
    styles/               tokens e base
    pages/                entradas de cada página
```

---

## Pendências de confirmação

Nada abaixo foi inventado — tudo está marcado como pendente no código.

| Item | Situação |
| ---- | -------- |
| **Catálogo** | 8 produtos **demonstrativos** (fotos fornecidas, nomes descritivos, preços ilustrativos, disponibilidade "consultar"). Substituir pelo catálogo oficial. |
| Marcas, materiais, medidas | Não informados — campos vazios (`null`). |
| **WhatsApp** | Não confirmado — integração pronta e desligada. |
| Endereço, telefone, Instagram | Informados no briefing — **validar** antes da publicação. |
| **Horários** | Informados no briefing — **validar** (incluindo feriados). |
| Diferenciais | 3 marcadores `[CONFIRMAR DIFERENCIAL]`. |
| Sobre | História, fundação, equipe, serviços, marcas e certificações. |
| Galeria | Fotos de fachada, interior, ambiente e produtos (somente autorizadas). Confirmar também a autorização de uso das fotos de pessoas usadas como ilustração. |
| FAQ | Pagamento, retirada, entrega, lentes de grau, disponibilidade. |
| Retirada/entrega | Não confirmadas — pergunta oculta na finalização. |
| Formulário de contato | Sem backend — oculto. |
| Logotipo e identidade | Assinatura e paleta provisórias (briefing). Trocar se houver identidade oficial. |
| Domínio | `SITE_URL` vazio — sem sitemap/canonical até definir. |
