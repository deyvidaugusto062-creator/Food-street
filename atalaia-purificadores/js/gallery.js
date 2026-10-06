/* Galeria com lightbox: anterior/próxima, zoom, teclado e gestos no celular. */
(function () {
  'use strict';

  const A = window.Atalaia;
  const host = A.$('[data-gallery]');
  const dlg = A.$('#dlg-lightbox');
  if (!host || !dlg) return;

  const items = window.ATALAIA_CONFIG.gallery;
  const img = A.$('[data-lb-img]', dlg);
  const stage = A.$('[data-lb-stage]', dlg);
  const caption = A.$('[data-lb-caption]', dlg);
  const counter = A.$('[data-lb-counter]', dlg);
  const zoomBtn = A.$('[data-lb-zoom]', dlg);
  const ZOOM = 2.2;

  let index = 0;
  let zoomed = false;
  let pan = { x: 0, y: 0 };
  let opener = null;

  items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery__item reveal';
    btn.setAttribute('aria-label', `Ampliar imagem: ${item.caption}`);
    btn.appendChild(A.picture({ ...item, alt: item.alt }));
    const cap = document.createElement('span');
    cap.className = 'gallery__caption';
    cap.textContent = item.caption;
    btn.appendChild(cap);
    btn.addEventListener('click', () => open(i, btn));
    host.appendChild(btn);
  });
  const note = A.$('[data-gallery-note]');
  if (note) note.hidden = !items.some((i) => i.illustrative);

  function applyTransform() {
    img.style.transform = zoomed ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${ZOOM})` : '';
  }

  function setZoom(on) {
    zoomed = on;
    pan = { x: 0, y: 0 };
    dlg.classList.toggle('is-zoomed', on);
    zoomBtn.setAttribute('aria-pressed', String(on));
    zoomBtn.setAttribute('aria-label', on ? 'Reduzir imagem' : 'Ampliar imagem');
    applyTransform();
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    setZoom(false);
    img.src = item.image;
    img.alt = item.alt;
    caption.textContent = item.illustrative ? `${item.caption} · imagem ilustrativa` : item.caption;
    counter.textContent = `${index + 1} / ${items.length}`;
  }

  function open(i, from) {
    opener = from;
    show(i);
    A.dialog.open(dlg);
    A.$('[data-lb-close]', dlg).focus();
  }

  function close() {
    A.dialog.close(dlg);
  }

  dlg.addEventListener('close', () => {
    setZoom(false);
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('has-modal');
    if (opener) opener.focus();
  });
  A.$('[data-lb-close]', dlg).addEventListener('click', close);
  A.$('[data-lb-prev]', dlg).addEventListener('click', () => show(index - 1));
  A.$('[data-lb-next]', dlg).addEventListener('click', () => show(index + 1));
  zoomBtn.addEventListener('click', () => setZoom(!zoomed));
  img.addEventListener('dblclick', () => setZoom(!zoomed));
  // Clique fora da imagem fecha (quando não está ampliada).
  stage.addEventListener('click', (e) => {
    if (e.target === stage && !zoomed) close();
  });

  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    else if (e.key === '+' || e.key === '=') setZoom(true);
    else if (e.key === '-') setZoom(false);
    // Esc é tratado pelo próprio <dialog>.
  });

  /* Gestos: deslizar troca de imagem; com zoom, arrastar move a imagem. */
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
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = Date.now() - start.t < 250 && Math.abs(dx) < 8 && Math.abs(dy) < 8;
    if (!zoomed && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    // Toque duplo (celular) alterna o zoom.
    if (quick && e.pointerType !== 'mouse' && e.target === img) {
      if (Date.now() - lastTap < 300) { setZoom(!zoomed); lastTap = 0; }
      else lastTap = Date.now();
    }
    start = null;
  });
  stage.addEventListener('pointercancel', () => (start = null));
})();
