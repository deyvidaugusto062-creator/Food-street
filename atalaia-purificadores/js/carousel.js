/* Carrossel do topo: automático, com setas, indicadores, toque/arraste e pausa. */
(function () {
  'use strict';

  const A = window.Atalaia;
  const root = A.$('[data-carousel]');
  if (!root) return;

  const slides = window.ATALAIA_CONFIG.heroSlides;
  const track = A.$('[data-carousel-track]', root);
  const dotsHost = A.$('[data-carousel-dots]', root);
  const toggle = A.$('[data-carousel-toggle]', root);
  const INTERVAL = 5000;

  let index = 0;
  let timer = null;
  let userPaused = !A.motionOK(); // com movimento reduzido, não troca sozinho
  let hoverPaused = false;

  slides.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'carousel__slide';
    li.setAttribute('role', 'group');
    li.setAttribute('aria-roledescription', 'slide');
    li.setAttribute('aria-label', `${i + 1} de ${slides.length}`);
    const pic = A.picture({ ...s, lazy: i !== 0 });
    if (i === 0) A.$('img', pic).fetchPriority = 'high';
    li.appendChild(pic);
    const cap = document.createElement('p');
    cap.className = 'carousel__caption';
    cap.textContent = s.caption;
    li.appendChild(cap);
    track.appendChild(li);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel__dot';
    dot.setAttribute('aria-label', `Mostrar foto ${i + 1}: ${s.caption}`);
    dot.addEventListener('click', () => go(i, true));
    dotsHost.appendChild(dot);
  });

  const items = A.$$('.carousel__slide', track);
  const dots = A.$$('.carousel__dot', dotsHost);

  function go(i, fromUser) {
    index = (i + items.length) % items.length;
    track.style.transform = `translate3d(${-index * 100}%,0,0)`;
    items.forEach((el, k) => {
      el.setAttribute('aria-hidden', k === index ? 'false' : 'true');
      el.inert = k !== index;
    });
    dots.forEach((d, k) => d.setAttribute('aria-current', k === index ? 'true' : 'false'));
    if (fromUser) restart();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }
  function restart() {
    stop();
    if (!userPaused && !hoverPaused && !document.hidden) timer = setInterval(() => go(index + 1), INTERVAL);
  }

  function syncToggle() {
    root.classList.toggle('is-paused', userPaused);
    toggle.setAttribute('aria-label', userPaused ? 'Retomar troca automática' : 'Pausar troca automática');
  }

  A.$('[data-carousel-prev]', root).addEventListener('click', () => go(index - 1, true));
  A.$('[data-carousel-next]', root).addEventListener('click', () => go(index + 1, true));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    syncToggle();
    restart();
  });

  root.addEventListener('mouseenter', () => { hoverPaused = true; stop(); });
  root.addEventListener('mouseleave', () => { hoverPaused = false; restart(); });
  root.addEventListener('focusin', () => { hoverPaused = true; stop(); });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) { hoverPaused = false; restart(); }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(index - 1, true);
    if (e.key === 'ArrowRight') go(index + 1, true);
  });
  document.addEventListener('visibilitychange', restart);

  /* Arrastar / deslizar */
  const viewport = A.$('.carousel__viewport', root);
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let horizontal = null;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    horizontal = null;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    stop();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) {
        viewport.setPointerCapture(e.pointerId);
        root.classList.add('is-dragging');
      }
    }
    if (horizontal) {
      const pct = (dx / viewport.clientWidth) * 100;
      track.style.transform = `translate3d(${-index * 100 + pct}%,0,0)`;
    }
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (horizontal && Math.abs(dx) > Math.min(60, viewport.clientWidth * 0.15)) go(index + (dx < 0 ? 1 : -1), true);
    else go(index, true);
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('dragstart', (e) => e.preventDefault());

  syncToggle();
  go(0);
  restart();
})();
