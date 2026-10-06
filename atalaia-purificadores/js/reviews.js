/*
 * AVALIAÇÕES DOS CLIENTES
 * ------------------------------------------------------------
 * IMPORTANTE: nesta versão as avaliações são salvas com localStorage.
 * localStorage fica APENAS no navegador/dispositivo de quem publicou:
 * uma avaliação feita no celular de um cliente NÃO aparece para outros visitantes.
 *
 * Para avaliações compartilhadas entre todos, conecte um backend implementando
 * a mesma interface do `localAdapter` ({ list(), add(review) }) e troque em
 * `ReviewsStore.adapter`. Há um exemplo para Supabase comentado abaixo.
 * Em produção, recomenda-se moderação antes de publicar (campo `approved`).
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const cfg = window.ATALAIA_CONFIG.reviews;
  const STORAGE_KEY = 'atalaia_reviews_v1';

  const localAdapter = {
    async list() {
      const data = A.storage.get(STORAGE_KEY, []);
      return Array.isArray(data) ? data.filter(isValidStored) : [];
    },
    async add(review) {
      const list = await this.list();
      list.unshift(review);
      if (!A.storage.set(STORAGE_KEY, list.slice(0, 200))) {
        throw new Error('storage-unavailable');
      }
      return review;
    },
  };

  /*
  // Exemplo de adaptador Supabase (requer tabela `reviews` com colunas
  // id uuid, name text, rating int2, comment text, created_at timestamptz, approved bool
  // e políticas RLS: insert público, select apenas approved = true).
  const supabaseAdapter = {
    url: 'https://SEU-PROJETO.supabase.co/rest/v1/reviews',
    key: 'SUA_CHAVE_PUBLICA_ANON',
    headers() {
      return { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' };
    },
    async list() {
      const res = await fetch(`${this.url}?select=*&approved=eq.true&order=created_at.desc`, { headers: this.headers() });
      if (!res.ok) throw new Error('list-failed');
      return (await res.json()).map((r) => ({ id: r.id, name: r.name, rating: r.rating, comment: r.comment, date: r.created_at }));
    },
    async add(review) {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { ...this.headers(), Prefer: 'return=minimal' },
        body: JSON.stringify({ name: review.name, rating: review.rating, comment: review.comment }),
      });
      if (!res.ok) throw new Error('add-failed');
      return review;
    },
  };
  */

  const ReviewsStore = { adapter: localAdapter };

  function isValidStored(r) {
    return r && typeof r.name === 'string' && typeof r.comment === 'string' && r.rating >= 1 && r.rating <= 5 && r.date;
  }

  /* ---------- Renderização (sempre com textContent: nada de HTML vindo do usuário) ---------- */
  const listEl = A.$('[data-reviews-list]');
  const emptyEl = A.$('[data-reviews-empty]');
  const summaryEl = A.$('[data-reviews-summary]');
  if (!listEl) return;

  function starsHTML(n) {
    let html = '';
    for (let i = 1; i <= 5; i++) html += A.icon('star', `icon star${i <= n ? ' is-on' : ''}`);
    return html;
  }

  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  function card(r) {
    const el = document.createElement('article');
    el.className = 'review-card';
    el.innerHTML = `
      <header class="review-card__head">
        <span class="review-card__avatar" aria-hidden="true"></span>
        <div>
          <h3 class="review-card__name"></h3>
          <time class="review-card__date"></time>
        </div>
      </header>
      <p class="review-card__rating">
        <span class="stars" aria-hidden="true">${starsHTML(r.rating)}</span>
        <span class="review-card__score"></span>
      </p>
      <p class="review-card__comment"></p>`;
    A.$('.review-card__avatar', el).textContent = r.name.trim().charAt(0).toUpperCase();
    A.$('.review-card__name', el).textContent = r.name;
    const time = A.$('time', el);
    const d = new Date(r.date);
    time.dateTime = d.toISOString();
    time.textContent = dateFmt.format(d);
    A.$('.review-card__score', el).textContent = `Nota ${r.rating} de 5`;
    A.$('.review-card__comment', el).textContent = r.comment;
    return el;
  }

  function render(list) {
    listEl.replaceChildren(...list.map(card));
    emptyEl.hidden = list.length > 0;
    summaryEl.hidden = list.length === 0;
    if (list.length) {
      const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
      A.$('[data-reviews-avg]').textContent = avg.toFixed(1).replace('.', ',');
      A.$('[data-reviews-avg-stars]').innerHTML = starsHTML(Math.round(avg));
      A.$('[data-reviews-count]').textContent = `${list.length} ${list.length === 1 ? 'avaliação' : 'avaliações'}`;
    }
  }

  async function load() {
    try {
      render(await ReviewsStore.adapter.list());
    } catch (e) {
      render([]);
    }
  }

  /* ---------- Formulário ---------- */
  const form = A.$('#form-review');
  const success = A.$('[data-review-success]', form);
  const counter = A.$('[data-char-count]', form);
  const ratingText = A.$('[data-rating-text]', form);
  const ratingWrap = A.$('.rating-input__stars', form);
  const radios = A.$$('input[name="rating"]', form);
  const RATING_LABELS = ['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'];

  A.$('[data-reviews-local-notice]', form).hidden = !cfg.showLocalNotice;
  form.comment.maxLength = cfg.maxComment;
  form.name.maxLength = cfg.maxName;
  A.forms.liveClear(form);

  const paintStars = (n) =>
    radios.forEach((r) => r.nextElementSibling.classList.toggle('is-on', Number(r.value) <= n));
  const checkedRating = () => Number((radios.find((r) => r.checked) || {}).value || 0);

  radios.forEach((r) => {
    r.dataset.errorId = 'err-rev-rating';
    r.addEventListener('change', () => {
      paintStars(checkedRating());
      ratingText.textContent = `${r.value}/5 · ${RATING_LABELS[r.value]}`;
      radios.forEach((x) => A.forms.clearError(x));
    });
    r.nextElementSibling.addEventListener('mouseenter', () => paintStars(Number(r.value)));
  });
  ratingWrap.addEventListener('mouseleave', () => paintStars(checkedRating()));

  const updateCount = () => (counter.textContent = `${form.comment.value.length}/${cfg.maxComment}`);
  form.comment.addEventListener('input', updateCount);

  let lastSubmit = 0;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    A.forms.clearAll(form);
    success.textContent = '';
    const name = A.cleanText(form.name.value, { max: cfg.maxName });
    const comment = A.cleanText(form.comment.value, { max: cfg.maxComment, multiline: true });
    const rating = checkedRating();
    let ok = true;

    if (name.length < 2) {
      A.forms.setError(form.name, 'Informe seu nome (pelo menos 2 letras).');
      ok = false;
    }
    if (!rating) {
      A.forms.setError(radios[0], 'Escolha uma nota de 1 a 5 estrelas.');
      ok = false;
    }
    if (comment.length < cfg.minComment) {
      A.forms.setError(form.comment, `Escreva um comentário com pelo menos ${cfg.minComment} caracteres.`);
      ok = false;
    }
    if (!ok) {
      A.forms.focusFirstError(form);
      return;
    }
    if (Date.now() - lastSubmit < 5000) return; // evita envio duplicado por toque duplo
    lastSubmit = Date.now();

    const review = {
      id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      name,
      rating,
      comment,
      date: new Date().toISOString(),
    };
    try {
      await ReviewsStore.adapter.add(review);
      form.reset();
      paintStars(0);
      ratingText.textContent = 'Escolha de 1 a 5';
      updateCount();
      success.textContent = 'Obrigado! Sua avaliação foi publicada.';
      await load();
    } catch (err) {
      lastSubmit = 0;
      success.textContent = '';
      A.forms.setError(form.comment, 'Não foi possível salvar sua avaliação neste navegador. Tente novamente mais tarde.');
    }
  });

  load();
  A.reviews = ReviewsStore;
})();
