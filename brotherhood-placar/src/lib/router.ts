import { useSyncExternalStore } from 'react';

/**
 * Roteamento por hash: funciona em qualquer hospedagem estática e offline
 * (compatível com service worker sem regras de fallback no servidor).
 */
export type Route =
  | { name: 'home' }
  | { name: 'setup' }
  | { name: 'scoreboard' }
  | { name: 'display' }
  | { name: 'history' }
  | { name: 'match'; id: string }
  | { name: 'settings' };

export function parse(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case 'nova':
      return { name: 'setup' };
    case 'placar':
      return { name: 'scoreboard' };
    case 'telao':
      return { name: 'display' };
    case 'historico':
      return parts[1] ? { name: 'match', id: decodeURIComponent(parts[1]) } : { name: 'history' };
    case 'config':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

export const href = {
  home: '#/',
  setup: '#/nova',
  scoreboard: '#/placar',
  display: '#/telao',
  displayWindow: '#/telao?janela=1',
  history: '#/historico',
  match: (id: string) => `#/historico/${encodeURIComponent(id)}`,
  settings: '#/config',
};

export const navigate = (to: string) => {
  window.location.hash = to;
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}

/** Esta janela é um Telão aberto em janela separada (somente leitura). */
export const isDisplayWindow = () => window.location.hash.includes('janela=1');
