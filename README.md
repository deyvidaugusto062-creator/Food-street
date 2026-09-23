# Food Street Augusta — Burger and Bar

Site da **Food Street Augusta** (Rua Augusta, 1005 — Consolação, São Paulo), desde 2016.

React + Vite + TypeScript, com cena 3D em Three.js / React Three Fiber, shaders WebGL,
profundidade 2.5D e animações de scroll com GSAP.

---

## Como instalar

Requisito: **Node.js 20.19+** (ou 22.12+).

```bash
npm install
```

## Como rodar

```bash
npm run dev
```

Abre em `http://localhost:5173`.

## Como fazer o build

```bash
npm run build     # checa os tipos e gera a pasta dist/
npm run preview   # serve o build localmente para conferir
```

A pasta `dist/` é estática: publique em qualquer hospedagem (Vercel, Netlify, Cloudflare
Pages, S3 etc.). Não precisa de servidor.

---

## Onde alterar cada coisa

Todo o conteúdo fica em `src/data/`, separado do layout. Não é preciso mexer nos componentes.

| O que                               | Arquivo                      |
| ----------------------------------- | ---------------------------- |
| Cardápio, preços, combos            | `src/data/menu.ts`           |
| Destaques (cards e aba Destaques)   | `src/data/menu.ts` → `featured` e `featuredOrder` |
| Item do card do hero                | `src/data/menu.ts` → `heroItemId` |
| Foto do hero                        | `src/config/scene.ts` → `HERO_PHOTO` |
| Horários                            | `src/data/hours.ts`          |
| Endereço, telefone, links do mapa   | `src/data/business.ts`       |
| WhatsApp                            | `src/data/business.ts` → `WHATSAPP_NUMBER` |
| Domínio do site (SEO)               | `src/data/business.ts` → `SITE_URL` |
| Avaliações                          | `src/data/reviews.ts`        |
| Galeria "Noite na Augusta"          | `src/data/gallery.ts`        |
| Receitas das ilustrações 3D         | `src/data/stacks.ts`         |
| Modelo 3D do hero (.glb)            | `src/config/scene.ts`        |
| Cores, fontes, espaçamentos         | `src/styles/tokens.css`      |

### Alterar preços

Em `src/data/menu.ts`, cada item tem `price` e, quando houver, `comboPrice`
(ou `withFriesPrice` na Linha Street). Use ponto decimal: `49.9` vira **R$ 49,90**.

```ts
{
  id: 'food-street',
  name: 'Food Street',
  category: 'burgers',
  price: 45.9,
  comboPrice: 64.9,
  description: 'Burger de 180g, mussarela, picles e maionese de alho no pão brioche.',
},
```

Para incluir um item, copie um bloco existente, troque o `id` (único, sem espaços)
e escolha a `category`: `entradas`, `burgers`, `tunados`, `street`, `doubles`,
`bebidas` ou `sobremesas`.

### Adicionar o WhatsApp

Em `src/data/business.ts`:

```ts
export const WHATSAPP_NUMBER: string = '5511900000000'; // só dígitos, com 55 + DDD
```

Enquanto estiver vazio, **nenhum botão de WhatsApp aparece**. Com o número preenchido,
o botão "Chamar no WhatsApp" surge na seção de localização e o link aparece no rodapé.

### Alterar horários

Em `src/data/hours.ts`. Turnos que passam da meia-noite (ex.: `16:00` – `01:00`) são
entendidos automaticamente. O dia atual é destacado e o status "Aberto agora" é
calculado no fuso de São Paulo.

### Alterar endereço e telefone

Em `src/data/business.ts`. Os links "Abrir no mapa", "Como chegar" e o mapa
incorporado são montados a partir desses dados.

---

## Imagens

### Fotos reais

As pastas já existem em `public/images/`:

```
public/images/
  hero/  burgers/  entries/  drinks/  desserts/  environment/  gallery/
```

- **Foto de um produto:** coloque o arquivo em `public/images/burgers/` e preencha
  `image` no item do cardápio, ex.: `image: '/images/burgers/king-brooklyn.webp'`.
  A foto substitui a ilustração 3D automaticamente.
- **Galeria:** em `src/data/gallery.ts`, preencha `src` e `alt` dos tiles do tipo
  `photo`. Enquanto `src` estiver vazio, o tile mostra um espaço reservado discreto.

Use WebP ou AVIF, com cerca de 1600px no lado maior. Publique **somente fotos
autorizadas pela casa**.

Fotos em uso hoje (enviadas pela casa):

| Arquivo | Onde aparece |
| ------- | ------------ |
| `hero/poseidon-burger.webp` | Hero (post "Raio-X do burger", sem o texto) |
| `burgers/poseidon.webp` | Card e cardápio do Poseidon Burger |
| `gallery/poseidon-batatas.webp` | Galeria |
| `burgers/street-*.webp` | Linha Street (recortes do cardápio em PDF) |

As fotos da Linha Street foram recortadas de um print do celular e têm pouca
resolução (cerca de 500px). Troque pelos arquivos originais quando houver.

