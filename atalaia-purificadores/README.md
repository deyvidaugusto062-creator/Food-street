# Atalaia Purificadores: site institucional e de vendas

Site responsivo (mobile-first) da **Atalaia Purificadores**: venda, instalação, manutenção, limpeza,
sanitização e troca de filtro de purificadores de água em toda São Paulo.

Feito em HTML5, CSS3 e JavaScript puro, sem build e sem bibliotecas externas. Funciona ao abrir o `index.html`
direto no navegador e pode ser publicado em qualquer hospedagem estática.

> **Beba água limpa.** · **Água limpa é Atalaia.**

---

## Estrutura

```
atalaia-purificadores/
├── index.html              Página única com todas as seções
├── robots.txt
├── css/
│   └── style.css           Estilos (tokens de cor em :root, mobile-first)
├── js/
│   ├── config.js           ★ CONTATOS, PREÇOS, PRODUTOS, IMAGENS E INTEGRAÇÕES
│   ├── utils.js            Funções compartilhadas (WhatsApp, storage, formulários, diálogos)
│   ├── location.js         Endereço: manual, busca por CEP (ViaCEP) e geolocalização
│   ├── promotion.js        Oferta especial com contador persistente
│   ├── checkout.js         Catálogo, compra, serviços, diagnóstico e prévia da mensagem
│   ├── carousel.js         Carrossel do topo
│   ├── gallery.js          Galeria + lightbox
│   ├── reviews.js          Avaliações (camada de dados trocável)
│   └── main.js             Menu, efeitos 3D/parallax, animações, links de contato
└── assets/
    ├── icons/              favicon.svg, apple-touch-icon.png
    ├── images/             og-image.png (imagem de compartilhamento)
    └── products/           Imagens dos produtos (atualmente ILUSTRAÇÕES, ver abaixo)
```

Os scripts são clássicos (`defer`), não módulos ES, porque módulos ES não carregam via `file://` no Chrome.
A ordem de carregamento no `index.html` importa.

## Como executar

**Opção 1:** abra `index.html` com dois cliques. Tudo funciona, inclusive a busca por CEP (requer internet).

**Opção 2 (recomendada para testar no celular):** sirva a pasta localmente:

```bash
npx serve atalaia-purificadores      # ou: python3 -m http.server --directory atalaia-purificadores
```

> A geolocalização exige conexão segura. Funciona em `file://` e `localhost` no computador, mas no
> celular só funciona com o site publicado em **https**.

## Publicação

É um site estático: Netlify, Vercel, GitHub Pages, Cloudflare Pages ou qualquer hospedagem comum.
Publique o conteúdo da pasta `atalaia-purificadores/`. Depois de ter o domínio:

1. Troque `SEU-DOMINIO.com.br` no `index.html` (canonical, Open Graph e dados estruturados).
2. Descomente a linha `Sitemap:` no `robots.txt`, se for criar um sitemap.

---

## Onde editar cada coisa

Quase tudo fica em **`js/config.js`**:

| O que | Onde |
|---|---|
| WhatsApp, Instagram, região | `contact` |
| Mensagens dos botões simples de WhatsApp | `whatsappMessages` |
| Oferta especial (preços, prazo, produto) | `promotion` |
| Produtos (nome, modelo, estado, preço, descrição, itens, foto) | `products` |
| Título/preço das categorias Novos e Seminovos | `categories` |
| Fotos do carrossel do topo | `heroSlides` |
| Fotos da galeria | `gallery` |
| Opções do diagnóstico | `problems` |
| CEP / geocodificação reversa | `integrations` |
| Limites e aviso das avaliações | `reviews` |

Textos institucionais (Sobre, Serviços, Garantia, Rodapé) estão direto no `index.html`, com comentários
marcando cada seção. Cores e espaçamentos ficam no topo do `css/style.css` (`:root`).

### Promoção e contador

- **Sem `endDate`** (padrão): cada visitante recebe 24h a partir da primeira visita. O prazo é salvo no
  `localStorage`, então atualizar a página **não reinicia** o contador. Ao zerar, a oferta encerra sozinha:
  o preço volta para R$ 600,00 e aparece "Promoção encerrada".
- **Com `endDate`** (ex.: `'2026-12-31T23:59:59-03:00'`): todos os visitantes veem o mesmo prazo real.
  É o recomendado para uma promoção de verdade.
- Para lançar **uma nova promoção** depois que a atual acabar, troque o `id` (ex.: `oferta-...-02`).
  Assim os navegadores que já viram a oferta anterior recebem um prazo novo.

### Trocar as imagens ilustrativas pelas fotos reais

As imagens em `assets/products/` são **ilustrações vetoriais** criadas como placeholder. Elas não
representam produtos reais da Atalaia e aparecem marcadas como "Imagem ilustrativa" no site.

1. Coloque as fotos em `assets/products/`. Recomendado: JPG/WebP com cerca de 1200×1200 px e até 200 KB.
2. Atualize `image` (e opcionalmente `imageWebp` / `imageAvif`) nos itens de `products`, `heroSlides`,
   `gallery` e `promotion`.
3. Escreva um `alt`/`imageAlt` descritivo e defina `illustrative: false`.
4. Quando nenhuma imagem for ilustrativa, o aviso da galeria some sozinho.

---

## Integrações externas

