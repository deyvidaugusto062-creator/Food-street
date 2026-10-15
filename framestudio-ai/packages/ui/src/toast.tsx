import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cx } from './primitives.tsx';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

type Push = (t: Omit<ToastItem, 'id'> & { duration?: number }) => number;
const Ctx = createContext<{ push: Push; dismiss: (id: number) => void } | null>(null);

let externalPush: Push | null = null;
/** Permite emitir toasts de fora da árvore React (serviços). */
export function toast(t: Omit<ToastItem, 'id'> & { duration?: number }): void {
  externalPush?.(t);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>(
    ({ duration, ...t }) => {
      const id = Date.now() + Math.random();
      setItems((l) => [...l.slice(-4), { ...t, id }]);
      const ms = duration ?? (t.kind === 'error' ? 8000 : 4000);
      if (ms > 0) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss],
  );
  externalPush = push;
  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);
  const icon = { info: <Info size={16} className="text-blue" />, success: <CheckCircle2 size={16} className="text-success" />, warning: <AlertTriangle size={16} className="text-warning" />, error: <XCircle size={16} className="text-danger" /> };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" role="region" aria-live="polite" aria-label="Notificações">
        {items.map((t) => (
          <div key={t.id} className={cx('fs-toast pointer-events-auto flex gap-3 rounded-xl border border-line bg-panel-2 p-3 shadow-2xl')} role={t.kind === 'error' ? 'alert' : 'status'}>
            <div className="mt-0.5">{icon[t.kind]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t.title}</p>
              {t.description && <p className="mt-0.5 break-words text-xs text-fg-muted">{t.description}</p>}
              {t.action && (
                <button
                  className="mt-2 text-xs font-semibold text-accent-soft hover:underline"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button aria-label="Fechar notificação" className="text-fg-subtle hover:text-fg" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast fora do ToastProvider');
  return c.push;
}
