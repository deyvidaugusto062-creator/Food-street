import {
  DEFAULT_AUDIO,
  defaultExportSettings,
  defaultTextStyle,
  defaultVisual,
  FrameStudioError,
  PROJECT_FORMAT_VERSION,
  type Clip,
  type Project,
} from '@framestudio/shared';

type AnyRecord = Record<string, unknown>;

/**
 * Migrações de formato: cada função converte do formato `n` para `n + 1`.
 * Ao alterar o modelo de forma incompatível, incremente PROJECT_FORMAT_VERSION e adicione a função aqui.
 */
export const MIGRATIONS: Record<number, (p: AnyRecord) => AnyRecord> = {
  // Exemplo para versões futuras:
  // 1: (p) => ({ ...p, novoCampo: valorPadrao }),
};

const isObj = (v: unknown): v is AnyRecord => !!v && typeof v === 'object' && !Array.isArray(v);

/** Preenche campos ausentes com padrões, sem sobrescrever os existentes. */
function withDefaults<T>(value: unknown, defaults: T): T {
  if (!isObj(defaults)) return (value === undefined ? defaults : value) as T;
  const out: AnyRecord = { ...(defaults as AnyRecord) };
  if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) {
      const d = (defaults as AnyRecord)[k];
      out[k] = isObj(d) && isObj(v) ? withDefaults(v, d) : v;
    }
  }
  return out as T;
}

function normalizeClip(raw: AnyRecord): Clip {
  const base = { keyframes: {}, ...raw } as AnyRecord;
  switch (raw.type) {
    case 'video':
      return withDefaults(base, { ...defaultVisual(), audio: { ...DEFAULT_AUDIO }, sourceIn: 0, speed: 1, reverse: false, freeze: false }) as unknown as Clip;
    case 'image':
      return withDefaults(base, defaultVisual()) as unknown as Clip;
    case 'audio':
      return withDefaults(base, { audio: { ...DEFAULT_AUDIO }, sourceIn: 0, speed: 1, reverse: false, freeze: false }) as unknown as Clip;
    case 'text':
      return withDefaults(base, { ...defaultVisual(), text: defaultTextStyle() }) as unknown as Clip;
    case 'caption':
      return withDefaults(base, {
        ...defaultVisual(),
        text: defaultTextStyle(),
        words: [],
        caption: { highlightWords: false, highlightColor: '#8257FF', wordByWord: false },
      }) as unknown as Clip;
    case 'adjustment': {
      const v = defaultVisual();
      return withDefaults(base, { effects: v.effects, color: v.color, opacity: 1 }) as unknown as Clip;
    }
    default:
      throw new FrameStudioError('INVALID_PROJECT', `Tipo de clipe desconhecido: ${String(raw.type)}`);
  }
}

/**
 * Valida e atualiza um projeto lido do disco. Lança INVALID_PROJECT quando o arquivo não é um
 * projeto do FrameStudio ou foi criado por uma versão mais nova.
 */
export function migrateProject(input: unknown): Project {
  if (!isObj(input)) throw new FrameStudioError('INVALID_PROJECT', 'Arquivo de projeto inválido.');
  let p: AnyRecord = { ...input };
  let version = typeof p.formatVersion === 'number' ? p.formatVersion : 1;
  if (version > PROJECT_FORMAT_VERSION) {
    throw new FrameStudioError('INVALID_PROJECT', `Este projeto foi criado por uma versão mais nova do FrameStudio (formato ${version}). Atualize o aplicativo.`);
  }
  while (version < PROJECT_FORMAT_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) throw new FrameStudioError('INVALID_PROJECT', `Sem migração do formato ${version}.`);
    p = m(p);
    version++;
  }
  if (typeof p.id !== 'string' || !isObj(p.settings) || !Array.isArray(p.tracks)) {
    throw new FrameStudioError('INVALID_PROJECT', 'Estrutura do projeto incompleta.');
  }
  const s = p.settings as AnyRecord;
  const width = Number(s.width);
  const height = Number(s.height);
  const fps = Number(s.fps);
  if (!(width > 0 && height > 0 && fps > 0)) throw new FrameStudioError('INVALID_PROJECT', 'Configurações do projeto inválidas.');
  const clips: Record<string, Clip> = {};
  const trackIds = new Set((p.tracks as AnyRecord[]).map((t) => String(t.id)));
  for (const [id, c] of Object.entries(isObj(p.clips) ? p.clips : {})) {
    if (!isObj(c) || !trackIds.has(String(c.trackId))) continue; // descarta órfãos
    clips[id] = normalizeClip({ ...c, id });
  }
  const name = typeof p.name === 'string' ? p.name : 'Projeto';
  const project: Project = {
    id: p.id,
    formatVersion: PROJECT_FORMAT_VERSION,
    name,
    createdAt: Number(p.createdAt) || Date.now(),
    updatedAt: Number(p.updatedAt) || Date.now(),
    favorite: !!p.favorite,
    settings: { width, height, fps, background: typeof s.background === 'string' ? s.background : '#000000', sampleRate: Number(s.sampleRate) || 48000 },
    assets: (isObj(p.assets) ? p.assets : {}) as Project['assets'],
    tracks: (p.tracks as AnyRecord[]).map((t) =>
      withDefaults(t, { id: '', kind: 'video', name: 'Faixa', locked: false, hidden: false, muted: false, solo: false, volume: 1, height: 64 }),
    ) as Project['tracks'],
    clips,
    transitions: (isObj(p.transitions) ? p.transitions : {}) as Project['transitions'],
    markers: (Array.isArray(p.markers) ? p.markers : []) as Project['markers'],
    luts: (isObj(p.luts) ? p.luts : {}) as Project['luts'],
    exportSettings: withDefaults(p.exportSettings, defaultExportSettings(name, fps)),
    templateId: typeof p.templateId === 'string' ? p.templateId : undefined,
    thumbnail: typeof p.thumbnail === 'string' ? p.thumbnail : undefined,
  };
  // Remove transições que apontam para clipes inexistentes.
  for (const [id, t] of Object.entries(project.transitions)) {
    if (!project.clips[t.fromClipId] || !project.clips[t.toClipId]) delete project.transitions[id];
  }
  return project;
}