| Integração | Situação | O que fazer |
|---|---|---|
| **WhatsApp** (`wa.me/5511954319514`) | ✅ Funcionando | Nada. Mensagens montadas com `encodeURIComponent()`. |
| **Instagram** | ✅ Funcionando | Nada. |
| **ViaCEP** (busca de endereço por CEP) | ✅ Ativo (API pública, sem chave) | Nada. Se a API falhar, o cliente preenche manualmente. |
| **Geolocalização** (`navigator.geolocation`) | ✅ Funcionando (requer https em produção) | Nada. Pede permissão só após o clique. Sem permissão, não finge localização. |
| **Geocodificação reversa** (coordenadas → endereço) | ⚠️ **Desativada** | Sem ela, o site guarda as coordenadas, envia um link do Google Maps na mensagem e pede o endereço ao cliente. Para ativar: `integrations.reverseGeocoding.enabled = true` (Nominatim/OSM já configurado; revise a política de uso ou troque por um provedor com chave). |
| **Avaliações compartilhadas** | ⚠️ **Não conectado** | Hoje usam `localStorage`: cada avaliação aparece **só no navegador de quem publicou**. Para todos verem, conecte um backend (ver abaixo). |
| **Google Fonts** (Manrope) | ✅ Opcional | Sem internet, o site usa a fonte do sistema. |
| **Domínio** | ⚠️ Pendente | Trocar `SEU-DOMINIO.com.br` no `index.html`. |

### Avaliações com backend (Supabase, Firebase etc.)

`js/reviews.js` tem uma camada de dados (`ReviewsStore.adapter`) com a interface `{ list(), add(review) }`.
Há um adaptador **Supabase comentado** pronto para adaptar (tabela, colunas e políticas RLS descritas no
comentário). Recomenda-se moderação (`approved = true`) antes de exibir publicamente. Depois de conectar,
defina `reviews.showLocalNotice: false` no `config.js`.

O conteúdo das avaliações é sempre exibido como texto (`textContent`). O site não interpreta HTML vindo
do usuário, e os campos têm validação e limite de caracteres.

---

## Informações a confirmar

Nada foi inventado. Os itens abaixo aparecem como `[INFORMAÇÃO A CONFIRMAR]` / `[A CONFIRMAR]`:

- Modelo(s) dos purificadores e especificações técnicas (`config.js` → `products`, `promotion`)
- Ano de fundação e CNPJ (seção Sobre, `index.html`). Preencha ou remova o bloco `facts`.
- Condições da garantia de 3 meses (o site orienta consultar pelo WhatsApp)
- Fotos reais dos produtos

O site **não** contém avaliações, clientes, certificações, prêmios, marcas parceiras, endereço comercial
ou anos de experiência inventados.

---

## Decisões de UX

- **Ordem das seções pensada para o celular:** Apresentação → Promoção → Produtos → WhatsApp → Serviços →
  Diagnóstico → Área de atendimento → Sobre/Diferenciais → Galeria → Avaliações → Garantia → Contato.
  O menu mantém a ordem pedida (Início, Sobre, Purificadores…) e cada link leva à seção correspondente.
- **Prévia antes do WhatsApp:** compra, serviço e diagnóstico mostram a mensagem completa antes de abrir o
  WhatsApp, com opção de voltar e editar.
- **WhatsApp flutuante:** no celular ele some no topo da página (o header já mostra o botão), enquanto o
  teclado está aberto e com menu/janelas abertos, para não cobrir campos e botões.
- **3D discreto:** inclinação com reflexo nos cards (só com mouse), profundidade nas imagens, parallax suave
  no topo e vidro fosco leve. No celular, em aparelhos modestos (≤ 4 núcleos / ≤ 4 GB / economia de dados)
  e com `prefers-reduced-motion`, os efeitos pesados são desligados automaticamente.
- **Acessibilidade:** navegação por teclado, foco visível, `<dialog>` nativo (Esc fecha, foco preso),
  labels em todos os campos, mensagens de erro ligadas por `aria-describedby`, carrossel pausável,
  textos com contraste AA e áreas de toque de pelo menos 44 px.

### Sobre "Sedance 2.5"

Não existe biblioteca web chamada "Sedance 2.5". A profundidade foi implementada como **2.5D** (camadas,
perspectiva e parallax) em CSS/JS puro, sem bibliotecas pesadas. Se a referência for ao **Seedance**
(modelo de IA da ByteDance que gera vídeos), ele pode ser usado fora do site para criar um vídeo curto
do produto. O vídeo pode então substituir uma imagem do carrossel.

---

## Testes realizados

Testado com Chromium (Playwright) em 320, 375, 390, 430, 768, 1024, 1366, 1440 e 1920 px:

- Sem rolagem horizontal e sem erros no console em todas as larguras
- Menu desktop e mobile (abrir, Esc, fechar ao navegar, foco)
- Carrossel: automático, setas, indicadores, arrastar com mouse, deslizar no toque, pausa
- Promoção: preço R$ 450, contador a partir de 23:59:59, persistência após recarregar, encerramento em
  tempo real (R$ 450 → R$ 600, "Promoção encerrada", destaque removido), estado mantido após recarregar
- Compra: validação, foco no erro, busca por CEP (sucesso, CEP inexistente, falha da API), mensagem exata,
  `encodeURIComponent`, prévia, voltar e editar, abertura do WhatsApp
- Geolocalização com permissão (link do mapa na mensagem) e com permissão negada (sem localização falsa)
- Serviços e diagnóstico (múltiplos problemas, "Outro problema" exige descrição)
- Galeria e lightbox (anterior/próxima, teclado, zoom, Esc, foco de volta)
- Avaliações: validação, sanitização contra HTML/script, média, persistência após recarregar
- Instagram, WhatsApp flutuante, mensagem de cobertura, copyright automático

A busca de CEP foi testada com respostas simuladas (o ambiente de testes não acessa a internet). Antes de
publicar, faça um teste real no celular: CEP, localização (com https) e abertura do WhatsApp.
