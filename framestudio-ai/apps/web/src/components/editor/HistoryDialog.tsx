import { Button, Dialog, EmptyState } from '@framestudio/ui';
import { History } from 'lucide-react';
import { useEditor } from '../../state/editor.ts';

export function HistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  // Re-renderiza quando o histórico muda.
  useEditor((s) => s.canUndo && s.undoLabel);
  useEditor((s) => s.canRedo && s.redoLabel);
  const entries = open ? useEditor.getState().historyEntries() : [];
  const undoTo = (index: number) => {
    const n = entries.length - 1 - index;
    for (let i = 0; i < n; i++) useEditor.getState().undo();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Histórico de operações" description="Clique numa operação para voltar até ela. Você pode refazer em seguida." footer={<Button onClick={() => onOpenChange(false)}>Fechar</Button>}>
      {entries.length === 0 ? (
        <EmptyState icon={<History size={24} />} title="Nenhuma alteração nesta sessão" />
      ) : (
        <ol className="flex flex-col-reverse gap-0.5">
          {entries.map((e, i) => (
            <li key={`${e.time}-${i}`}>
              <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2" onClick={() => undoTo(i)}>
                <span className={i === entries.length - 1 ? 'font-medium text-fg' : 'text-fg-muted'}>{e.label}</span>
                <span className="font-mono text-[10px] text-fg-subtle">{new Date(e.time).toLocaleTimeString('pt-BR')}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
