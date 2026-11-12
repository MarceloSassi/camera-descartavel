// Service worker da câmera descartável.
// Ao alterar qualquer arquivo do site, aumente CACHE_VERSION para forçar a atualização.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `camera-lm-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './gallery.html',
  './styles.css',
  './app.js',
  './gallery.js',
  './config.js',
  './pwa.js',
  './manifest.webmanifest',
  './assets/logo-evento.png',
  './assets/logo-mini.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png'
];

// Páginas e config.js usam "rede primeiro" para que mudanças (URL do
// Apps Script, horário da revelação) cheguem a quem já instalou o app.
const NETWORK_FIRST = /\/(index\.html|gallery\.html|config\.js)?$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' ignora o cache HTTP para não guardar arquivos antigos.
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('camera-lm-') && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Fontes do Google: guardadas para o app abrir bonito também offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Apps Script, Drive e qualquer outro domínio passam direto pela rede.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || NETWORK_FIRST.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // no-cache: revalida com o servidor em vez de usar o cache HTTP do navegador.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return (await cache.match('./index.html')) || Response.error();
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
