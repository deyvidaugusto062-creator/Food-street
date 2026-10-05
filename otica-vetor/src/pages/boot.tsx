import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/instrument-sans/wdth.css';
import '@fontsource-variable/manrope/wght.css';
import '../styles/tokens.css';
import '../styles/base.css';
import { applyFxTier } from '../utils/perf';

/** Inicialização comum às páginas */
export function boot(app: ReactNode) {
  applyFxTier();
  createRoot(document.getElementById('root')!).render(<StrictMode>{app}</StrictMode>);
}
