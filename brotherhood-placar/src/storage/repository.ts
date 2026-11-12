import { DEFAULT_RULES, DEFAULT_TEAMS } from '../domain/defaults';
import type { Snapshot } from '../domain/rules';
import type { MatchRules, MatchState, Team } from '../domain/types';

/**
 * Persistência local. Recebe um KV compatível com Storage para poder ser
 * testado em memória e, no futuro, trocado por IndexedDB ou um backend sem
 * mexer no domínio nem na UI.
 */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Settings {
  rules: MatchRules;
  sounds: { point: boolean; setEnd: boolean };
  lastTeams: { A: Team; B: Team };
  lastInfo: { tournament: string; venue: string };
}

export interface CurrentMatch {
  match: MatchState;
  past: Snapshot[];
}

export const KEYS = {
  settings: 'bhp.v1.settings',
  current: 'bhp.v1.current',
  history: 'bhp.v1.history',
} as const;

export const MAX_UNDO = 400;
export const MAX_HISTORY = 60;

export const defaultSettings = (): Settings => ({
  rules: { ...DEFAULT_RULES },
  sounds: { point: true, setEnd: true },
  lastTeams: { A: { ...DEFAULT_TEAMS.A }, B: { ...DEFAULT_TEAMS.B } },
  lastInfo: { tournament: '', venue: '' },
});

function read<T>(kv: KV, key: string): T | null {
  try {
    const raw = kv.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(kv: KV, key: string, value: unknown): boolean {
  try {
    kv.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // cota excedida ou storage indisponível
  }
}

const looksLikeMatch = (m: unknown): m is MatchState =>
  !!m &&
  typeof m === 'object' &&
  typeof (m as MatchState).id === 'string' &&
  typeof (m as MatchState).score?.A === 'number' &&
  typeof (m as MatchState).teams?.A?.name === 'string';

export function createRepository(kv: KV) {
  return {
    loadSettings(): Settings {
      const saved = read<Partial<Settings>>(kv, KEYS.settings);
      const base = defaultSettings();
      if (!saved) return base;
      return {
        rules: { ...base.rules, ...saved.rules },
        sounds: { ...base.sounds, ...saved.sounds },
        lastTeams: {
          A: { ...base.lastTeams.A, ...saved.lastTeams?.A },
          B: { ...base.lastTeams.B, ...saved.lastTeams?.B },
        },
        lastInfo: { ...base.lastInfo, ...saved.lastInfo },
      };
    },

    saveSettings(settings: Settings): boolean {
      return write(kv, KEYS.settings, settings);
    },

    loadCurrent(): CurrentMatch | null {
      const data = read<CurrentMatch>(kv, KEYS.current);
      if (!data || !looksLikeMatch(data.match)) return null;
      return { match: data.match, past: Array.isArray(data.past) ? data.past : [] };
    },

    /** Grava a partida em andamento. Se faltar espaço, encurta a pilha de desfazer. */
    saveCurrent(current: CurrentMatch): boolean {
      let past = current.past.slice(-MAX_UNDO);
      while (!write(kv, KEYS.current, { match: current.match, past })) {
        if (past.length === 0) return false;
        past = past.slice(Math.ceil(past.length / 2));
      }
      return true;
    },

    clearCurrent(): void {
      kv.removeItem(KEYS.current);
    },

    loadHistory(): MatchState[] {
      const list = read<unknown[]>(kv, KEYS.history);
      return Array.isArray(list) ? list.filter(looksLikeMatch) : [];
    },

    /** Insere/atualiza uma partida no histórico (mais recente primeiro). */
    upsertHistory(match: MatchState): MatchState[] {
      let list = [match, ...this.loadHistory().filter((m) => m.id !== match.id)].slice(0, MAX_HISTORY);
      while (!write(kv, KEYS.history, list) && list.length > 1) list = list.slice(0, -1);
      return list;
    },

    removeHistory(id: string): MatchState[] {
      const list = this.loadHistory().filter((m) => m.id !== id);
      write(kv, KEYS.history, list);
      return list;
    },

    clearHistory(): void {
      kv.removeItem(KEYS.history);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;

export function memoryKV(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
