/**
 * pwa.js
 * Registers the service worker so the app shell can be installed to the
 * home screen and boot offline. Loaded on every page.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
