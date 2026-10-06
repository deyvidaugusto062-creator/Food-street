/* Utilitários compartilhados. Expostos em window.Atalaia. */
(function () {
  'use strict';

  const A = (window.Atalaia = window.Atalaia || {});
  const CONFIG = window.ATALAIA_CONFIG;

  A.$ = (sel, root = document) => root.querySelector(sel);
  A.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  A.formatBRL = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // "R$ 150" sem centavos quando o valor é inteiro (usado no selo de economia).
  A.formatBRLShort = (value) =>
    Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    });

  A.motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // localStorage pode estar bloqueado (modo privado, políticas do navegador).
  A.storage = {
    get(key, fallback = null) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  A.whatsappUrl = (text) => {
    const base = `https://wa.me/${CONFIG.contact.whatsappNumber}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
  };

  // Remove caracteres de controle e espaços excedentes. Mantém quebras de linha se multiline.
  A.cleanText = (value, { max = 500, multiline = false } = {}) => {
    let str = String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, '')
      .replace(/\r\n?/g, '\n');
    str = multiline
      ? str.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
      : str.replace(/\s+/g, ' ');
    return str.trim().slice(0, max);
  };

  A.icon = (name, cls = 'icon') =>
    `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

  // Monta <picture> com AVIF/WebP opcionais e fallback.
  A.picture = ({ image, imageAvif, imageWebp, alt = '', width = 600, height = 600, lazy = true, className = '' }) => {
    const pic = document.createElement('picture');
    if (imageAvif) {
      const s = document.createElement('source');
      s.type = 'image/avif';
      s.srcset = imageAvif;
      pic.appendChild(s);
    }
    if (imageWebp) {
      const s = document.createElement('source');
      s.type = 'image/webp';
      s.srcset = imageWebp;
      pic.appendChild(s);
    }
    const img = document.createElement('img');
    img.src = image;
    img.alt = alt;
    img.width = width;
    img.height = height;
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    if (className) img.className = className;
    pic.appendChild(img);
    return pic;
  };

  /* ---------- Formulários: erros acessíveis ---------- */
  A.forms = {
    setError(input, message) {
      const id = input.dataset.errorId || `err-${input.id}`;
      const box = document.getElementById(id);
      input.setAttribute('aria-invalid', 'true');
      if (box) {
        box.textContent = message;
        const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
        if (!described.includes(id)) input.setAttribute('aria-describedby', described.concat(id).join(' '));
      }
    },
    clearError(input) {
      const id = input.dataset.errorId || `err-${input.id}`;
      const box = document.getElementById(id);
      input.removeAttribute('aria-invalid');
      if (box) box.textContent = '';
    },
    clearAll(form) {
      A.$$('[aria-invalid]', form).forEach((el) => A.forms.clearError(el));
      A.$$('.field__error', form).forEach((el) => (el.textContent = ''));
    },
    focusFirstError(form) {
      const el = A.$('[aria-invalid="true"]', form);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center', behavior: A.motionOK() ? 'smooth' : 'auto' });
      }
    },
    // Limpa o erro assim que o usuário corrige o campo.
    liveClear(form) {
      form.addEventListener('input', (e) => {
        if (e.target.matches('[aria-invalid="true"]')) A.forms.clearError(e.target);
      });
      form.addEventListener('change', (e) => {
        if (e.target.matches('[aria-invalid="true"]')) A.forms.clearError(e.target);
      });
    },
  };

  /* ---------- Toast ---------- */
  let toastTimer;
  A.toast = (message, ms = 4200) => {
    const el = A.$('[data-toast]');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => (el.hidden = true), 300);
    }, ms);
  };

  /* ---------- Diálogos ---------- */
  A.dialog = {
    open(dlg) {
      if (!dlg || dlg.open) return;
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      document.documentElement.classList.add('has-modal');
    },
    close(dlg) {
      if (!dlg || !dlg.open) return;
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    },
    // Botões [data-close], clique no fundo e limpeza do estado da página.
    wire(dlg) {
      dlg.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || e.target === dlg) A.dialog.close(dlg);
      });
      dlg.addEventListener('close', () => {
        if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('has-modal');
      });
    },
  };
})();
