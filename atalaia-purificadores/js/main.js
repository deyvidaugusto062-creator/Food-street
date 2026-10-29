/*
 * Navegação, sistema de movimento e links de contato.
 * Todos os efeitos respeitam "reduzir movimento" e são desligados em aparelhos modestos.
 */
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
  const motion = A.motionOK();
  const allowFx = motion && !lowPower;

  /* ---------- Links de WhatsApp e Instagram (fonte única: config.js) ---------- */
  A.$$('[data-wa]').forEach((a) => (a.href = A.whatsappUrl(CONFIG.whatsappMessages[a.dataset.wa])));
  A.$$('[data-instagram]').forEach((a) => (a.href = CONFIG.contact.instagramUrl));
  A.$$('[data-contact]').forEach((el) => {
    const v = CONFIG.contact[el.dataset.contact];
    if (v) el.textContent = v;
  });
  A.$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Rolagem: header, barra de leitura, parallax, WhatsApp flutuante ---------- */
  const header = A.$('[data-header]');
  const progress = A.$('[data-scroll-progress]');
  const waFloat = A.$('.wa-float');
  const mqSmall = window.matchMedia('(max-width: 767px)');
  const layers = allowFx && window.matchMedia('(min-width: 768px)').matches ? A.$$('[data-parallax]') : [];
  let lastY = window.scrollY;
  let typing = false;
  let ticking = false;

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle('is-scrolled', y > 24);
    // Some ao rolar para baixo, volta ao rolar para cima (mais espaço para o conteúdo).
    const menuOpen = html.classList.contains('menu-open');
    if (!menuOpen && !header.contains(document.activeElement)) {
      if (y > 480 && y > lastY + 6) header.classList.add('is-hidden');
      else if (y < lastY - 6 || y <= 480) header.classList.remove('is-hidden');
    }
    lastY = y;
    if (progress) progress.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
    if (layers.length && y < window.innerHeight * 1.2) {
      layers.forEach((l) => (l.style.transform = `translate3d(0, ${(y * Number(l.dataset.parallax)).toFixed(1)}px, 0)`));
    }
    // no topo o header já mostra o botão do WhatsApp
    waFloat.classList.toggle('is-hidden', y < 160 || (mqSmall.matches && typing));
  }
  const requestScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll, { passive: true });
  mqSmall.addEventListener('change', requestScroll);
  onScroll();

  // No celular, o WhatsApp flutuante sai da frente enquanto o teclado está aberto.
  document.addEventListener('focusin', (e) => {
    typing = e.target.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select');
    if (header.contains(e.target)) header.classList.remove('is-hidden');
    requestScroll();
  });
  document.addEventListener('focusout', () => {
    typing = false;
    requestScroll();
  });

  /* ---------- Menu mobile ---------- */
  const nav = A.$('[data-nav]');
  const toggle = A.$('[data-nav-toggle]');
  const mqDesktop = window.matchMedia('(min-width: 1180px)');
  A.$$('.nav__list li', nav).forEach((li, i) => li.style.setProperty('--i', i));

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    html.classList.toggle('menu-open', open);
    header.classList.remove('is-hidden');
    if (open) setTimeout(() => A.$('a', nav).focus({ preventScroll: true }), 50);
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
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
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !html.classList.contains('menu-open')) return;
    const focusables = [A.$('.brand', header), ...A.$$('a, button', nav), toggle];
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

  /* ---------- Títulos: divide em palavras para a entrada em máscara ---------- */
  function splitWords(el) {
    let n = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const outer = document.createElement('span');
            outer.className = 'split-word';
            const inner = document.createElement('span');
            inner.style.setProperty('--w', n++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    el.classList.add('is-split');
  }
  if (motion) A.$$('[data-split]').forEach(splitWords);

  /* ---------- Entradas ao rolar ---------- */
  const revealEls = A.$$('.reveal, .is-split, [data-steps]');
  if (!('IntersectionObserver' in window) || !motion) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    revealEls.forEach((el) => {
      // atraso em cascata entre irmãos do mesmo grupo
      const siblings = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal')) : [];
      const i = Math.max(0, siblings.indexOf(el));
      el.style.setProperty('--reveal-delay', `${Math.min(i, 6) * 90}ms`);
      io.observe(el);
    });
  }

  /* ---------- Microinterações (somente mouse/trackpad) ---------- */
  if (finePointer && allowFx) {
    // Cards inclináveis com reflexo
    A.$$('[data-tilt]').forEach((el) => {
      const max = Number(el.dataset.tiltMax) || 6;
      const media = A.$('[data-depth]', el);
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
          if (media) {
            media.style.setProperty('--px', (-px * 2).toFixed(3));
            media.style.setProperty('--py', (-py * 2).toFixed(3));
          }
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        if (media) {
          media.style.setProperty('--px', 0);
          media.style.setProperty('--py', 0);
        }
      });
    });

    // Luz que acompanha o cursor nos cards escuros
    A.$$('[data-spotlight]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', `${e.clientX - r.left}px`);
        el.style.setProperty('--sy', `${e.clientY - r.top}px`);
      });
    });

    // Botões "magnéticos": acompanham levemente o cursor
    A.$$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
        el.style.setProperty('--mx', `${Math.max(-10, Math.min(10, dx)).toFixed(1)}px`);
        el.style.setProperty('--my', `${Math.max(-8, Math.min(8, dy)).toFixed(1)}px`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  // Onda de água no toque/clique dos botões
  if (motion) {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      btn.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    });
  }

  // Entrada do topo
  requestAnimationFrame(() => html.classList.add('is-ready'));
})();
