import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './services/fonts.ts';
import './styles.css';
import { App } from './App.tsx';
import { applyTheme, useSettings } from './services/settings.ts';
import { registerServiceWorker } from './lib/pwa.ts';

applyTheme(useSettings.getState().theme);
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (useSettings.getState().theme === 'system') applyTheme('system');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();

