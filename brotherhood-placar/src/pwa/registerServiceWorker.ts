/**
 * Ponto único de registro do service worker (Etapa PWA).
 *
 * Nesta versão o registro está desligado de propósito: o app já funciona sem
 * backend e com persistência local, e o manifest/ícones já estão publicados.
 * Para ativar, gere `sw.js` (ver docs/brotherhood-placar/PWA.md) e mude
 * ENABLED para true. Nada mais na aplicação precisa mudar.
 */
const ENABLED = false;

export function registerServiceWorker() {
  if (!ENABLED || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* falha de registro não pode afetar o placar */
    });
  });
}