### Ilustrações 3D dos burgers

As ilustrações geradas a partir das receitas de `src/data/stacks.ts` **não aparecem
mais no site**: foram trocadas pelas fotos reais. Itens sem foto mostram a inicial do
nome. Para voltar a usar a ilustração em um item, preencha `render` nele, ex.:
`render: '/images/burgers/renders/the-king-brooklyn'`. Ela aparece sempre identificada
como **ilustração**, para não ser confundida com foto do produto.

Para gerar de novo, depois de alterar uma receita:

```bash
npm run render:burgers                    # todos
npm run render:burgers -- the-king-brooklyn  # só um
```

O script usa o Chromium do Playwright (`/opt/pw-browsers/chromium` por padrão;
defina `CHROMIUM_PATH` se estiver em outro lugar) e grava
`public/images/burgers/renders/<id>-600.webp` e `-1000.webp`.

### Foto ou 3D no hero

Hoje o hero mostra uma foto real, definida em `src/config/scene.ts`:

```ts
export const HERO_PHOTO = '/images/hero/poseidon-burger.webp';
```

Com a foto, o Three.js nem é carregado. Para voltar ao burger 3D, deixe
`HERO_PHOTO = ''` e troque `heroItemId` em `src/data/menu.ts` para o burger da
receita (`the-king-brooklyn`).

### Modelo 3D real no hero

O burger 3D do hero é procedural (montado pelo código). Para usar um modelo real
(fotogrametria ou modelagem), exporte em `.glb`, de preferência com compressão Draco,
coloque em `public/models/` e informe em `src/config/scene.ts`:

```ts
export const HERO_MODEL_URL = '/models/king-brooklyn.glb';
```

Ajuste `HERO_MODEL_SCALE` e `HERO_MODEL_OFFSET_Y` se o modelo vier em outra escala.

---

## Dados pendentes de confirmação

O material recebido tinha informações conflitantes. Nada foi "corrigido" por conta
própria. Esses itens estão marcados com `needsConfirmation: true` em `src/data/menu.ts`:

| Item | O que falta |
| ---- | ----------- |
| **Station** | Preço do combo (possível inconsistência no material). O site mostra "Combo a confirmar". |
| **Linha Street** (Cheese Burger R$ 18, Brooklyn Burger, PC Burger, Street Bacon, Street Dog) | Valores de outra parte do material. Podem ser de outro período. Ficam separados da tabela principal, com aviso. |
| **Poseidon Burger** | Preço e combo. Veio do post "Raio-X do burger" no Instagram, sem valores. O site mostra "Valor a confirmar". |
| **Sobremesas** (Pudim, Vaka-Loka, Bolo de chocolate) | Foram informados R$ 16, R$ 24 e R$ 35 sem dizer qual é de qual. Os preços não aparecem no site. Os valores estão em `DESSERT_PRICES_TO_ASSIGN`. |

Também ficaram de fora até confirmação: WhatsApp, redes sociais, delivery, reservas,
formas de pagamento e o trecho de avaliação sem autoria completa.

Depois de confirmar, corrija o dado e remova `needsConfirmation` / `confirmationNote`.

---

## Estrutura

```
src/
  components/
    Header/  Hero/  Hero3D/  FeaturedProducts/  Menu/  Manifesto/
    StreetBand/  Gallery/  Reviews/  About/  Location/  CTA/  Footer/
    ui/            botões, ícones, imagem de produto, placa de rua, shader de fundo
  data/            conteúdo editável (cardápio, horários, avaliações, negócio…)
  config/          configuração da cena 3D
  three/           burger procedural, ingredientes, luzes e shaders da cena
  hooks/           scroll animations, media queries, in-view, relógio
  utils/           formatação de preço, horário de SP, detecção de WebGL
  styles/          tokens de design e estilos base
  render/          página interna usada para gerar as ilustrações (fora do build)
scripts/
  render-burgers.mjs
```

## Desempenho, acessibilidade e SEO

- O Three.js fica num pedaço separado, carregado depois da primeira pintura (e só
  quando o hero está no modo 3D). A cena
  pausa fora da tela, limita o DPR a 1,5 e baixa para 1 se o FPS cair. Em aparelhos
  modestos usa menos partículas, sem sombras nem vapor.
- Sem WebGL, o hero mostra a ilustração estática. Com `prefers-reduced-motion`, não há
  montagem animada, paralaxe nem movimento automático, e o scroll reveal fica desligado.
- Os shaders das faixas (bokeh da Augusta) rodam em WebGL puro, em resolução reduzida,
  e só desenham quando estão visíveis.
- HTML semântico, um único H1, foco visível, navegação por teclado nas abas do cardápio,
  alvos de toque de 44px, contraste AA.
- Dados estruturados `Restaurant` (nome, endereço, telefone e horários), Open Graph e
  `og.jpg` são gerados no build a partir de `src/data/`. Preencha `SITE_URL` quando
  houver domínio, para URLs absolutas e `canonical`.
