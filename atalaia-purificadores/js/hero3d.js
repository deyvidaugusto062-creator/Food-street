/*
 * Purificador 3D do topo.
 * A imagem estática aparece primeiro; a cena 3D (js/scene3d.js, Three.js) só é carregada
 * depois que a página está pronta e apenas quando o aparelho comporta: WebGL disponível,
 * sem "reduzir movimento" e sem economia de dados. Se algo falhar, a imagem continua lá.
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const cfg = window.ATALAIA_CONFIG.hero;
  const host = A.$('[data-hero3d]');
  if (!host) return;

  const img = A.$('[data-hero-img]', host);
  if (img && cfg.image) {
    img.src = cfg.image;
    img.alt = cfg.alt;
  }

  const conn = navigator.connection || {};
  const canWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  })();
  if (!cfg.enable3d || !canWebGL || !A.motionOK() || conn.saveData === true) return;

  function start() {
    if (!window.AtalaiaScene) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'story__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    try {
      A.scene = window.AtalaiaScene.mount(canvas, { variant: 'branco', story: true });
      A.scene.setProgress(A.storyProgress || 0);
      // espera um quadro renderizado antes de trocar a imagem pela cena
      requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('is-live')));
    } catch (e) {
      canvas.remove();
    }
  }

  function load() {
    if (window.AtalaiaScene) return start(); // já embutida (versão de arquivo único)
    const s = document.createElement('script');
    s.src = 'js/scene3d.js';
    s.async = true;
    s.onload = start;
    document.head.appendChild(s);
  }

  // Carrega sem disputar com o conteúdo principal.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
  if (document.readyState === "complete") idle(load, { timeout: 1500 });
  else window.addEventListener("load", () => idle(load, { timeout: 1500 }), { once: true });
})();
