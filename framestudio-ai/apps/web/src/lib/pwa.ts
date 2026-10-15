import { toast } from '@framestudio/ui';

/** Registra o service worker (somente em produção) e avisa quando há atualização. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              toast({ kind: 'info', title: 'Nova versão disponível', description: 'Recarregue para atualizar o FrameStudio.', action: { label: 'Recarregar', onClick: () => location.reload() }, duration: 0 });
            }
          });
        });
      })
      .catch((e) => console.warn('Service worker não registrado', e));
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
}

export function canInstall(): boolean {
  return !!deferred;
}
export function onInstallAvailable(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}
