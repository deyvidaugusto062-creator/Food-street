# Arquitetura do FrameStudio AI

## Visão geral

```
apps/web  (React 19 + Vite 8 + Tailwind 4 + Zustand 5)  ── interface desktop, mobile e PWA
apps/desktop (Tauri 2)                                  ── mesmo build web + integrações nativas mínimas
apps/mobile  (Capacitor 8)                              ── mesmo build web empacotado para Android/iOS
        │
        ▼  todas as alterações passam por EditOp → applyOp (validado, atômico, desfazível)
packages/editor-core     operações estruturadas, histórico, efeitos, saneamento de valores
packages/timeline        modelo de timeline em frames: cortes, ripple, slip, velocidade, transições, keyframes, snap
packages/shared          contratos TypeScript (Project, Clip, Track…), tempo, easing, erros
packages/render-engine   Compositor único (Canvas 2D + WebGL2) usado no preview E na exportação; exportação
packages/media-engine    validação/probe de arquivos, capacidades do dispositivo, leitores de quadro, miniaturas, proxies
packages/audio-engine    decodificação, mixagem Web Audio (preview = exportação), LUFS, silêncio, redução de ruído
packages/ai-engine       assistente de comandos, silêncios, legendas, ducking, reenquadramento, sugestões, destaques
packages/project-storage IndexedDB + OPFS, formato .fstudio (ZIP), migrações, autosave
packages/ui              design system acessível (Radix UI) com a paleta do FrameStudio
```

Cada camada pedida no briefing tem um dono claro:

| Camada | Onde |
| --- | --- |
| Interface | `apps/web/src/components`, `packages/ui` |
| Estado do projeto | `apps/web/src/state/editor.ts` (Zustand) sobre `editor-core` |
| Modelo da timeline | `packages/timeline` + `packages/shared/src/model.ts` |
| Processamento de mídia | `packages/media-engine`, `packages/audio-engine` |
| Preview | `apps/web/src/preview/engine.ts` → `render-engine/Compositor` |
| Exportação | `packages/render-engine/src/export.ts` → mesmo `Compositor` |
| Inteligência artificial | `packages/ai-engine`, `apps/web/src/workers/whisper.worker.ts` |
| Persistência | `packages/project-storage` |

## Decisões principais

### 1. Um único motor de composição (preview = exportação)

O briefing pede resultado consistente entre preview e exportação e proíbe misturar motores sem
responsabilidades claras. Por isso **existe um só compositor** (`render-engine/src/compositor.ts`):

* Recebe `(projeto, frame, fontes de quadro)` e desenha o quadro inteiro.
* Transformações, opacidade, blend modes, transições e texto: Canvas 2D.
* Cor, curvas, HSL, LUT 3D, efeitos e máscaras: WebGL2 (`render-engine/src/gl`), com os mesmos shaders nos dois caminhos.
* **Só a fonte dos quadros muda**: no preview, elementos `<video>` sincronizados ao relógio de áudio;
  na exportação, decodificação quadro a quadro exata via WebCodecs (Mediabunny `CanvasSink`).
* O áudio usa a mesma função `buildMix` (Web Audio) num `AudioContext` (preview) e num
  `OfflineAudioContext` (exportação).

Remotion e FFmpeg.wasm **não** foram usados no caminho principal: Remotion exige renderização em
servidor/Node para exportar e o FFmpeg.wasm é lento (sem aceleração) e pesado (~30 MB). WebCodecs +
Mediabunny dá codificação acelerada por hardware no próprio navegador.

### 2. Timeline baseada em frames, não destrutiva

* Posição/duração em **frames inteiros** do projeto; ponto de entrada na mídia em **segundos**
  (a mídia pode ter outro FPS).
* Clipes apontam para `MediaAsset.id`; o arquivo original nunca é alterado. A mídia importada é
  **copiada** para o armazenamento local (OPFS/IndexedDB).
* Cada clipe guarda: id, asset, início, duração, `sourceIn`, velocidade, reverso, congelado,
  transformações, cor, efeitos, máscara, áudio e keyframes.

### 3. Operações estruturadas como única porta de escrita

`EditOp` (união discriminada em `editor-core/src/ops.ts`) é usada pela UI, atalhos, interface mobile,
templates e IA. `applyOp`:

* aplica com Immer (compartilhamento estrutural → undo/redo barato por snapshots);
* é **atômico** (um `batch` falha inteiro);
* valida tipos, intervalos e chaves (rejeita `__proto__`, chaves desconhecidas e campos proibidos).

A IA nunca executa código: propõe `EditOp`s de uma **lista permitida** (`AI_ALLOWED_OPS`), que são
simuladas antes de serem mostradas, e o usuário confirma.

### 4. Persistência local

* Projetos: IndexedDB (`projects`, `summaries`, `recovery`, `cache`, `settings`).
* Mídia: OPFS quando disponível (gravação em streaming, arquivos grandes) ou IndexedDB.
* Autosave a cada alteração (debounce 1,5 s) grava um **ponto de recuperação**; Ctrl+S e sair do
  editor gravam a versão oficial. Ao reabrir, versões de recuperação mais novas são oferecidas.
