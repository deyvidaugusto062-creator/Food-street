import { useEffect, useRef, useState, type ReactNode } from 'react';
import './Modal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** id do título para aria-labelledby */
  labelledBy?: string;
  label?: string;
  variant?: 'center' | 'drawer' | 'sheet' | 'fullscreen';
  className?: string;
  children: ReactNode;
}

const EXIT_MS = 240;

/**
 * Modal acessível sobre <dialog> nativo: foco preso, Esc fecha, fundo inerte,
 * clique fora fecha. Animação de entrada e saída via CSS (data-state).
 */
export function Modal({ open, onClose, labelledBy, label, variant = 'center', className = '', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        returnFocus.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
      }
      // espera um quadro para a transição de entrada acontecer
      let raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => (dialog.dataset.state = 'open'));
      });
      return () => cancelAnimationFrame(raf);
    }
    if (dialog.open) {
      dialog.dataset.state = 'closing';
      const t = setTimeout(() => {
        dialog.close();
        setMounted(false);
        returnFocus.current?.focus?.({ preventScroll: true });
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <dialog
      ref={ref}
      className={`modal modal--${variant} ${className}`}
      aria-labelledby={labelledBy}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__panel">{children}</div>
    </dialog>
  );
}
