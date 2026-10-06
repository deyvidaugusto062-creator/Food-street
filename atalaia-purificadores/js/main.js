/* Navegação, efeitos visuais (3D/parallax/entrada) e links de contato. */
(function () {
  'use strict';

  const A = window.Atalaia;
  const CONFIG = window.ATALAIA_CONFIG;
  const html = document.documentElement;

  /* ---------- Modo leve: reduz efeitos em aparelhos modestos ---------- */
  const conn = navigator.connection || {};
  const lowPower =
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    conn.saveData === true;
  if (lowPower) html.classList.add('lite');

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const allowFx = A.motionOK() && !lowPower;

  /* ---------- Links de WhatsApp e Instagram (fonte única: config.js) ---------- */
  A.$$('[data-wa]').forEach((a) => {
    const msg = CONFIG.whatsappMessages[a.dataset.wa];
    a.href = A.whatsappUrl(msg);
  });
  A.$$('[data-instagram]').forEach((a) => (a.href = CONFIG.contact.instagramUrl));
  A.$$('[data-contact]').forEach((el) => {
    const v = CONFIG.contact[el.dataset.contact];
    if (v) el.textContent = v;
  });
  A.$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Header ---------- */
  const header = A.$('[data-header]');
  const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ---------- WhatsApp flutuante: não cobre o conteúdo no celular ---------- */
  // No topo da página o header já mostra o botão do WhatsApp; enquanto o
  // teclado está aberto (campo em foco) o botão também sai da frente.
  const waFloat = A.$('.wa-float');
  const mqSmall = window.matchMedia('(max-width: 767px)');
  let typing = false;
  const syncWaFloat = () => {
    const hide = mqSmall.matches && (window.scrollY < 160 || typing);
    waFloat.classList.toggle('is-hidden', hide);
  };
  document.addEventListener('focusin', (e) => {
    typing = e.target.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select');
    syncWaFloat();
  });
  document.addEventListener('focusout', () => {
    typing = false;
    syncWaFloat();
  });
  window.addEventListener('scroll', syncWaFloat, { passive: true });
  mqSmall.addEventListener('change', syncWaFloat);
  syncWaFloat();

  /* ---------- Menu mobile ---------- */
  const nav = A.$('[data-nav]');
  const toggle = A.$('[data-nav-toggle]');
  const backdrop = A.$('[data-nav-backdrop]');
  const mqDesktop = window.matchMedia('(min-width: 1080px)');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    html.classList.toggle('menu-open', open);
    backdrop.hidden = !open;
    if (open) A.$('a', nav).focus();
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  backdrop.addEventListener('click', () => setMenu(false));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && html.classList.contains('menu-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  // Mantém o foco dentro do menu aberto (Tab / Shift+Tab).
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !html.classList.contains('menu-open')) return;
    const focusables = A.$$('a, button', nav).concat(toggle);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  mqDesktop.addEventListener('change', (e) => e.matches && setMenu(false));

  /* ---------- Destaque do item de menu da seção visível ---------- */
  const links = A.$$('.nav__list a');
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => {
            if (a.hash === `#${entry.target.id}`) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Animações de entrada ---------- */
  const reveal = () => {
    const els = A.$$('.reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window) || !A.motionOK()) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    els.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${(i % 4) * 70}ms`);
      io.observe(el);
    });
  };
  reveal();

  /* ---------- Cards inclináveis (somente desktop com mouse) ---------- */
  if (finePointer && allowFx) {
    A.$$('[data-tilt]').forEach((el) => {
      const max = Number(el.dataset.tiltMax) || 7;
      let raf = 0;
      el.classList.add('has-tilt');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
          el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
          el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
          el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- Parallax suave no topo ---------- */
  const layers = A.$$('[data-parallax]');
  if (layers.length && allowFx && window.matchMedia('(min-width: 768px)').matches) {
    let ticking = false;
    const update = () => {
      const y = Math.min(window.scrollY, window.innerHeight);
      layers.forEach((l) => (l.style.transform = `translate3d(0, ${(y * Number(l.dataset.parallax)).toFixed(1)}px, 0)`));
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
  }

  html.classList.add('is-ready');
})();