* `.fstudio` = ZIP com `manifest.json`, `project.json` e, opcionalmente, `media/` (empacotado).
  Migrações por versão de formato (`project-storage/src/migrations.ts`).

## Análise de compatibilidade

| Recurso | Chrome/Edge (desktop) | Firefox | Safari 17+ (macOS/iOS) | Android (Chrome) | Tauri Linux (WebKitGTK) |
| --- | --- | --- | --- | --- | --- |
| Interface, timeline, projetos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Preview de vídeo | ✅ | ✅ | ✅ | ✅ | ✅ (codecs via GStreamer) |
| WebGL2 (cor/efeitos) | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebCodecs — decodificação exata | ✅ | ✅ (130+) | ✅ | ✅ | ⚠️ depende da versão |
| WebCodecs — exportação H.264/AAC | ✅ | ⚠️ H.264 sim, AAC depende do SO | ✅ | ✅ | ⚠️ pendente |
| VP9/AV1/Opus | ✅ | ✅ | parcial | ✅ | ⚠️ |
| OPFS | ✅ | ✅ | ✅ | ✅ | ✅ |
| File System Access (salvar direto no disco) | ✅ | ❌ (download) | ❌ (download) | ❌ | ✅ (diálogo nativo) |
| Whisper local | WebGPU ou WASM | WASM | WASM/WebGPU | WASM (lento) | WASM |

A aplicação **detecta** tudo isso em tempo de execução (`media-engine/src/capabilities.ts`) e só
oferece formatos/codecs/resoluções que o dispositivo realmente consegue codificar. O Chromium
open-source usado nos testes automatizados não tem H.264/AAC (codecs proprietários); nele a
exportação usa automaticamente AV1/VP9 + Opus — os testes validam exatamente isso.

## Desempenho

* Preview com qualidade ajustável (100% / 50% / 33% da resolução, limitado a 1920 px).
* Proxies 540p gerados sob demanda (Mediabunny `Conversion`), usados só no preview.
* Miniaturas e formas de onda calculadas uma vez e guardadas em cache no IndexedDB.
* Áudio decodificado com cache LRU limitado (1,5 GB de PCM).
* Leitores de vídeo da exportação abertos por clipe e liberados quando saem de uso.
* Transcrição em Web Worker; exportação cede o loop de eventos a cada 5 quadros.
* Bundle: entrada de ~27 KB + chunks de vendor; editor carregado sob demanda; runtime ONNX (27 MB)
  servido localmente e baixado só quando a transcrição é usada.
* Monitor de desempenho no editor (menu ⋯): ms por quadro, fps do preview e memória JS.

## Limitações conhecidas

* Exportação roda na thread principal (com cessões periódicas). Mover para Worker com
  `OffscreenCanvas` é o próximo passo.
* Reverso no preview depende de seeks do `<video>` (pode engasgar); na exportação é exato.
* Velocidade altera o tom do áudio (sem time-stretch). Rampas de velocidade ainda não existem.
* Redução de ruído é espectral clássica (sem IA) e processada por completo antes de tocar.
* Áudio de clipes é totalmente decodificado em memória (cuidado com gravações de várias horas).
* GIFs animados entram como imagem estática.
* Transcrição Whisper: implementada, mas **não validada neste ambiente** (sem acesso ao Hugging Face).
* Remoção de fundo por IA: não implementada (sem modelo testado).
* App desktop: exportação depende do WebCodecs do WebKitGTK; FFmpeg nativo como sidecar está pendente.
* Builds Android/iOS: projetos nativos gerados, mas não compilados aqui (sem Android SDK/Xcode).

## Licenças das dependências

| Dependência | Licença |
| --- | --- |
| React, React DOM, Zustand, Immer, fflate, Tailwind CSS, Vite, Radix UI | MIT |
| Lucide | ISC |
| Mediabunny | MPL-2.0 (uso como biblioteca, sem modificações) |
| transformers.js | Apache-2.0 |
| ONNX Runtime Web | MIT |
| Modelos Whisper (OpenAI, conversões ONNX) | MIT |
| Tauri | MIT / Apache-2.0 |
| Capacitor | MIT |
| Fontes (Inter, Montserrat, Poppins, Oswald, Bebas Neue, Anton, Playfair Display, Roboto Mono) | OFL-1.1 |
| Permanent Marker | Apache-2.0 |

Nenhuma dependência paga. Codecs: H.264/H.265 são usados apenas por meio do codificador do sistema
(navegador/SO), que já cobre o licenciamento.

## Custos

* Execução local: **sem custo** de servidor. Não há backend.
* IA local (Whisper): download único de 41–250 MB por modelo, guardado no navegador.
* Provedor de IA opcional (desligado por padrão): cobrado pelo provedor escolhido pelo usuário,
  apenas para comandos livres e tradução de legendas. Nenhum vídeo é enviado.
