(() => {
  const cfg = window.REVEAL_CONFIG;
  const $ = (s) => document.querySelector(s);

  const counterNumber = $('#counterNumber');
  const counterLabel = $('#counterLabel');
  const counterBar = $('#counterBar');
  const revealCountdown = $('#revealCountdown');
  const cameraInput = $('#cameraInput');
  const cameraButton = $('#cameraButton');
  const uploadButton = $('#uploadButton');
  const retakeButton = $('#retakeButton');
  const closeSheet = $('#closeSheet');
  const sheet = $('#previewSheet');
  const preview = $('#preview');
  const previewLoading = $('#previewLoading');
  const toast = $('#toast');
  const uploadForm = $('#uploadForm');
  const uploadFrame = $('#uploadFrame');

  document.title = `${cfg.APP_NAME} — câmera descartável`;

  const guestKey = 'lorena_marcelo_wedding_guest';
  const countKey = 'lorena_marcelo_wedding_count';
  const UPLOAD_TIMEOUT_MS = 120000;

  const guestId = getOrCreateGuestId();
  // localCount = fotos já enviadas + fotos na fila aguardando envio.
  let localCount = Number(localStorage.getItem(countKey) || 0);
  let prepared = null;
  let inFlight = null; // { id, timer }
  let pendingCount = 0;
  let toastTimer = null;

  const queue = createQueue();

  updateCounter();
  startRevealCountdown();
  refreshPending().then(() => {
    updateCounter();
    if (pendingCount > 0) {
      setMessage(navigator.onLine
        ? `Enviando ${pendingLabel()} pendentes…`
        : `${capitalize(pendingLabel())} aguardando conexão.`, '', true);
    }
    flushQueue();
  });

  window.addEventListener('online', () => {
    if (pendingCount > 0) setMessage('Conexão de volta. Enviando…', '', true);
    flushQueue();
  });
  window.addEventListener('offline', () => {
    if (pendingCount > 0) setMessage(`Sem conexão • ${pendingLabel()} na fila`, '', true);
  });

  cameraButton.addEventListener('click', openCamera);
  retakeButton.addEventListener('click', () => {
    discardPrepared();
    openCamera();
  });
  closeSheet.addEventListener('click', () => {
    discardPrepared();
    hideSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) {
      discardPrepared();
      hideSheet();
    }
  });

  cameraInput.addEventListener('change', async () => {
    const file = cameraInput.files?.[0];
    cameraInput.value = '';
    if (!file) return;

    discardPrepared();
    showSheet();

    try {
      prepared = await compressImage(file, cfg.MAX_IMAGE_SIDE, cfg.JPEG_QUALITY);
      preview.src = prepared.previewUrl;
      // Espera a imagem decodificar para a transição ficar suave, mas sem travar.
      await Promise.race([preview.decode().catch(() => {}), new Promise((r) => setTimeout(r, 800))]);
      sheet.classList.add('has-photo');
      uploadButton.disabled = false;
      uploadButton.focus({ preventScroll: true });
    } catch (err) {
      prepared = null;
      hideSheet();
      setMessage(err.message || 'Não consegui processar essa foto.', 'error');
    }
  });

  uploadButton.addEventListener('click', async () => {
    if (!prepared || remaining() <= 0) return;
    if (!isConfigured()) {
      setMessage('Configure a URL do Apps Script em config.js.', 'error');
      return;
    }

    uploadButton.disabled = true;

    try {
      // A foto vai primeiro para a fila local (IndexedDB). Assim ela não se
      // perde se a internet cair ou se o convidado fechar o app.
      await queue.add({ filename: buildFilename(), blob: prepared.blob });
    } catch (err) {
      uploadButton.disabled = false;
      setMessage('Falha ao preparar o envio. Tente novamente.', 'error');
      return;
    }

    discardPrepared();
    hideSheet();
    localCount += 1;
    localStorage.setItem(countKey, String(localCount));
    await refreshPending();
    updateCounter(true);

    setMessage(navigator.onLine
      ? 'Enviando para o álbum…'
      : 'Sem conexão. A foto será enviada quando a internet voltar.', '', true);
    flushQueue();
  });

  uploadFrame.addEventListener('load', async () => {
    if (!inFlight) return;
    const { id, timer } = inFlight;
    clearTimeout(timer);
    inFlight = null;

    // Em um POST cross-origin para Apps Script não lemos o corpo da resposta.
    // Se o aparelho estava offline, o iframe carregou uma página de erro:
    // mantemos a foto na fila para tentar de novo.
    if (!navigator.onLine) {
      await refreshPending();
      updateCounter();
      setMessage(`Sem conexão • ${pendingLabel()} na fila`, '', true);
      return;
    }

    await queue.remove(id);
    await refreshPending();
    updateCounter();
    if (pendingCount > 0) {
      setMessage(`Foto enviada ✓ • enviando ${pendingLabel()}…`, 'ok', true);
    } else {
      setMessage('Foto enviada para o álbum ✓', 'ok');
    }
    flushQueue();
  });

  function openCamera() {
    if (remaining() <= 0) return;
    cameraInput.click();
  }

  function showSheet() {
    sheet.classList.remove('has-photo');
    uploadButton.disabled = true;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
  }

  function hideSheet() {
    sheet.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => {
      if (!sheet.classList.contains('is-open')) {
        sheet.hidden = true;
        preview.removeAttribute('src');
      }
    }, 260);
    cameraButton.focus({ preventScroll: true });
  }

  function discardPrepared() {
    if (prepared) URL.revokeObjectURL(prepared.previewUrl);
    prepared = null;
  }

  function startRevealCountdown() {
    const revealAt = new Date(cfg.REVEAL_AT).getTime();
    if (Number.isNaN(revealAt)) return;
    const tick = () => {
      const diff = revealAt - Date.now();
      if (diff <= 0) {
        revealCountdown.textContent = 'Fotos reveladas ✦';
        return;
      }
      const mins = Math.floor(diff / 60000);
      const d = Math.floor(mins / 1440);
      const h = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      revealCountdown.textContent = d > 0 ? `em ${d}d ${h}h` : `em ${h}h ${String(m).padStart(2, '0')}min`;
      setTimeout(tick, 30000);
    };
    tick();
  }

  async function flushQueue() {
    if (inFlight || !navigator.onLine || !isConfigured()) return;

    let item;
    try {
      item = await queue.first();
    } catch (err) {
      return;
    }
    if (!item || inFlight) return;

    let dataUrl;
    try {
      dataUrl = await blobToDataUrl(item.blob);
    } catch (err) {
      // Item corrompido: descarta para não travar a fila.
      await queue.remove(item.id);
      await refreshPending();
      flushQueue();
      return;
    }

    const timer = setTimeout(() => {
      inFlight = null;
      setMessage('O envio está demorando. Tentando de novo…', 'error');
      setTimeout(flushQueue, 5000);
    }, UPLOAD_TIMEOUT_MS);
    inFlight = { id: item.id, timer };

    submitViaHiddenForm({
      action: 'upload',
      guestId,
      filename: item.filename,
      mimeType: 'image/jpeg',
      imageBase64: dataUrl.split(',')[1]
    });
  }

  function submitViaHiddenForm(fields) {
    uploadForm.innerHTML = '';
    uploadForm.action = cfg.APPS_SCRIPT_URL;
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      uploadForm.appendChild(input);
    });
    uploadForm.submit();
  }

  async function refreshPending() {
    try {
      pendingCount = await queue.count();
    } catch (err) {
      pendingCount = 0;
    }
  }

  function pendingLabel() {
    return `${pendingCount} ${pendingCount === 1 ? 'foto' : 'fotos'}`;
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function remaining() {
    return Math.max(0, cfg.PHOTO_LIMIT - localCount);
  }

  function updateCounter(bump = false) {
    const left = remaining();
    counterNumber.textContent = String(left);
    counterLabel.textContent = left === 0
      ? 'todas usadas · obrigado!'
      : left === 1 ? 'foto restante' : 'fotos restantes';
    counterBar.style.width = `${(left / cfg.PHOTO_LIMIT) * 100}%`;
    if (pendingCount > 0) counterLabel.textContent += ` • ${pendingCount} na fila`;
    cameraButton.disabled = left <= 0;
    cameraButton.setAttribute('aria-label', left > 0 ? `Tirar foto (${left} restantes)` : 'Você usou todas as fotos');
    if (bump) {
      counterNumber.classList.remove('bump');
      void counterNumber.offsetWidth;
      counterNumber.classList.add('bump');
    }
  }

  function setMessage(message, type = '', sticky = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast ${type}`.trim();
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    if (!sticky) {
      toastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
        toastTimer = setTimeout(() => { toast.hidden = true; }, 300);
      }, type === 'error' ? 5000 : 3200);
    }
  }

  function getOrCreateGuestId() {
    let id = localStorage.getItem(guestKey);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem(guestKey, id);
    }
    return id;
  }

  function buildFilename() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `casamento-lorena-marcelo_${stamp}_${guestId.slice(0, 8)}.jpg`;
  }

  function isConfigured() {
    return cfg.APPS_SCRIPT_URL && !cfg.APPS_SCRIPT_URL.includes('COLE_AQUI');
  }

  // Fila persistente em IndexedDB, com fallback em memória quando o
  // navegador não permite IndexedDB (ex.: alguns modos privados).
  function createQueue() {
    const DB_NAME = 'camera-lm';
    const STORE = 'pending-uploads';
    let dbPromise = null;
    const memory = [];
    let memoryId = 0;

    function open() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
          // Alguns Safari/iOS às vezes nunca respondem ao abrir o IndexedDB:
          // após 3s seguimos com a fila em memória para o botão não travar.
          const timer = setTimeout(() => reject(new Error('IndexedDB não respondeu')), 3000);
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          req.onsuccess = () => {
            clearTimeout(timer);
            const db = req.result;
            db.onversionchange = () => { db.close(); dbPromise = null; };
            resolve(db);
          };
          req.onerror = () => { clearTimeout(timer); reject(req.error); };
        }).catch(() => null);
      }
      return dbPromise;
    }

    function run(mode, fn) {
      return open().then((db) => {
        if (!db) return fn(null);
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          let result;
          req.onsuccess = () => { result = req.result; };
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      });
    }

    return {
      add: (item) => run('readwrite', (store) => store
        ? store.add({ ...item, createdAt: Date.now() })
        : (memory.push({ ...item, id: ++memoryId }), memoryId)),
      first: () => run('readonly', (store) => store
        ? store.openCursor()
        : { value: memory[0] }).then((cursor) => cursor?.value || null),
      remove: (id) => run('readwrite', (store) => store
        ? store.delete(id)
        : memory.splice(memory.findIndex((m) => m.id === id) >>> 0, 1)),
      count: () => run('readonly', (store) => store ? store.count() : memory.length)
    };
  }

  async function compressImage(file, maxSide, quality) {
    if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((out) => out ? resolve(out) : reject(new Error('Falha ao comprimir a foto.')), 'image/jpeg', quality);
    });

    return { blob, previewUrl: URL.createObjectURL(blob) };
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
})();
