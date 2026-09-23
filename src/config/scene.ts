/**
 * Configuração da cena 3D do hero.
 *
 * Para usar um modelo 3D real (fotogrametria ou modelado), exporte em .glb
 * (de preferência com compressão Draco), coloque em /public/models/ e informe
 * o caminho abaixo, ex.: '/models/king-brooklyn.glb'.
 * Vazio = burger procedural montado a partir de src/data/stacks.ts.
 */
export const HERO_MODEL_URL = '';

/** Escala e altura do modelo .glb, caso ele venha em outra unidade */
export const HERO_MODEL_SCALE = 1;
export const HERO_MODEL_OFFSET_Y = 0;

/** Decodificador Draco (usado só quando HERO_MODEL_URL estiver preenchido) */
export const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

/** Receita exibida no hero (chave de src/data/stacks.ts) */
export const HERO_STACK_ID = 'the-king-brooklyn';
