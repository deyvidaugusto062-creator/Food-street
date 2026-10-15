# Projetos de exemplo

Arquivos `.fstudio` empacotados com as mídias (geradas por FFmpeg, sem conteúdo de terceiros).
Abra o FrameStudio, clique em **Importar projeto** e escolha um deles.

| Arquivo | Conteúdo |
| --- | --- |
| `horizontal-transicao.fstudio` | 16:9 · dois clipes com transição dissolver, correção de cor, vinheta, título animado, música com fade e marcador |
| `reels-legendas.fstudio` | 9:16 · foto com zoom lento (Ken Burns), narração e legendas com destaque palavra a palavra |

Para regenerar: `npm run fixtures && npm run examples`. O teste `e2e/examples.spec.ts` importa e exporta cada exemplo.
