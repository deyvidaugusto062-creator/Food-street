/*
 * Galeria em formato de vitrine:
 *  - Palco principal com troca automática, setas, miniaturas (indicadores), deslize no toque e pausa
 *  - Clique na imagem abre o lightbox com zoom, anterior/próxima, teclado e gestos
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const root = A.$('[data-showcase]');
  const dlg = A.$('#dlg-lightbox');
  if (!root || !dlg) return;

  const items = window.ATALAIA_CONFIG.gallery;
  const INTERVAL = 5000;

  /* ================= Vitrine ================= */
  const track = A.$('[data-showcase-track]', root);
  const thumbs = A.$('[data-showcase-thumbs]', root);
  const caption = A.$('[data-showcase-caption]', root);
  const counter = A.$('[data-showcase-counter]', root);
  const toggle = A.$('[data-showcase-toggle]', root);
  const viewport = A.$('.showcase__viewport', root);

  items.forEach((item, i) => {
    const slide = document.createElement('li');
    slide.className = 'showcase__slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} de ${items.length}: ${item.caption}`);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'showcase__zoom';
    btn.setAttribute('aria-label', `Ampliar imagem: ${item.caption}`);
    btn.appendChild(A.picture({ ...item, lazy: i > 0 }));
    btn.addEventListener('click', () => {
      if (!moved) openLightbox(i, btn);
    });
    slide.appendChild(btn);
    track.appendChild(slide);

    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'showcase__thumb';
    t.setAttribute('aria-label', `Mostrar ${item.caption}`);
    t.appendChild(A.picture({ ...item, alt: '', width: 160, height: 160 }));
    t.addEventListener('click', () => go(i, true));
    thumbs.appendChild(t);
  });
  const slides = A.$$('.showcase__slide', track);
  const thumbBtns = A.$$('.showcase__thumb', thumbs);
  const note = A.$('[data-gallery-note]');
  if (note) note.hidden = !items.some((i) => i.illustrative);

  let index = 0;
  let timer = null;
  let userPaused = !A.motionOK();
  let hoverPaused = false;
  let inView = false;

  function go(i, fromUser) {
    index = (i + items.length) % items.length;
    track.style.transform = `translate3d(${-index * 100}%,0,0)`;
    slides.forEach((el, k) => {
      el.classList.toggle('is-active', k === index);
      el.inert = k !== index;
      el.setAttribute('aria-hidden', String(k !== index));
    });
    thumbBtns.forEach((d, k) => d.setAttribute('aria-current', k === index ? 'true' : 'false'));
    caption.textContent = items[index].caption;
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    resetBar();
    if (fromUser) restart();
  }
  // Barra fina que mostra quanto falta para a próxima imagem.
  function resetBar() {
    root.style.setProperty('--progress-run', 'none');
    void root.offsetWidth;
    root.style.removeProperty('--progress-run');
  }
  const stop = () => { clearInterval(timer); timer = null; root.classList.add('is-holding'); };
  function restart() {
    stop();
    if (!userPaused && !hoverPaused && inView && !document.hidden) {
      root.classList.remove('is-holding');
      timer = setInterval(() => go(index + 1), INTERVAL);
      resetBar();
    }
  }
  function syncToggle() {
    root.classList.toggle('is-paused', userPaused);
    toggle.setAttribute('aria-label', userPaused ? 'Retomar troca automática' : 'Pausar troca automática');
  }

  A.$('[data-showcase-prev]', root).addEventListener('click', () => go(index - 1, true));
  A.$('[data-showcase-next]', root).addEventListener('click', () => go(index + 1, true));
  toggle.addEventListener('click', () => { userPaused = !userPaused; syncToggle(); restart(); });
  root.addEventListener('mouseenter', () => { hoverPaused = true; stop(); });
  root.addEventListener('mouseleave', () => { hoverPaused = false; restart(); });
  root.addEventListener('focusin', () => { hoverPaused = true; stop(); });
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) { hoverPaused = false; restart(); } });
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('dialog')) return;
    if (e.key === 'ArrowLeft') go(index - 1, true);
    if (e.key === 'ArrowRight') go(index + 1, true);
  });
  document.addEventListener('visibilitychange', restart);
  // Só troca sozinho quando a vitrine está na tela.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; restart(); }, { threshold: 0.35 }).observe(root);
  } else {
    inView = true;
  }

  // Deslizar / arrastar
  let sx = 0, sy = 0, dx = 0, dragging = false, horizontal = null, moved = false;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; horizontal = null; moved = false; dx = 0;
    sx = e.clientX; sy = e.clientY;
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) { viewport.setPointerCapture(e.pointerId); root.classList.add('is-dragging'); stop(); }
    }
    if (horizontal) {
      moved = true;
      track.style.transform = `translate3d(${-index * 100 + (dx / viewport.clientWidth) * 100}%,0,0)`;
    }
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (horizontal && Math.abs(dx) > Math.min(60, viewport.clientWidth * 0.15)) go(index + (dx < 0 ? 1 : -1), true);
    else if (horizontal) go(index, true);
    setTimeout(() => (moved = false), 0);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('dragstart', (e) => e.preventDefault());

  syncToggle();
  go(0);

  /* ================= Lightbox ================= */
  const img = A.$('[data-lb-img]', dlg);
  const stage = A.$('[data-lb-stage]', dlg);
  const lbCaption = A.$('[data-lb-caption]', dlg);
  const lbCounter = A.$('[data-lb-counter]', dlg);
  const zoomBtn = A.$('[data-lb-zoom]', dlg);
  const ZOOM = 2.2;
  let lbIndex = 0;
  let zoomed = false;
  let pan = { x: 0, y: 0 };
  let opener = null;

  const applyTransform = () => {
    img.style.transform = zoomed ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${ZOOM})` : '';
  };
  function setZoom(on) {
    zoomed = on;
    pan = { x: 0, y: 0 };
    dlg.classList.toggle('is-zoomed', on);
    zoomBtn.setAttribute('aria-pressed', String(on));
    zoomBtn.setAttribute('aria-label', on ? 'Reduzir imagem' : 'Ampliar imagem');
    applyTransform();
  }
  function show(i) {
    lbIndex = (i + items.length) % items.length;
    const item = items[lbIndex];
    setZoom(false);
    img.src = item.image;
    img.alt = item.alt;
    lbCaption.textContent = item.illustrative ? `${item.caption} · imagem ilustrativa` : item.caption;
    lbCounter.textContent = `${lbIndex + 1} / ${items.length}`;
  }
  function openLightbox(i, from) {
    opener = from;
    show(i);
    A.dialog.open(dlg);
    A.$('[data-lb-close]', dlg).focus();
  }
  const close = () => A.dialog.close(dlg);

  dlg.addEventListener('close', () => {
    setZoom(false);
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('has-modal');
    go(lbIndex); // a vitrine acompanha a última imagem vista
    if (opener) (slides[lbIndex] ? A.$('button', slides[lbIndex]) : opener).focus();
  });
  A.$('[data-lb-close]', dlg).addEventListener('click', close);
  A.$('[data-lb-prev]', dlg).addEventListener('click', () => show(lbIndex - 1));
  A.$('[data-lb-next]', dlg).addEventListener('click', () => show(lbIndex + 1));
  zoomBtn.addEventListener('click', () => setZoom(!zoomed));
  img.addEventListener('dblclick', () => setZoom(!zoomed));
  stage.addEventListener('click', (e) => {
    if (e.target === stage && !zoomed) close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(lbIndex - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(lbIndex + 1); }
    else if (e.key === '+' || e.key === '=') setZoom(true);
    else if (e.key === '-') setZoom(false);
  });

  let start = null;
  let lastTap = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, t: Date.now() };
    // Captura só com zoom (para arrastar); sem zoom o clique fora da imagem precisa continuar fechando.
    if (zoomed) stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!start || !zoomed) return;
    const rect = img.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width - stage.clientWidth) / 2 + 40);
    const maxY = Math.max(0, (rect.height - stage.clientHeight) / 2 + 40);
    pan.x = Math.max(-maxX, Math.min(maxX, start.px + (e.clientX - start.x)));
    pan.y = Math.max(-maxY, Math.min(maxY, start.py + (e.clientY - start.y)));
    applyTransform();
  });
  stage.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dxl = e.clientX - start.x;
    const dyl = e.clientY - start.y;
    const quick = Date.now() - start.t < 250 && Math.abs(dxl) < 8 && Math.abs(dyl) < 8;
    if (!zoomed && Math.abs(dxl) > 50 && Math.abs(dxl) > Math.abs(dyl)) show(lbIndex + (dxl < 0 ? 1 : -1));
    if (quick && e.pointerType !== 'mouse' && e.target === img) {
      if (Date.now() - lastTap < 300) { setZoom(!zoomed); lastTap = 0; }
      else lastTap = Date.now();
    }
    start = null;
  });
  stage.addEventListener('pointercancel', () => (start = null));
})();
