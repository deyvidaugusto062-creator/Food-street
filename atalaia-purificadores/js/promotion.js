/*
 * Promoção com contador regressivo.
 * - O prazo é salvo no localStorage na primeira visita: atualizar a página não reinicia o contador.
 * - Para um prazo real e igual para todos, defina ATALAIA_CONFIG.promotion.endDate.
 * - Ao chegar em 00:00:00 a oferta é encerrada e o preço volta para o valor original.
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const cfg = window.ATALAIA_CONFIG.promotion;
  const STORAGE_KEY = `atalaia_promo_${cfg.id}`;
  const section = A.$('[data-promo]');

  function resolveEndTime() {
    if (cfg.endDate) {
      const fixed = Date.parse(cfg.endDate);
      if (!Number.isNaN(fixed)) return fixed;
      console.warn('[Atalaia] promotion.endDate inválida, usando prazo por visitante:', cfg.endDate);
    }
    const saved = A.storage.get(STORAGE_KEY);
    if (saved && Number.isFinite(saved.end)) return saved.end;
    const end = Date.now() + cfg.durationHours * 3600 * 1000;
    A.storage.set(STORAGE_KEY, { end, startedAt: Date.now() });
    return end;
  }

  const endTime = resolveEndTime();
  let timer = null;
  let ended = null;

  function getState() {
    const remaining = Math.max(0, endTime - Date.now());
    const active = remaining > 0;
    return {
      active,
      remaining,
      endTime,
      price: active ? cfg.promoPrice : cfg.originalPrice,
      originalPrice: cfg.originalPrice,
      promoPrice: cfg.promoPrice,
      savings: cfg.originalPrice - cfg.promoPrice,
    };
  }

  const pad = (n) => String(n).padStart(2, '0');

  function renderStatic() {
    const set = (sel, text) => A.$$(sel).forEach((el) => (el.textContent = text));
    set('[data-promo-name]', cfg.productName);
    set('[data-promo-model]', cfg.model);
    set('[data-promo-condition]', cfg.condition);
    set('[data-promo-original]', A.formatBRL(cfg.originalPrice));
    set('[data-promo-savings]', A.formatBRLShort(cfg.originalPrice - cfg.promoPrice));
    const pct = Math.round((1 - cfg.promoPrice / cfg.originalPrice) * 100);
    set('.promo__ribbon', `-${pct}%`);
    const img = A.$('[data-promo-image]');
    if (img) {
      img.src = cfg.image;
      img.alt = cfg.imageAlt;
    }
  }

  function render() {
    const s = getState();
    const totalSec = Math.floor(s.remaining / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;

    if (section) {
      A.$('[data-cd="d"]', section).textContent = pad(d);
      A.$('[data-cd-days-wrap]', section).hidden = d === 0;
      A.$('[data-cd="h"]', section).textContent = pad(h);
      A.$('[data-cd="m"]', section).textContent = pad(m);
      A.$('[data-cd="s"]', section).textContent = pad(sec);
    }

    if (ended === !s.active) return s; // nada mudou de estado
    ended = !s.active;

    A.$$('[data-promo-price]').forEach((el) => (el.textContent = A.formatBRL(s.price)));
    A.$$('[data-promo-only]').forEach((el) => (el.hidden = ended));
    document.documentElement.classList.toggle('promo-ended', ended);

    if (section) {
      section.classList.toggle('is-ended', ended);
      A.$('[data-promo-badge]', section).textContent = ended ? 'Promoção encerrada' : 'Oferta especial';
      A.$('[data-promo-label]', section).textContent = ended ? 'Tempo esgotado' : 'A oferta termina em';
      A.$('[data-promo-cta]', section).textContent = ended ? 'Comprar pelo WhatsApp' : 'Aproveitar oferta';
      A.$('[data-promo-status]', section).textContent = ended
        ? `O valor deste purificador voltou para ${A.formatBRL(cfg.originalPrice)}.`
        : '';
    }
    return s;
  }

  function tick() {
    const s = render();
    if (!s.active && timer) {
      clearInterval(timer);
      timer = null;
      document.dispatchEvent(new CustomEvent('atalaia:promo-ended'));
    }
  }

  renderStatic();
  tick();
  if (getState().active) {
    // Alinha o intervalo com a virada do segundo para o contador não "pular".
    setTimeout(() => {
      tick();
      if (getState().active) timer = setInterval(tick, 1000);
    }, (endTime - Date.now()) % 1000 || 1000);
  }
  // Abas em segundo plano desaceleram timers: recalcula ao voltar.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });

  const buy = A.$('[data-promo-buy]');
  if (buy) {
    buy.addEventListener('click', () => {
      A.openCheckout({
        id: 'promo',
        name: cfg.productName,
        model: cfg.model,
        condition: cfg.condition,
        image: cfg.image,
        isPromo: true,
      });
    });
  }

  A.promotion = { getState };
})();
