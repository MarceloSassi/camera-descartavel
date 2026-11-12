(() => {
  const cfg = window.REVEAL_CONFIG;
  const $ = (s) => document.querySelector(s);
  const lockedState = $('#lockedState');
  const galleryState = $('#galleryState');
  const countdown = $('#countdown');
  const revealConfigMessage = $('#revealConfigMessage');
  const galleryGrid = $('#galleryGrid');
  const photoCount = $('#photoCount');
  const galleryMessage = $('#galleryMessage');
  const refreshButton = $('#refreshButton');

  document.title = `Revelação — ${cfg.APP_NAME}`;

  const revealConfigured = cfg.REVEAL_AT && !cfg.REVEAL_AT.includes('COLE_AQUI');
  const revealAt = revealConfigured ? new Date(cfg.REVEAL_AT).getTime() : NaN;
  let interval = null;

  if (!revealConfigured || Number.isNaN(revealAt)) {
    countdown.textContent = '--:--:--';
    revealConfigMessage.textContent = 'A data da revelação ainda não foi configurada.';
  } else {
    tick();
    interval = setInterval(tick, 1000);
  }

  refreshButton.addEventListener('click', loadGallery);

  function tick() {
    const diff = revealAt - Date.now();
    if (diff <= 0) {
      clearInterval(interval);
      lockedState.hidden = true;
      galleryState.hidden = false;
      loadGallery();
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdown.textContent = days > 0
      ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function loadGallery() {
    galleryMessage.textContent = '';
    galleryGrid.innerHTML = '';

    if (!cfg.APPS_SCRIPT_URL || cfg.APPS_SCRIPT_URL.includes('COLE_AQUI')) {
      galleryMessage.textContent = 'Configure a URL do Apps Script em config.js.';
      return;
    }

    const callbackName = `weddingGallery_${Date.now()}`;
    const script = document.createElement('script');

    window[callbackName] = (payload) => {
      cleanup();
      if (!payload?.ok) {
        galleryMessage.textContent = payload?.error || 'Não consegui carregar as fotos.';
        return;
      }

      const photos = payload.photos || [];
      photoCount.textContent = `${photos.length} ${photos.length === 1 ? 'foto revelada' : 'fotos reveladas'}`;

      if (!photos.length) {
        galleryMessage.textContent = 'Nenhuma foto foi enviada ainda.';
        return;
      }

      photos.forEach((photo) => {
        const link = document.createElement('a');
        link.href = photo.fullUrl;
        link.target = '_blank';
        link.rel = 'noopener';

        const img = document.createElement('img');
        img.src = photo.thumbUrl;
        img.alt = 'Foto do casamento de Lorena e Marcelo';
        img.referrerPolicy = 'no-referrer';
        img.loading = 'lazy';
        img.decoding = 'async';

        link.appendChild(img);
        galleryGrid.appendChild(link);
      });
    };

    script.onerror = () => {
      cleanup();
      galleryMessage.textContent = 'Falha ao carregar a galeria.';
    };

    const params = new URLSearchParams({
      action: 'list',
      callback: callbackName
    });
    script.src = `${cfg.APPS_SCRIPT_URL}?${params.toString()}`;
    document.body.appendChild(script);

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }
  }

  function pad(n) { return String(n).padStart(2, '0'); }
})();
