import { useSyncExternalStore } from 'react';
import { createRepository, KEYS, memoryKV, type KV } from '../storage/repository';
import { createMatchStore } from './matchStore';

function browserKV(): KV {
  try {
    const probe = '__bhp_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryKV(); // navegação privada / storage bloqueado
  }
}

export const store = createMatchStore(createRepository(browserKV()));

// Outra janela (ex.: Telão aberto em uma TV via HDMI) alterou os dados.
window.addEventListener('storage', (e) => {
  if (e.key === null || (Object.values(KEYS) as string[]).includes(e.key)) store.reload();
});

export function useStore<T>(selector: (s: ReturnType<typeof store.getState>) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export const useMatch = () => useStore((s) => s.match);
export const useSettings = () => useStore((s) => s.settings);
export const useHistory = () => useStore((s) => s.history);
export const useCanUndo = () => useStore((s) => s.past.length > 0 && !!s.match);
