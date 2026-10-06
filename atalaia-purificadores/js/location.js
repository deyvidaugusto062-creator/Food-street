/*
 * Componente de endereço reutilizado nos formulários de compra, serviço e diagnóstico.
 * Três formas de informar o endereço:
 *   1. Digitar manualmente
 *   2. Buscar pelo CEP (ViaCEP — ver ATALAIA_CONFIG.integrations.cep)
 *   3. Usar a localização atual (navigator.geolocation, só após o clique do usuário)
 */
(function () {
  'use strict';

  const A = window.Atalaia;
  const CONFIG = window.ATALAIA_CONFIG;
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const DEFAULT_CITY = 'São Paulo';
  const DEFAULT_UF = 'SP';

  const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
  const formatCep = (v) => {
    const d = onlyDigits(v).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  async function fetchJSON(url, timeoutMs) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function lookupCep(cep) {
    const cfg = CONFIG.integrations.cep;
    if (!cfg || !cfg.enabled) throw new Error('cep-disabled');
    const data = await fetchJSON(cfg.url.replace('{cep}', cep), cfg.timeoutMs);
    if (!data || data.erro === true || data.erro === 'true') {
      const err = new Error('cep-not-found');
      err.code = 'not-found';
      throw err;
    }
    return { street: data.logradouro || '', district: data.bairro || '', city: data.localidade || '', uf: data.uf || '' };
  }

  // Coordenadas → endereço. Só roda se o administrador ativar em config.js.
  async function reverseGeocode(lat, lon) {
    const cfg = CONFIG.integrations.reverseGeocoding;
    if (!cfg || !cfg.enabled) return null;
    const data = await fetchJSON(cfg.url.replace('{lat}', lat).replace('{lon}', lon), cfg.timeoutMs);
    const a = (data && data.address) || {};
    const ufMatch = /^BR-([A-Z]{2})$/.exec(a['ISO3166-2-lvl4'] || '');
    return {
      street: a.road || a.pedestrian || '',
      number: a.house_number || '',
      district: a.suburb || a.neighbourhood || a.quarter || '',
      city: a.city || a.town || a.municipality || '',
      uf: ufMatch ? ufMatch[1] : '',
      cep: a.postcode ? formatCep(a.postcode) : '',
    };
  }

  function template(p) {
    const ufOptions = UFS.map((uf) => `<option value="${uf}"${uf === DEFAULT_UF ? ' selected' : ''}>${uf}</option>`).join('');
    return `
      <fieldset class="address field-group" data-mode="manual">
        <legend>Endereço</legend>
        <div class="segmented" role="radiogroup" aria-label="Como você quer informar o endereço?">
          <input type="radio" id="${p}-mode-manual" name="${p}-mode" value="manual" checked>
          <label for="${p}-mode-manual">${A.icon('edit')}<span>Digitar</span></label>
          <input type="radio" id="${p}-mode-cep" name="${p}-mode" value="cep">
          <label for="${p}-mode-cep">${A.icon('search')}<span>Pelo CEP</span></label>
          <input type="radio" id="${p}-mode-geo" name="${p}-mode" value="geo">
          <label for="${p}-mode-geo">${A.icon('gps')}<span>Localização</span></label>
        </div>

        <div class="address__geo" data-geo-panel hidden>
          <button type="button" class="btn btn--outline btn--block" data-geo-btn>${A.icon('gps')} Usar minha localização</button>
          <p class="address__geo-info" data-geo-info hidden></p>
        </div>

        <div class="field field--cep">
          <label for="${p}-cep">CEP <span class="opt" data-cep-opt>(opcional)</span></label>
          <div class="input-group">
            <input id="${p}-cep" name="cep" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000">
            <button type="button" class="btn btn--outline" data-cep-btn hidden>${A.icon('search')} Buscar</button>
          </div>
          <p class="field__error" id="err-${p}-cep"></p>
        </div>

        <p class="address__status" role="status" aria-live="polite" data-addr-status></p>

        <div class="field">
          <label for="${p}-street">Rua</label>
          <input id="${p}-street" name="street" type="text" autocomplete="address-line1" maxlength="120" required>
          <p class="field__error" id="err-${p}-street"></p>
        </div>
        <div class="form__row">
          <div class="field">
            <label for="${p}-number">Número</label>
            <input id="${p}-number" name="number" type="text" inputmode="text" maxlength="12" required placeholder="Ex.: 120 ou S/N">
            <p class="field__error" id="err-${p}-number"></p>
          </div>
          <div class="field">
            <label for="${p}-complement">Complemento <span class="opt">(opcional)</span></label>
            <input id="${p}-complement" name="complement" type="text" autocomplete="address-line2" maxlength="60" placeholder="Apto, bloco, casa…">
          </div>
        </div>
        <div class="field">
          <label for="${p}-district">Bairro</label>
          <input id="${p}-district" name="district" type="text" autocomplete="address-level3" maxlength="80" required>
          <p class="field__error" id="err-${p}-district"></p>
        </div>
        <div class="form__row form__row--city">
          <div class="field">
            <label for="${p}-city">Cidade</label>
            <input id="${p}-city" name="city" type="text" autocomplete="address-level2" maxlength="80" required value="${DEFAULT_CITY}">
            <p class="field__error" id="err-${p}-city"></p>
          </div>
          <div class="field">
            <label for="${p}-uf">Estado</label>
            <select id="${p}-uf" name="uf" autocomplete="address-level1" required>${ufOptions}</select>
          </div>
        </div>
      </fieldset>`;
  }

  function create(slot, prefix) {
    slot.innerHTML = template(prefix);
    const root = A.$('.address', slot);
    const f = {
      cep: A.$(`#${prefix}-cep`, root),
      street: A.$(`#${prefix}-street`, root),
      number: A.$(`#${prefix}-number`, root),
      complement: A.$(`#${prefix}-complement`, root),
      district: A.$(`#${prefix}-district`, root),
      city: A.$(`#${prefix}-city`, root),
      uf: A.$(`#${prefix}-uf`, root),
    };
    const status = A.$('[data-addr-status]', root);
    const cepBtn = A.$('[data-cep-btn]', root);
    const cepOpt = A.$('[data-cep-opt]', root);
    const geoPanel = A.$('[data-geo-panel]', root);
    const geoBtn = A.$('[data-geo-btn]', root);
    const geoInfo = A.$('[data-geo-info]', root);

    let mode = 'manual';
    let coords = null;
    let lastCep = '';
    let busy = false;

    const setStatus = (msg, type = 'info') => {
      status.textContent = msg;
      status.dataset.type = type;
    };

    function setMode(next) {
      mode = next;
      root.dataset.mode = next;
      cepBtn.hidden = next !== 'cep';
      cepOpt.textContent = next === 'cep' ? '' : '(opcional)';
      geoPanel.hidden = next !== 'geo';
      setStatus('');
      if (next === 'cep') f.cep.focus();
    }

    function fill(data, { overwrite = true } = {}) {
      ['street', 'number', 'district', 'city', 'cep'].forEach((k) => {
        if (data[k] && (overwrite || !f[k].value.trim())) {
          f[k].value = data[k];
          A.forms.clearError(f[k]);
        }
      });
      if (data.uf && UFS.includes(data.uf)) f.uf.value = data.uf;
    }

    async function searchCep() {
      const cep = onlyDigits(f.cep.value);
      if (cep.length !== 8) {
        A.forms.setError(f.cep, 'Digite os 8 números do CEP.');
        f.cep.focus();
        return;
      }
      if (busy) return;
      busy = true;
      lastCep = cep;
      cepBtn.disabled = true;
      root.classList.add('is-loading');
      setStatus('Buscando endereço pelo CEP…');
      try {
        const data = await lookupCep(cep);
        fill(data);
        setStatus(
          data.street
            ? 'Endereço encontrado. Agora informe o número e, se precisar, o complemento.'
            : 'CEP encontrado. Este CEP não informa a rua: complete os campos abaixo.',
          'success'
        );
        (data.street ? f.number : f.street).focus();
      } catch (err) {
        const msg =
          err.code === 'not-found'
            ? 'CEP não encontrado. Confira o número ou preencha o endereço manualmente.'
            : 'Não foi possível buscar o CEP agora. Preencha o endereço manualmente.';
        setStatus(msg, 'error');
      } finally {
        busy = false;
        cepBtn.disabled = false;
        root.classList.remove('is-loading');
      }
    }

    function geoErrorMessage(err) {
      switch (err && err.code) {
        case 1:
          return 'Você não permitiu o acesso à localização. Sem problema: preencha o endereço abaixo.';
        case 2:
          return 'Não foi possível determinar sua localização. Preencha o endereço abaixo.';
        case 3:
          return 'A localização demorou para responder. Tente de novo ou preencha o endereço abaixo.';
        default:
          return 'Não foi possível obter a localização. Preencha o endereço abaixo.';
      }
    }

    function clearCoords() {
      coords = null;
      geoInfo.hidden = true;
      geoInfo.innerHTML = '';
    }

    function showCoords() {
      const mapUrl = mapsUrl();
      geoInfo.innerHTML = '';
      const p = document.createElement('span');
      p.textContent = `Localização obtida (${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}${coords.accuracy ? `, precisão de ~${Math.round(coords.accuracy)} m` : ''}). `;
      const link = document.createElement('a');
      link.href = mapUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Ver no mapa';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link-btn';
      remove.textContent = 'Remover';
      remove.addEventListener('click', () => {
        clearCoords();
        setStatus('Localização removida. A mensagem será enviada só com o endereço digitado.');
      });
      geoInfo.append(p, link, ' · ', remove);
      geoInfo.hidden = false;
    }

    function useLocation() {
      if (!('geolocation' in navigator)) {
        setStatus('Este navegador não oferece acesso à localização. Preencha o endereço abaixo.', 'error');
        return;
      }
      if (window.isSecureContext === false) {
        setStatus('A localização só funciona quando o site está publicado com https. Preencha o endereço abaixo.', 'error');
        return;
      }
      geoBtn.disabled = true;
      root.classList.add('is-loading');
      setStatus('Aguardando a permissão de localização do navegador…');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
          showCoords();
          let filled = false;
          try {
            const data = await reverseGeocode(coords.lat, coords.lon);
            if (data && (data.street || data.district)) {
              fill(data, { overwrite: true });
              filled = true;
            }
          } catch (e) {
            filled = false;
          }
          geoBtn.disabled = false;
          root.classList.remove('is-loading');
          if (filled) {
            setStatus('Encontramos um endereço aproximado. Confira os dados e complete o número e o complemento.', 'success');
            f.number.focus();
          } else {
            setStatus('Localização registrada. Confirme o endereço abaixo (rua, número e bairro). O link do mapa vai junto na mensagem.', 'success');
            f.street.focus();
          }
        },
        (err) => {
          clearCoords();
          geoBtn.disabled = false;
          root.classList.remove('is-loading');
          setStatus(geoErrorMessage(err), 'error');
          f.street.focus();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    }

    function mapsUrl() {
      return coords ? `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}` : '';
    }

    /* Eventos */
    A.$$(`input[name="${prefix}-mode"]`, root).forEach((r) =>
      r.addEventListener('change', () => r.checked && setMode(r.value))
    );
    f.cep.addEventListener('input', () => {
      const formatted = formatCep(f.cep.value);
      if (formatted !== f.cep.value) f.cep.value = formatted;
      const digits = onlyDigits(formatted);
      if (mode === 'cep' && digits.length === 8 && digits !== lastCep) searchCep();
    });
    f.cep.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && mode === 'cep') {
        e.preventDefault();
        searchCep();
      }
    });
    cepBtn.addEventListener('click', searchCep);
    geoBtn.addEventListener('click', useLocation);

    return {
      validate() {
        let ok = true;
        const need = (input, msg) => {
          if (!input.value.trim()) {
            A.forms.setError(input, msg);
            ok = false;
          }
        };
        const cepDigits = onlyDigits(f.cep.value);
        if (mode === 'cep' && !cepDigits) {
          A.forms.setError(f.cep, 'Informe o CEP ou escolha "Digitar".');
          ok = false;
        } else if (cepDigits && cepDigits.length !== 8) {
          A.forms.setError(f.cep, 'O CEP precisa ter 8 números.');
          ok = false;
        }
        need(f.street, 'Informe a rua.');
        need(f.number, 'Informe o número (ou S/N).');
        need(f.district, 'Informe o bairro.');
        need(f.city, 'Informe a cidade.');
        return ok;
      },
      value() {
        const clean = (el, max) => A.cleanText(el.value, { max });
        const street = clean(f.street, 120);
        const number = clean(f.number, 12);
        const complement = clean(f.complement, 60);
        const district = clean(f.district, 80);
        const city = clean(f.city, 80);
        const cep = formatCep(f.cep.value);
        let text = `${street}, ${number}`;
        if (complement) text += ` – ${complement}`;
        text += ` – ${district}, ${city}/${f.uf.value}`;
        if (cep.length === 9) text += ` – CEP ${cep}`;
        return { text, mapsUrl: mapsUrl() };
      },
      reset() {
        Object.values(f).forEach((el) => A.forms.clearError(el));
        ['cep', 'street', 'number', 'complement', 'district'].forEach((k) => (f[k].value = ''));
        f.city.value = DEFAULT_CITY;
        f.uf.value = DEFAULT_UF;
        clearCoords();
        lastCep = '';
        A.$(`#${prefix}-mode-manual`, root).checked = true;
        setMode('manual');
      },
    };
  }

  A.Address = { create, formatCep };
})();
