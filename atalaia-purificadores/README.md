# Atalaia Purificadores: site institucional e de vendas

Site responsivo (mobile-first) da **Atalaia Purificadores**: venda, instalação, manutenção, limpeza,
sanitização e troca de filtro de purificadores de água em toda São Paulo.

Feito em HTML, CSS e JavaScript, sem etapa de build para publicar. Funciona ao abrir o `index.html` direto
no navegador e pode ir para qualquer hospedagem estática. A única biblioteca é o **Three.js** (cena 3D do
topo), que já vem empacotado em `js/scene3d.js` e só é carregado quando o aparelho comporta.

> **Beba água limpa.** · **Água limpa é Atalaia.**

---

## Conceito: a rolagem conta a história da água

O topo do site é uma **história em capítulos**. O purificador 3D fica fixo na tela enquanto o visitante rola,
e a rolagem controla a cena:

| Capítulo | Texto | O que acontece no 3D |
|---|---|---|
| Abertura | "Água limpa, segurança e qualidade para sua família." | Purificador no pedestal, girando com o cursor |
| 01 Escolha | "Novo ou seminovo. Você escolhe." (preços do `config.js`) | Gira de frente e o acabamento muda de branco para prata |
| 02 Instalação | "Instalado onde você precisa." | Vista lateral |
| 03 Cuidado | "Filtro em dia, água cuidada." | A câmera aproxima e **o copo começa a encher** |
| Final | "Beba água limpa." | Copo cheio, purificador inteiro |

O mesmo tema segue pelo site: um **copo que enche conforme a leitura** (canto inferior esquerdo, volta ao
topo), a **água que desce pela linha** do "Como funciona", cartões que **aparecem de baixo para cima como
água subindo** e uma faixa de marca que corre com a rolagem.

## Direção de arte

- **Conceito "água cristalina":** seções escuras e profundas (confiança, tecnologia) alternadas com branco e
  névoa (limpeza). Paleta azul + branco + cinza, com um aqua de destaque para luz e água.
- **Tipografia:** Sora nos títulos, Manrope no texto e Instrument Serif em itálico para as palavras de
  destaque ("*sua família.*", "*limpa.*"). Fontes do Google Fonts; sem internet, o site usa as do sistema.
- **3D de verdade no topo:** um purificador modelado em Three.js, com materiais físicos (verniz, cromado,
  vidro e água), pedestal iluminado e partículas de luz. Ele gira levemente com o cursor e com a rolagem.
- **Imagens dos produtos e da galeria:** renders 3D do mesmo modelo, em WebP com fundo transparente
  (35–60 KB cada). São **ilustrativas** e aparecem marcadas assim até a chegada das fotos reais.

## Estrutura

```
atalaia-purificadores/
├── index.html              Página única com todas as seções
├── robots.txt
├── css/style.css           Estilos (tokens de cor e fonte em :root)
├── js/
│   ├── config.js           ★ CONTATOS, PREÇOS, PRODUTOS, IMAGENS E INTEGRAÇÕES
│   ├── utils.js            Funções compartilhadas (WhatsApp, storage, formulários, diálogos)
│   ├── location.js         Endereço: manual, busca por CEP (ViaCEP) e geolocalização
│   ├── checkout.js         Catálogo, compra, serviços, diagnóstico em etapas e prévia da mensagem
│   ├── gallery.js          Vitrine (carrossel) + lightbox
│   ├── reviews.js          Avaliações (camada de dados trocável)
│   ├── story.js            História em rolagem (capítulos, progresso 0→1 para a cena)
│   ├── hero3d.js           Decide se carrega a cena 3D e faz a troca imagem → 3D
│   ├── scene3d.js          Cena 3D empacotada (gerada — não editar à mão)
│   └── main.js             Menu, rolagem, animações e microinterações
├── assets/
│   ├── icons/              favicon.svg, apple-touch-icon.png
│   ├── images/             og-image.png (imagem de compartilhamento)
│   └── products/           Renders 3D (WebP) dos produtos e da galeria
└── dev/                    Só para desenvolvimento (não precisa ser publicado)
    ├── 3d/purifier-scene.js  Código-fonte da cena 3D
    └── package.json          Script que gera js/scene3d.js
```

Os scripts são clássicos (`defer`), não módulos ES, porque módulos ES não carregam via `file://` no Chrome.

## Como executar

**Opção 1:** abra `index.html` com dois cliques.

**Opção 2 (recomendada para testar no celular):** sirva a pasta localmente:

```bash
npx serve atalaia-purificadores      # ou: python3 -m http.server --directory atalaia-purificadores
```

> A geolocalização exige conexão segura: funciona em `file://` e `localhost` no computador, mas no
> celular só com o site publicado em **https**.

### Alterar a cena 3D (opcional)

