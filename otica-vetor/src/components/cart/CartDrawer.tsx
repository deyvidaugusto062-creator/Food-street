import { useEffect, useId, useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { ProductImage } from '../ui/ProductImage';
import { useCart } from '../../store/cart';
import { useProductView } from '../../store/productView';
import { formatPrice, maskPhone, pluralize } from '../../utils/format';
import { buildOrderMessage } from '../../services/order';
import { business, telLink, whatsappLink } from '../../data/business';
import { FULFILLMENT_OPTIONS, MAX_QTY } from '../../config/site';
import { SHOP_URL } from '../../data/nav';
import './CartDrawer.css';

type Step = 'carrinho' | 'dados' | 'enviar';

export function CartDrawer() {
  const cart = useCart();
  const [step, setStep] = useState<Step>('carrinho');

  // sempre reabre na lista
  useEffect(() => {
    if (cart.isOpen) setStep('carrinho');
  }, [cart.isOpen]);

  useEffect(() => {
    if (!cart.lines.length) setStep('carrinho');
  }, [cart.lines.length]);

  const titles: Record<Step, string> = {
    carrinho: 'Seu carrinho',
    dados: 'Solicitar atendimento',
    enviar: 'Enviar solicitação',
  };

  return (
    <Modal open={cart.isOpen} onClose={cart.close} labelledBy="cart-title" variant="drawer" className="cart-dialog">
      <header className="cart__head">
        {step !== 'carrinho' ? (
          <button type="button" className="icon-btn" onClick={() => setStep(step === 'enviar' ? 'dados' : 'carrinho')} aria-label="Voltar">
            <Icon name="arrowLeft" />
          </button>
        ) : (
          <span className="cart__head-icon" aria-hidden="true">
            <Icon name="bag" />
          </span>
        )}
        <div>
          <h2 id="cart-title">{titles[step]}</h2>
          <p>{pluralize(cart.count, 'item', 'itens')}</p>
        </div>
        <button type="button" className="icon-btn" onClick={cart.close} aria-label="Fechar carrinho">
          <Icon name="close" />
        </button>
      </header>

      <ol className="cart__steps" aria-label="Etapas">
        {(['carrinho', 'dados', 'enviar'] as Step[]).map((s, i) => (
          <li key={s} aria-current={s === step ? 'step' : undefined} className={(['carrinho', 'dados', 'enviar'] as Step[]).indexOf(step) >= i ? 'is-done' : ''}>
            <span>{i + 1}</span> {s === 'carrinho' ? 'Itens' : s === 'dados' ? 'Seus dados' : 'Enviar'}
          </li>
        ))}
      </ol>

      {step === 'carrinho' && <CartList onNext={() => setStep('dados')} />}
      {step !== 'carrinho' && <Checkout step={step} onStep={setStep} />}
    </Modal>
  );
}

function CartList({ onNext }: { onNext: () => void }) {
  const { lines, total, hasUnpriced, setQty, remove, close } = useCart();
  const { openProduct } = useProductView();

  if (!lines.length) {
    return (
      <div className="cart__empty">
        <div className="cart__empty-art" aria-hidden="true">
          <Icon name="glasses" />
        </div>
        <h3>Seu carrinho está vazio</h3>
        <p>Explore o catálogo e adicione as armações que você quer conhecer.</p>
        <a className="btn" href={SHOP_URL} onClick={close}>
          Ver armações <Icon name="arrowRight" />
        </a>
      </div>
    );
  }

  return (
    <>
      <ul className="cart__lines" role="list">
        {lines.map(({ product, qty, lineTotal }) => (
          <li key={product.id} className="cart__line">
            <button
              type="button"
              className="cart__thumb"
              onClick={() => {
                close();
                setTimeout(() => openProduct(product.slug), 260);
              }}
              aria-label={`Ver detalhes de ${product.name}`}
            >
              {product.images[0] && <ProductImage photo={product.images[0]} alt="" className={product.images[0].kind === 'modelo' ? 'is-photo' : ''} />}
            </button>
            <div className="cart__line-info">
              <h3>{product.name}</h3>
              <p>
                {product.color.name}
                {product.demo && <span className="badge badge--demo">Demonstrativo</span>}
              </p>
              <p className="cart__unit">{product.price === null ? 'Preço sob consulta' : `${formatPrice(product.price)} cada`}</p>
              <div className="cart__line-actions">
                <div className="qty qty--sm" role="group" aria-label={`Quantidade de ${product.name}`}>
                  <button type="button" onClick={() => setQty(product.id, qty - 1)} disabled={qty <= 1} aria-label="Diminuir quantidade">
                    <Icon name="minus" />
                  </button>
                  <output aria-live="polite">{qty}</output>
                  <button type="button" onClick={() => setQty(product.id, qty + 1)} disabled={qty >= MAX_QTY} aria-label="Aumentar quantidade">
                    <Icon name="plus" />
                  </button>
                </div>
                <button type="button" className="icon-btn cart__remove" onClick={() => remove(product.id)} aria-label={`Remover ${product.name}`}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            <p className="cart__line-total">{lineTotal === null ? '—' : formatPrice(lineTotal)}</p>
          </li>
        ))}
      </ul>

      <footer className="cart__foot">
        <dl className="cart__totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
          <div className="cart__total">
            <dt>Total estimado</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
          {hasUnpriced && <p className="cart__hint">+ itens com preço sob consulta</p>}
        </dl>
        <p className="cart__notice">
          <Icon name="info" />
          <span>
            <strong>Sem pagamento pelo site.</strong> Seu pedido é finalizado por atendimento com a equipe da {business.name}, que confirma disponibilidade e
            valores.
          </span>
        </p>
        <button type="button" className="btn btn--block" onClick={onNext}>
          Solicitar atendimento <Icon name="arrowRight" />
        </button>
      </footer>
    </>
  );
}

function Checkout({ step, onStep }: { step: Exclude<Step, 'carrinho'>; onStep: (s: Step) => void }) {
  const cart = useCart();
  const id = useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fulfillment, setFulfillment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const message = buildOrderMessage({
    name,
    phone,
    fulfillment: fulfillment || undefined,
    lines: cart.lines,
    total: cart.total,
    hasUnpriced: cart.hasUnpriced,
  });
  const wa = whatsappLink(message);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Informe seu nome.';
    if (phone.replace(/\D/g, '').length < 10) next.phone = 'Informe um telefone com DDD.';
    if (FULFILLMENT_OPTIONS.length && !fulfillment) next.fulfillment = 'Escolha uma opção.';
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`${id}-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    onStep('enviar');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // sem permissão de área de transferência: seleciona o texto para cópia manual
      const ta = document.getElementById(`${id}-msg`) as HTMLTextAreaElement | null;
      ta?.focus();
      ta?.select();
    }
  };

  if (step === 'dados') {
    return (
      <form className="cart__form" onSubmit={submit} noValidate>
        <div className="cart__scroll">
          <p className="cart__lead">Preencha seus dados para montar a solicitação. Nada é cobrado pelo site.</p>
          <div className="field">
            <label htmlFor={`${id}-name`}>Nome</label>
            <input
              id={`${id}-name`}
              className="input"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${id}-name-err` : undefined}
              required
            />
            {errors.name && (
              <p id={`${id}-name-err`} className="field-error">
                {errors.name}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${id}-phone`}>Telefone</label>
            <input
              id={`${id}-phone`}
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 90000-0000"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${id}-phone-err` : undefined}
              required
            />
            {errors.phone && (
              <p id={`${id}-phone-err`} className="field-error">
                {errors.phone}
              </p>
            )}
          </div>

          {FULFILLMENT_OPTIONS.length > 0 && (
            <fieldset className="field cart__fulfill" aria-describedby={errors.fulfillment ? `${id}-fulfillment-err` : undefined}>
              <legend>Como prefere receber?</legend>
              {FULFILLMENT_OPTIONS.map((opt, i) => (
                <label key={opt} className="cart__radio">
                  <input
                    id={i === 0 ? `${id}-fulfillment` : undefined}
                    type="radio"
                    name="fulfillment"
                    value={opt}
                    checked={fulfillment === opt}
                    onChange={() => setFulfillment(opt)}
                  />
                  {opt}
                </label>
              ))}
              {errors.fulfillment && (
                <p id={`${id}-fulfillment-err`} className="field-error">
                  {errors.fulfillment}
                </p>
              )}
            </fieldset>
          )}

          <div className="cart__summary">
            <h3>Resumo</h3>
            <ul role="list">
              {cart.lines.map((l) => (
                <li key={l.product.id}>
                  <span>
                    {l.qty}× {l.product.name}
                  </span>
                  <span>{l.lineTotal === null ? 'sob consulta' : formatPrice(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <p className="cart__summary-total">
              <span>Total estimado</span>
              <strong>{formatPrice(cart.total)}</strong>
            </p>
          </div>
        </div>
        <footer className="cart__foot">
          <button type="submit" className="btn btn--block">
            Continuar <Icon name="arrowRight" />
          </button>
        </footer>
      </form>
    );
  }

  return (
    <div className="cart__form">
      <div className="cart__scroll">
        <p className="cart__lead">
          {wa ? (
            <>Confira a mensagem e envie pelo WhatsApp. A equipe da ótica responde por lá para finalizar o atendimento.</>
          ) : (
            <>
              <strong>Sua solicitação ainda não foi enviada.</strong> Copie a mensagem abaixo e envie pelo Instagram, ou ligue para a loja.
            </>
          )}
        </p>
        <div className="field">
          <label htmlFor={`${id}-msg`}>Mensagem</label>
          <textarea id={`${id}-msg`} className="input cart__msg" readOnly value={message} rows={10} />
        </div>
      </div>
      <footer className="cart__foot cart__channels">
        {wa ? (
          <a className="btn btn--block" href={wa} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" /> Enviar pelo WhatsApp
          </a>
        ) : (
          <>
            <button type="button" className="btn btn--block" onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
            </button>
            <a className="btn btn--ghost btn--block" href={business.instagram.directUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="instagram" /> Abrir Instagram Direct
            </a>
            <a className="btn btn--ghost btn--block" href={telLink}>
              <Icon name="phone" /> Ligar: {business.phone.display}
            </a>
          </>
        )}
        <span className="visually-hidden" aria-live="polite">
          {copied ? 'Mensagem copiada para a área de transferência' : ''}
        </span>
      </footer>
    </div>
  );
}
