import { useEffect, useState } from 'react';
import { useCart } from '../../store/cart';
import { Icon } from './Icon';
import './Toast.css';

/** Aviso flutuante quando o carrinho muda (também anunciado ao leitor de tela) */
export function Toast() {
  const { notice, open, isOpen } = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const show = visible && !isOpen;

  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite">
        {notice?.text}
      </div>
      <div className={`toast ${show ? 'is-visible' : ''}`} aria-hidden={!show}>
        <span className="toast__icon">
          <Icon name="check" />
        </span>
        <span className="toast__text">{notice?.text}</span>
        <button type="button" className="toast__action" onClick={open} tabIndex={show ? 0 : -1}>
          Ver carrinho
        </button>
      </div>
    </>
  );
}