```bash
cd atalaia-purificadores/dev
npm install
npm run build:3d       # gera ../js/scene3d.js a partir de 3d/purifier-scene.js
```

Cores e variações do purificador ficam em `VARIANTS`, no início de `dev/3d/purifier-scene.js`.

## Publicação

Publique o conteúdo de `atalaia-purificadores/` (a pasta `dev/` pode ficar de fora). Depois de ter o domínio:

1. Troque `SEU-DOMINIO.com.br` no `index.html` (canonical, Open Graph e dados estruturados).
2. Descomente a linha `Sitemap:` no `robots.txt`, se for criar um sitemap.

---

## Onde editar cada coisa

Quase tudo fica em **`js/config.js`**:

| O que | Onde |
|---|---|
| WhatsApp, Instagram, região | `contact` |
| Mensagens dos botões simples de WhatsApp | `whatsappMessages` |
| Produtos (nome, modelo, estado, preço, descrição, itens, imagem) | `products` |
| Título/descrição das categorias Novos e Seminovos | `categories` |
| Imagens da galeria (vitrine) | `gallery` |
| Imagem do topo e liga/desliga da cena 3D | `hero` |
| Opções do diagnóstico | `problems` |
| CEP / geocodificação reversa | `integrations` |
| Limites e aviso das avaliações | `reviews` |

Textos institucionais (Sobre, Serviços, Como funciona, Garantia, Rodapé) estão no `index.html`, com
comentários marcando cada seção. Cores, fontes e espaçamentos ficam no topo do `css/style.css` (`:root`).

### Trocar as imagens ilustrativas pelas fotos reais

1. Coloque as fotos em `assets/products/`. Recomendado: WebP ou JPG com cerca de 1200×1200 px e até 200 KB.
   Fotos com fundo recortado (PNG/WebP transparente) ficam melhores sobre o palco escuro dos cards.
2. Atualize `image` (e opcionalmente `imageWebp` / `imageAvif`) em `products` e `gallery`.
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
| **Google Fonts** (Sora, Manrope, Instrument Serif) | ✅ Opcional | Sem internet, o site usa as fontes do sistema. |
| **Domínio** | ⚠️ Pendente | Trocar `SEU-DOMINIO.com.br` no `index.html`. |

### Avaliações com backend (Supabase, Firebase etc.)

`js/reviews.js` tem uma camada de dados (`ReviewsStore.adapter`) com a interface `{ list(), add(review) }`.
Há um adaptador **Supabase comentado** pronto para adaptar (tabela, colunas e políticas RLS descritas no
comentário). Recomenda-se moderação (`approved = true`) antes de exibir publicamente. Depois de conectar,
defina `reviews.showLocalNotice: false` no `config.js`.

O conteúdo das avaliações é sempre exibido como texto (`textContent`): o site não interpreta HTML vindo do
usuário, e os campos têm validação e limite de caracteres.

---

## Informações a confirmar

Nada foi inventado. Os itens abaixo aparecem como `[INFORMAÇÃO A CONFIRMAR]` / `[A CONFIRMAR]`:

- Modelo(s) dos purificadores e especificações técnicas (`config.js` → `products`)
- Ano de fundação e CNPJ (seção Sobre, `index.html`). Preencha ou remova o bloco `facts`.
- Condições da garantia de 3 meses (o site orienta consultar pelo WhatsApp)
- Fotos reais dos produtos

Frase de marca sugerida na seção Sobre, para aprovação: *"Atalaia é quem vigia e protege. É com esse cuidado
que tratamos a água que você bebe."* (`index.html`, classe `about__statement`).

O site **não** contém avaliações, clientes, certificações, prêmios, marcas parceiras, endereço comercial
ou anos de experiência inventados.

---

## Experiência e movimento

- **História no topo:** com "Pular apresentação" sempre à mão. No celular, o 3D fica esmaecido atrás do texto
  de abertura e surge quando a história começa. Sem WebGL (ou em aparelhos modestos), as imagens 3D
  estáticas trocam a cada capítulo; com "reduzir movimento", tudo aparece sem animação.
- **Efeitos ligados à rolagem:** um único laço por quadro (`Atalaia.onScroll` em `js/utils.js`) alimenta a
  história, o copo medidor, a faixa de marca, a linha d'água, os cartões empilhados dos serviços e a cor do
  cabeçalho (escuro sobre seções escuras, claro sobre as claras). Nada sequestra a rolagem.
- **Ordem das seções (prioridade do celular):** Topo → Purificadores → Garantia e compra segura →
  Como funciona (com WhatsApp) → Serviços → Diagnóstico → Área de atendimento → Sobre/Diferenciais →
  Galeria → Avaliações → Contato. O menu mantém a ordem pedida.
