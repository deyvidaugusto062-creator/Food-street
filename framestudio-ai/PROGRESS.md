# Progresso do FrameStudio AI

Legenda: ✅ concluído e testado · 🟡 implementado com limitação documentada · ⏳ pendente

Testes atuais: **68 unitários** (Vitest) e **12 E2E** (Playwright + FFprobe; 10 funcionais + 2 que geram as capturas da documentação), todos passando.
Builds: web/PWA ✅ · desktop Linux `.deb` (Tauri) ✅ gerado e aberto em Xvfb · Android/iOS: projetos
nativos gerados, não compilados (sem SDK neste ambiente).

## Fase 1 — Fundação ✅

| Item | Status | Onde |
| --- | --- | --- |
| Monorepo (npm workspaces), TypeScript estrito | ✅ | `package.json`, `tsconfig.base.json` |
| Arquitetura em módulos com contratos TS | ✅ | `packages/*`, `docs/ARCHITECTURE.md` |
| Design system (tema escuro/claro, paleta, animações, acessibilidade Radix) | ✅ | `packages/ui`, `apps/web/src/styles.css` |
| Navegação (home ↔ editor) | ✅ | `apps/web/src/lib/route.ts` |
| Armazenamento local (IndexedDB + OPFS) | ✅ | `packages/project-storage` |

## Fase 2 — Editor funcional ✅

| Item | Status | Observação |
| --- | --- | --- |
| Importação real (MP4, MOV, WebM, MKV, MP3, WAV, AAC, M4A, OGG, FLAC, PNG, JPG, WebP, GIF) | ✅ | validação por assinatura binária; codec verificado no dispositivo |
| Metadados (duração, resolução, FPS, codec, tamanho, rotação, canais) | ✅ | Mediabunny + fallback HTML5 |
| Miniaturas e formas de onda (com cache) | ✅ | |
| Preview com reprodução sincronizada ao áudio | ✅ | E2E `playback.spec.ts` |
| Timeline multifaixa baseada em frames | ✅ | |
| Cortar, aparar, dividir, mover, duplicar, excluir | ✅ | |
| Textos com estilos e animações | ✅ | |
| Áudio (volume, fades, mixagem) | ✅ | |
| Salvar / abrir / recuperar projeto | ✅ | |
| Exportar vídeo real (MP4/WebM/MOV) com áudio sincronizado | ✅ | verificado por FFprobe |
| Detecção de capacidade de exportação | ✅ | só oferece o que o dispositivo codifica |
| Cancelamento da exportação, progresso real | ✅ | |

## Fase 3 — Edição avançada ✅

| Item | Status | Observação |
| --- | --- | --- |
| Múltiplas faixas, bloquear/ocultar/silenciar/solo | ✅ | |
| Snap magnético, marcadores, seleção múltipla (área), grupos | ✅ | |
| Ripple edit, slip edit, copiar/colar atributos | ✅ | |
| Transições (12 tipos) com duração, direção, intensidade e curva | ✅ | verificado nos quadros exportados |
| Efeitos (19) com parâmetros animáveis, por GPU (WebGL2) | ✅ | |
| Correção de cor completa, curvas RGB, HSL, LUT .cube, presets, antes/depois | ✅ | |
| Keyframes (posição, escala, rotação, opacidade, volume, cor, efeitos) com linear/ease/hold/Bézier | ✅ | |
| Velocidade, câmera lenta, aceleração, reverso, congelar quadro | ✅ | reverso no preview pode engasgar (seek) |
| Rampas de velocidade | ⏳ | |
| Máscaras (retângulo, elipse, linear) com suavização e inversão | ✅ | |
| Recorte de enquadramento, espelhar, girar, ajuste conter/preencher/esticar | ✅ | |
| Camada de ajuste, blend modes (16), sobreposições/PiP | ✅ | |
| Chroma key com remoção de spill | ✅ | |
| Atalhos configuráveis que não interferem na digitação | ✅ | |
| Undo/redo, histórico de operações navegável | ✅ | |
| Áudio avançado: EQ 3 bandas, compressor/limiter, redução de ruído espectral, normalização LUFS (BS.1770), canais | ✅ | ruído: processamento offline |
| Gravação de narração pelo microfone | ✅ | |

