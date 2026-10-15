import { create } from 'zustand';

export type PreviewQuality = 'high' | 'balanced' | 'performance';
export type Theme = 'dark' | 'light' | 'system';

export interface AiProviderSettings {
  /** Endpoint compatível com a API de chat da OpenAI/Anthropic, opcional. Nunca usado sem consentimento. */
  enabled: boolean;
  provider: 'anthropic' | 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppSettings {
  theme: Theme;
  previewQuality: PreviewQuality;
  maxFileSizeGb: number;
  autosaveSeconds: number;
  useProxies: boolean;
  snapping: boolean;
  showSafeArea: boolean;
  whisperModel: 'tiny' | 'base' | 'small';
  /** Servidor de modelos (Hugging Face ou espelho próprio). */
  modelHost: string;
  ai: AiProviderSettings;
  shortcuts: Record<string, string>;
  layout: { left: number; right: number; timeline: number };
}

const DEFAULTS: AppSettings = {
  theme: 'system',
  previewQuality: 'balanced',
  maxFileSizeGb: 8,
  autosaveSeconds: 2,
  useProxies: true,
  snapping: true,
  showSafeArea: false,
  whisperModel: 'base',
  modelHost: 'https://huggingface.co/',
  ai: { enabled: false, provider: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: '', model: 'claude-sonnet-5-5' },
  shortcuts: {},
  layout: { left: 320, right: 320, timeline: 300 },
};

const KEY = 'fs.settings.v1';

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULTS, ...parsed, ai: { ...DEFAULTS.ai, ...parsed.ai }, layout: { ...DEFAULTS.layout, ...parsed.layout } };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<AppSettings & { set: (patch: Partial<AppSettings>) => void }>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    const { set: _s, ...rest } = get();
    void _s;
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* armazenamento indisponível */
    }
    if (patch.theme) applyTheme(patch.theme);
  },
}));

export function applyTheme(theme: Theme): void {
  const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f4f4f6' : '#101014');
  try {
    if (theme === 'system') localStorage.removeItem('fs.theme');
    else localStorage.setItem('fs.theme', theme);
  } catch {
    /* ignora */
  }
}
