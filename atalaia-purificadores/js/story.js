/*
 * Topo em forma de história: o palco fica fixo e os capítulos passam por cima.
 * A posição da rolagem vira um número de 0 a 1 que controla a cena 3D (giro,
 * acabamento, copo enchendo). Sem 3D, as imagens trocam por capítulo.
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const story = A.$('[data-story]');
  if (!story) return;

  const html = document.documentElement;
  const steps = A.$$('[data-story-step]', story);
  const imgs = A.$$('[data-story-img]', story);
  const rail = A.$$('.story__rail li', story);
  let active = -1;

  A.storyProgress = 0;

  function currentStep() {
    const mid = window.innerHeight * 0.55;
    let best = 0;
    let dist = Infinity;
    steps.forEach((st, i) => {
      const r = st.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  function update() {
    const r = story.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.max(0, Math.min(1, -r.top / total)) : 0;
    A.storyProgress = p;
    story.style.setProperty('--sp', p.toFixed(4));
    if (A.scene) A.scene.setProgress(p);

    const i = currentStep();
    if (i !== active) {
      active = i;
      story.dataset.step = i;
      steps.forEach((st, k) => st.classList.toggle('is-active', k === i));
      imgs.forEach((im, k) => im.classList.toggle('is-active', k === Math.min(i, imgs.length - 1)));
      rail.forEach((d, k) => {
        d.classList.toggle('is-active', k <= i);
        d.classList.toggle('is-current', k === i);
      });
    }
    html.classList.toggle('in-story', r.top < -40 && r.bottom > window.innerHeight * 0.9);
  }

  A.onScroll(update);
})();