- **Como funciona:** quatro passos que explicam o fluxo real do site (escolher → endereço → conferir →
  WhatsApp), para o visitante saber o que acontece antes de clicar.
- **Diagnóstico em etapas:** problema → detalhes → seus dados, com barra de progresso, validação por etapa
  e botão de voltar. Sem JavaScript, o formulário aparece inteiro.
- **Vitrine da galeria:** troca automática só quando está na tela, barra de tempo, setas, miniaturas,
  arrastar/deslizar e pausa. Toque na imagem abre o lightbox com zoom.
- **Prévia antes do WhatsApp:** compra, serviço e diagnóstico mostram a mensagem completa antes de abrir o
  WhatsApp, com opção de voltar e editar.
- **Sistema de movimento:** títulos que sobem palavra por palavra, entradas em cascata ao rolar, barra de
  leitura no topo, header que some ao rolar para baixo e volta ao subir, menu mobile em tela cheia com entrada
  em cascata, onda de água no toque dos botões, botões "magnéticos", cards com inclinação 3D, reflexo e luz
  que segue o cursor, ícones em camadas, radar animado na área de atendimento e faixa de marca contínua.
  Tudo usa `transform`/`opacity`; não há sequestro de rolagem.
- **Desempenho do 3D:** a imagem estática aparece primeiro; a cena (530 KB, ~136 KB com gzip) só carrega
  depois da página, quando há WebGL2, sem "reduzir movimento" e sem economia de dados. Ela pausa quando a
  história sai da tela e com a aba oculta, limita a resolução (1,5× no desktop, 1,25× no celular) e reduz a
  qualidade sozinha se os quadros ficarem lentos.
  Se algo falhar, a imagem continua no lugar.
- **Movimento reduzido / aparelhos modestos:** com `prefers-reduced-motion` todas as animações são
  desligadas e o 3D não é carregado; em aparelhos modestos (≤ 4 núcleos / ≤ 4 GB / economia de dados) os
  efeitos de vidro fosco e as animações contínuas são desligados.
- **Acessibilidade:** navegação por teclado, foco visível, `<dialog>` nativo (Esc fecha, foco preso),
  menu com foco preso, labels em todos os campos, erros ligados por `aria-describedby`, foco movido para o
  título de cada etapa, vitrine pausável, textos com contraste AA e áreas de toque de pelo menos 44 px.

### Sobre "Sedance 2.5"

Não existe biblioteca web chamada "Sedance 2.5". O 3D foi feito com Three.js (cena interativa) e CSS
(profundidade dos cards e ícones). Se a referência for ao **Seedance** (modelo de IA da ByteDance que gera
vídeos), ele pode ser usado fora do site para criar um vídeo curto do produto, que pode entrar na vitrine.

---

## Testes realizados

Testado com Chromium (Playwright) em 320, 375, 390, 430, 768, 1024, 1366, 1440 e 1920 px:

- Sem rolagem horizontal e sem erros no console em todas as larguras
- Menu desktop e mobile (abrir, Esc, fechar ao navegar, posição da seção abaixo do header)
- História em rolagem: capítulos avançam 1→4, imagem do capítulo ativa, progresso chega a 1, preços vindos do
  `config.js`, "Pular apresentação", capítulo "Instalação" abre o pedido de serviço
- Copo medidor (aparece depois da história, enche com a leitura, volta ao topo), cartões empilhados,
  linha d'água do "Como funciona" e faixa de marca guiada pela rolagem
- Cena 3D: carrega com WebGL, sem erros, canvas com tamanho; imagem de reserva carregada; com
  "reduzir movimento" o 3D não é baixado e o conteúdo fica visível
- Promoção removida: sem seção, sem contador, sem `promotion.js`
- Compra: validação, foco no erro, busca por CEP (sucesso, CEP inexistente, falha da API), mensagem exata,
  `encodeURIComponent`, prévia, voltar e editar, abertura do WhatsApp
- Geolocalização com permissão (link do mapa na mensagem) e com permissão negada (sem localização falsa)
- Serviços; diagnóstico em etapas (validação por etapa, voltar mantém dados, "Outro problema" exige
  descrição, mensagem exata)
- Vitrine (automática, setas, miniaturas, arrastar, deslizar no toque, pausa) e lightbox (anterior/próxima,
  teclado, zoom, Esc, foco de volta)
- Avaliações: validação, sanitização contra HTML/script, média, persistência após recarregar
- Instagram, WhatsApp flutuante, mensagem de cobertura, copyright automático, alt em todas as imagens

A busca de CEP foi testada com respostas simuladas (o ambiente de testes não acessa a internet), e o 3D com
renderização por software. Antes de publicar, teste num celular real: CEP, localização (com https),
fluidez do 3D e abertura do WhatsApp.
