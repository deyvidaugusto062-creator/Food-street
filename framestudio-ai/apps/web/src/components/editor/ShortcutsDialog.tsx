import { useState } from 'react';
import { Button, Dialog, Kbd } from '@framestudio/ui';
import { SHORTCUTS, displayKeys, eventToKeys } from '../../hooks/useShortcuts.ts';
import { useSettings } from '../../services/settings.ts';

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const overrides = useSettings((s) => s.shortcuts);
  const [recording, setRecording] = useState<string | null>(null);
  const keysOf = (id: string) => overrides[id] ?? SHORTCUTS.find((s) => s.id === id)!.keys;
  const conflict = (id: string) => {
    const k = keysOf(id);
    return SHORTCUTS.some((s) => s.id !== id && keysOf(s.id) === k);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setRecording(null);
        onOpenChange(o);
      }}
      title="Atalhos de teclado"
      description="Clique em um atalho para redefini-lo. Atalhos não funcionam enquanto você digita em campos de texto."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => useSettings.getState().set({ shortcuts: {} })}>
            Restaurar padrões
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-xs">
            <span className="text-fg-muted">{s.label}</span>
            <button
              className={`rounded-md px-1 ${recording === s.id ? 'ring-2 ring-accent' : ''} ${conflict(s.id) ? 'text-warning' : ''}`}
              title={conflict(s.id) ? 'Conflito com outro atalho' : 'Clique e pressione a nova combinação'}
              onClick={() => setRecording(s.id)}
              onKeyDown={(e) => {
                if (recording !== s.id) return;
                e.preventDefault();
                e.stopPropagation();
                const keys = eventToKeys(e.nativeEvent);
                if (['Mod', 'Alt', 'Shift', 'Mod+Shift', ''].includes(keys)) return;
                useSettings.getState().set({ shortcuts: { ...overrides, [s.id]: keys } });
                setRecording(null);
              }}
            >
              <Kbd>{recording === s.id ? 'Pressione…' : displayKeys(keysOf(s.id))}</Kbd>
            </button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