## Fase 4 — Inteligência artificial

| Item | Status | Observação |
| --- | --- | --- |
| IA 1 — Legendas automáticas (Whisper local, word timestamps, destaque por palavra, SRT/VTT, incorporação) | 🟡 | implementado com transformers.js em Worker e consentimento; **não validado aqui** (Hugging Face bloqueado pela rede do ambiente). SRT/VTT e incorporação testados com legendas existentes |
| IA 2 — Remover silêncios com revisão | ✅ | E2E com narração sintética |
| IA 3 — Cortes inteligentes (pausas + palavras de preenchimento da transcrição) | ✅ | sem compreensão semântica (documentado na UI) |
| IA 4 — Reenquadramento automático | ✅ | heurística de saliência (bordas + movimento), não reconhece objetos |
| IA 5 — Assistente de comandos (pt/en/es) com prévia e confirmação | ✅ | interpretador local; provedor externo opcional com lista de operações permitidas |
| IA 6 — Transcrição pesquisável (localizar momentos por palavra) | ✅ | sobre as legendas geradas/editadas |
| IA 7 — Sugestões de melhoria com correção revisável | ✅ | |
| IA 8 — Remoção de fundo | ⏳ | aguardando modelo de segmentação testado (chroma key disponível) |
| IA 9 — Tradução de legendas | 🟡 | via provedor configurado; não testado sem chave |
| IA 10 — Clipes curtos a partir de gravação longa | ✅ | heurística de atividade sonora; cria projetos 9:16 |
| Ducking automático | ✅ | |

## Fase 5 — Mobile e desktop

| Item | Status | Observação |
| --- | --- | --- |
| PWA instalável, offline (service worker), manifest e ícones | ✅ | |
| Interface mobile própria (preview, timeline com pinça, barra inferior, folhas, toque ≥ 44 px, vibração) | ✅ | E2E em viewport Pixel 7 |
| Detecção de capacidades e alternativas (OPFS/IndexedDB, File System Access/download, WebGPU/WASM) | ✅ | |
| App desktop Tauri 2 com diálogo nativo de salvar e permissões mínimas | ✅ | `.deb` gerado e executado (Linux). Windows/macOS: configuração pronta, não compilado aqui |
| Exportação nativa com FFmpeg no desktop | ⏳ | hoje usa o WebCodecs do WebView |
| Android/iOS via Capacitor | 🟡 | projetos nativos gerados (`apps/mobile/android`, `ios`); build não executado (sem SDK/Xcode) |

## Fase 6 — Otimização

| Item | Status | Observação |
| --- | --- | --- |
| Proxies (540p) usados só no preview | ✅ | |
| Cache de miniaturas, formas de onda e áudio decodificado (LRU) | ✅ | |
| Preview em alta qualidade / equilibrado / desempenho | ✅ | |
| Workers (transcrição) e liberação de recursos | ✅ | |
| Exportação em Worker (OffscreenCanvas) | ⏳ | hoje na thread principal com cessões periódicas |
| Monitor de desempenho (ms/quadro, fps, memória) | ✅ | |
| Lazy loading do editor e chunks de vendor | ✅ | |
| Acessibilidade (rótulos ARIA, foco visível, teclado, `prefers-reduced-motion`) | ✅ | auditoria completa com leitor de tela pendente |
| Documentação (README, arquitetura, progresso, exemplos) | ✅ | |

## Próximos passos sugeridos

1. Validar a transcrição Whisper num ambiente com acesso ao Hugging Face (ou espelho próprio).
2. Mover a exportação para um Worker com `OffscreenCanvas`.
3. Sidecar FFmpeg no app desktop para exportação H.264/H.265 independente do WebView.
4. Rampas de velocidade e time-stretch de áudio (preservar tom).
5. Compilar e testar os apps Android/iOS em dispositivos reais.
6. Remoção de fundo com um modelo de segmentação (ex.: MediaPipe Selfie Segmentation) após testes.
