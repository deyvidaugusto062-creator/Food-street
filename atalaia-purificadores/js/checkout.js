/*
 * Fluxos que terminam no WhatsApp:
 *   - Compra de purificador (catálogo e oferta)
 *   - Solicitação de serviço
 *   - Diagnóstico do purificador
 * Todos passam pela tela "Confira sua mensagem" antes de abrir o WhatsApp.
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const CONFIG = window.ATALAIA_CONFIG;

  /* ---------- Pré-visualização da mensagem ---------- */
  const preview = A.$('#dlg-preview');
  const previewText = A.$('[data-preview-text]', preview);
  const previewSend = A.$('[data-preview-send]', preview);
  const previewLabel = A.$('[data-preview-label]', preview);
  A.dialog.wire(preview);

  function showPreview({ message, label }) {
    previewText.textContent = message;
    previewSend.href = A.whatsappUrl(message);
    previewLabel.textContent = label;
    A.dialog.open(preview);
    previewSend.focus();
  }

  previewSend.addEventListener('click', () => {
    // O link abre o WhatsApp em nova aba; aqui só fechamos os diálogos.
    setTimeout(() => {
      A.$$('dialog[open]').forEach((d) => A.dialog.close(d));
      A.toast('Abrimos o WhatsApp com sua mensagem. É só tocar em enviar.');
    }, 150);
  });

  const line = (label, value) => `${label}: ${value}`;
  const addressLines = (addr) => {
    const out = [line('Endereço', addr.text)];
    if (addr.mapsUrl) out.push(line('Localização no mapa', addr.mapsUrl));
    return out;
  };

  function validateName(input) {
    const v = A.cleanText(input.value, { max: 80 });
    if (v.length < 2) {
      A.forms.setError(input, 'Informe seu nome.');
      return false;
    }
    return true;
  }

  /* ---------- Catálogo de produtos ---------- */
  function renderCatalog() {
    const host = A.$('[data-catalog]');
    if (!host) return;
    const frag = document.createDocumentFragment();

    Object.entries(CONFIG.categories).forEach(([key, cat]) => {
      const items = CONFIG.products.filter((p) => p.category === key);
      if (!items.length) return;

      const group = document.createElement('div');
      group.className = 'catalog__group reveal';
      group.innerHTML = `
        <header class="catalog__head">
          <div>
            <h3 class="catalog__title"></h3>
            <p class="catalog__desc"></p>
          </div>
          <p class="catalog__price"><small>a partir de</small> <strong></strong></p>
        </header>
        <div class="catalog__grid"></div>`;
      A.$('.catalog__title', group).textContent = cat.title;
      A.$('.catalog__desc', group).textContent = cat.description;
      A.$('.catalog__price strong', group).textContent = A.formatBRL(cat.price);
      const grid = A.$('.catalog__grid', group);

      items.forEach((p) => grid.appendChild(productCard(p)));
      frag.appendChild(group);
    });

    host.appendChild(frag);
  }

  function productCard(p) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.tilt = '';
    card.innerHTML = `
      <div class="product-card__media">
        <span class="tag ${p.condition === 'Novo' ? 'tag--new' : 'tag--used'}"></span>
      </div>
      <div class="product-card__body">
        <h4 class="product-card__name"></h4>
        <p class="product-card__model"></p>
        <p class="product-card__desc"></p>
        <ul class="product-card__features"></ul>
        <div class="product-card__foot">
          <p class="product-card__price"><small></small><strong></strong></p>
          <button class="btn btn--primary btn--block" type="button">${A.icon('whatsapp')} Comprar pelo WhatsApp</button>
        </div>
      </div>`;
    const media = A.$('.product-card__media', card);
    media.prepend(A.picture({ image: p.image, imageWebp: p.imageWebp, imageAvif: p.imageAvif, alt: p.imageAlt || p.name }));
    if (p.illustrative) {
      const note = document.createElement('span');
      note.className = 'product-card__note';
      note.textContent = 'Imagem ilustrativa';
      media.appendChild(note);
    }
    A.$('.tag', card).textContent = p.condition;
    A.$('.product-card__name', card).textContent = p.name;
    const model = A.$('.product-card__model', card);
    model.textContent = `Modelo: ${p.model}`;
    A.$('.product-card__desc', card).textContent = p.description;
    const list = A.$('.product-card__features', card);
    p.features.forEach((f) => {
      const li = document.createElement('li');
      li.innerHTML = A.icon('check');
      li.appendChild(document.createTextNode(f));
      if (f.includes('[')) li.classList.add('placeholder-info');
      list.appendChild(li);
    });
    A.$('.product-card__price small', card).textContent = `Estado: ${p.condition}`;
    A.$('.product-card__price strong', card).textContent = A.formatBRL(p.price);
    const btn = A.$('button', card);
    btn.setAttribute('aria-label', `Comprar ${p.name} ${p.condition} pelo WhatsApp`);
    btn.addEventListener('click', () => openCheckout(p));
    return card;
  }

  /* ---------- Compra ---------- */
  const dlgCheckout = A.$('#dlg-checkout');
  const formCheckout = A.$('#form-checkout');
  const addrCheckout = A.Address.create(A.$('[data-address-slot="checkout"]'), 'co');
  let currentProduct = null;
  A.dialog.wire(dlgCheckout);
  A.forms.liveClear(formCheckout);

  const priceOf = (p) => (p.isPromo ? A.promotion.getState().price : p.price);

  function openCheckout(product) {
    currentProduct = product;
    A.forms.clearAll(formCheckout);
    A.$('[data-order-img]', dlgCheckout).src = product.image;
    A.$('[data-order-name]', dlgCheckout).textContent = `${product.name} · Modelo: ${product.model}`;
    A.$('[data-order-condition]', dlgCheckout).textContent = product.condition;
    A.$('[data-order-price]', dlgCheckout).textContent = A.formatBRL(priceOf(product));
    formCheckout.product.value = product.name;
    formCheckout.model.value = product.model;
    A.dialog.open(dlgCheckout);
    formCheckout.name.focus();
  }

  formCheckout.addEventListener('submit', (e) => {
    e.preventDefault();
    A.forms.clearAll(formCheckout);
    const okName = validateName(formCheckout.name);
    const okAddr = addrCheckout.validate();
    if (!okName || !okAddr || !currentProduct) {
      A.forms.focusFirstError(formCheckout);
      return;
    }
    const p = currentProduct;
    const price = priceOf(p);
    const promoActive = p.isPromo && A.promotion.getState().active;
    const message = [
      'Olá, Atalaia Purificadores! Tenho interesse em comprar um purificador.',
      '',
      line('Nome', A.cleanText(formCheckout.name.value, { max: 80 })),
      ...addressLines(addrCheckout.value()),
      line('Produto', p.name),
      line('Modelo', p.model),
      line('Estado', p.condition),
      line('Valor', A.formatBRL(price) + (promoActive ? ' (oferta especial)' : '')),
    ].join('\n');
    A.$('[data-order-price]', dlgCheckout).textContent = A.formatBRL(price);
    showPreview({ message, label: 'Finalizar pelo WhatsApp' });
  });

  /* ---------- Serviços ---------- */
  const dlgService = A.$('#dlg-service');
  const formService = A.$('#form-service');
  const addrService = A.Address.create(A.$('[data-address-slot="service"]'), 'sv');
  A.dialog.wire(dlgService);
  A.forms.liveClear(formService);

  function openService(serviceName) {
    A.forms.clearAll(formService);
    if (CONFIG.services.includes(serviceName)) formService.service.value = serviceName;
    A.dialog.open(dlgService);
    formService.name.focus();
  }

  A.$$('[data-service]').forEach((btn) =>
    btn.addEventListener('click', () => openService(btn.dataset.service))
  );

  formService.addEventListener('submit', (e) => {
    e.preventDefault();
    A.forms.clearAll(formService);
    const okName = validateName(formService.name);
    const okAddr = addrService.validate();
    if (!okName || !okAddr) {
      A.forms.focusFirstError(formService);
      return;
    }
    const model = A.cleanText(formService.model.value, { max: 80 });
    const notes = A.cleanText(formService.notes.value, { max: 500, multiline: true });
    const message = [
      'Olá, Atalaia Purificadores! Gostaria de solicitar um serviço.',
      '',
      line('Nome', A.cleanText(formService.name.value, { max: 80 })),
      line('Serviço', formService.service.value),
      line('Modelo do purificador', model || 'Não informado'),
      ...addressLines(addrService.value()),
      line('Observações', notes || 'Nenhuma'),
    ].join('\n');
    showPreview({ message, label: 'Solicitar pelo WhatsApp' });
  });

  /* ---------- Diagnóstico ---------- */
  const formDiag = A.$('#form-diagnosis');
  const addrDiag = A.Address.create(A.$('[data-address-slot="diag"]'), 'dg');
  const problemsHost = A.$('[data-problems]', formDiag);
  const OTHER = 'Outro problema';

  CONFIG.problems.forEach((label, i) => {
    const id = `prob-${i}`;
    const wrap = document.createElement('div');
    wrap.className = 'check';
    wrap.innerHTML = `<input type="checkbox" name="problems" id="${id}"><label for="${id}"><span class="check__box" aria-hidden="true">${A.icon('check')}</span><span class="check__text"></span></label>`;
    A.$('input', wrap).value = label;
    A.$('.check__text', wrap).textContent = label;
    problemsHost.appendChild(wrap);
  });
  A.forms.liveClear(formDiag);

  const descInput = A.$('#diag-desc');
  const descOpt = A.$('[data-desc-opt]', formDiag);
  formDiag.addEventListener('change', (e) => {
    if (e.target.name !== 'problems') return;
    A.$('#err-problems').textContent = '';
    A.$$('input[name="problems"]', formDiag).forEach((c) => c.removeAttribute('aria-invalid'));
    const otherChecked = A.$$('input[name="problems"]:checked', formDiag).some((c) => c.value === OTHER);
    descOpt.textContent = otherChecked ? '(obrigatório para "Outro problema")' : '(opcional)';
  });

  formDiag.addEventListener('submit', (e) => {
    e.preventDefault();
    A.forms.clearAll(formDiag);
    let ok = true;
    const selected = A.$$('input[name="problems"]:checked', formDiag).map((c) => c.value);
    const description = A.cleanText(descInput.value, { max: 600, multiline: true });

    if (!selected.length) {
      A.$('#err-problems').textContent = 'Marque pelo menos uma opção.';
      const first = A.$('input[name="problems"]', formDiag);
      first.setAttribute('aria-invalid', 'true');
      first.setAttribute('aria-describedby', 'err-problems');
      first.dataset.errorId = 'err-problems';
      ok = false;
    }
    if (selected.includes(OTHER) && description.length < 5) {
      A.forms.setError(descInput, 'Descreva o problema para que a equipe entenda o que está acontecendo.');
      ok = false;
    }
    if (!validateName(formDiag.name)) ok = false;
    if (!addrDiag.validate()) ok = false;
    if (!ok) {
      A.forms.focusFirstError(formDiag);
      return;
    }
    const model = A.cleanText(formDiag.model.value, { max: 80 });
    const message = [
      'Olá, Atalaia Purificadores! Meu purificador está apresentando um problema.',
      '',
      line('Nome', A.cleanText(formDiag.name.value, { max: 80 })),
      line('Modelo', model || 'Não informado'),
      line('Problema(s)', selected.join(', ')),
      line('Descrição', description || 'Não informada'),
      ...addressLines(addrDiag.value()),
    ].join('\n');
    showPreview({ message, label: 'Pedir avaliação pelo WhatsApp' });
  });

  renderCatalog();
  A.openCheckout = openCheckout;
  A.openService = openService;
})();
