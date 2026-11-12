import { useSyncExternalStore } from 'react';

/**
 * Service worker (vite-plugin-pwa / Workbox): deixa o app instalável e
 * funcionando offline na quadra. Quando sai uma versão nova, ela NÃO é
 * aplicada sozinha: a tela inicial mostra um aviso e o usuário escolhe o
 * momento, para nunca recarregar no meio de uma partida.
 */
let updateReady = false;
let applyUpdate: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        updateReady = true;
        listeners.forEach((l) => l());
      },
      onRegisteredSW(_url, reg) {
        // Procura versão nova a cada hora com o app aberto.
        if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000);
      },
    });
    applyUpdate = () => update(true);
  });

  // Pede ao navegador para não apagar o histórico por falta de espaço.
  void navigator.storage?.persist?.().catch(() => undefined);
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => updateReady,
  );
}

export const installUpdate = () => void applyUpdate?.();
