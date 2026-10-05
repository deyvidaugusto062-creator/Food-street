import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { useTilt } from '../../hooks/useTilt';
import { business, addressLine, mapLinks, telLink, whatsappLink } from '../../data/business';
import { hoursSummary } from '../../data/hours';
import { CONTACT_FORM_ENDPOINT } from '../../config/site';
import { maskPhone } from '../../utils/format';

export function Contact() {
  const wa = whatsappLink();
  return (
    <section id="contato" className="section section--dark contact" aria-labelledby="contato-title">
      <div className="contact__bg" aria-hidden="true" />
      <div className="container">
        <div className="section-head">
          <p className="eyebrow" data-reveal>
            Contato
          </p>
          <h2 id="contato-title" data-reveal>
            Fale com a {business.name}
          </h2>
          <p data-reveal>Tire dúvidas sobre armações, disponibilidade e atendimento pelos canais oficiais da ótica.</p>
        </div>

        <ul className="contact__grid" role="list" data-reveal-stagger>
          <ContactCard icon="phone" title="Telefone" value={business.phone.display} href={telLink} cta="Ligar agora" />
          <ContactCard icon="instagram" title="Instagram" value={business.instagram.handle} href={business.instagram.url} cta="Abrir perfil" external />
          {wa && <ContactCard icon="whatsapp" title="WhatsApp" value="Conversar pelo WhatsApp" href={wa} cta="Abrir conversa" external />}
          <ContactCard icon="pin" title="Endereço" value={`${addressLine} — ${business.address.neighborhood}`} href={mapLinks.open} cta="Abrir no mapa" external />
          <ContactCard icon="clock" title="Horário" href="#localizacao" cta="Ver horários">
            {hoursSummary.map((h) => (
              <span key={h.days} className="contact__hours">
                {h.days}: <strong>{h.time}</strong>
              </span>
            ))}
          </ContactCard>
        </ul>

        {CONTACT_FORM_ENDPOINT && <ContactForm endpoint={CONTACT_FORM_ENDPOINT} />}
      </div>
    </section>
  );
}

function ContactCard({
  icon,
  title,
  value,
  href,
  cta,
  external,
  children,
}: {
  icon: IconName;
  title: string;
  value?: string;
  href: string;
  cta: string;
  external?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useTilt(ref, 6);
  return (
    <li ref={ref} className="ccard" data-reveal>
      <span className="ccard__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      {value && <p className="ccard__value">{value}</p>}
      {children && <p className="ccard__value ccard__value--list">{children}</p>}
      <a className="ccard__link" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {cta}
        {external && <span className="visually-hidden"> (abre em nova aba)</span>}
        <Icon name={external ? 'external' : 'arrowRight'} />
      </a>
    </li>
  );
}

/**
 * Formulário exibido SOMENTE quando existe um endpoint real (VITE_CONTACT_FORM_ENDPOINT).
 * A mensagem de sucesso só aparece se o servidor responder 2xx.
 */
function ContactForm({ endpoint }: { endpoint: string }) {
  const id = useId();
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [form, setForm] = useState({ nome: '', telefone: '', mensagem: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.mensagem.trim()) return;
    setState('sending');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      });
      setState(res.ok ? 'ok' : 'error');
      if (res.ok) setForm({ nome: '', telefone: '', mensagem: '' });
    } catch {
      setState('error');
    }
  };

  return (
    <form className="contact__form" onSubmit={submit}>
      <h3>Envie uma mensagem</h3>
      <div className="contact__form-row">
        <div className="field">
          <label htmlFor={`${id}-n`}>Nome</label>
          <input id={`${id}-n`} className="input" required autoComplete="name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-t`}>Telefone (opcional)</label>
          <input
            id={`${id}-t`}
            className="input"
            type="tel"
            autoComplete="tel-national"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-m`}>Mensagem</label>
        <textarea id={`${id}-m`} className="input" required value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
      </div>
      <button type="submit" className="btn btn--mint" disabled={state === 'sending'}>
        <Icon name="send" /> {state === 'sending' ? 'Enviando…' : 'Enviar mensagem'}
      </button>
      <p role="status" className={`contact__status contact__status--${state}`}>
        {state === 'ok' && 'Mensagem enviada. A equipe da ótica responderá pelos canais informados.'}
        {state === 'error' && `Não foi possível enviar agora. Tente novamente ou ligue para ${business.phone.display}.`}
      </p>
    </form>
  );
}
