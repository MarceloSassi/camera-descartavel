// Registra o service worker (necessário para instalar o app e abrir offline).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker não registrado:', err);
    });
  });
}
