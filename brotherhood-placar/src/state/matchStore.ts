import {
  createMatch,
  isUndoable,
  reduceMatch,
  restartMatch,
  restoreSnapshot,
  takeSnapshot,
  type Snapshot,
} from '../domain/rules';
import type { MatchAction, MatchState, NewMatchInput } from '../domain/types';
import { MAX_UNDO, type Repository, type Settings } from '../storage/repository';

export interface StoreState {
  match: MatchState | null;
  past: Snapshot[];
  settings: Settings;
  history: MatchState[];
}

/**
 * Store da aplicação, sem dependência de React ou do DOM.
 * Toda mudança é persistida de forma síncrona antes de notificar a UI,
 * então fechar ou recarregar o navegador nunca perde um ponto.
 */
export function createMatchStore(repo: Repository, now: () => number = Date.now) {
  const saved = repo.loadCurrent();
  let state: StoreState = {
    match: saved?.match ?? null,
    past: saved?.past ?? [],
    settings: repo.loadSettings(),
    history: repo.loadHistory(),
  };
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  function commitMatch(match: MatchState | null, past: Snapshot[], prev: MatchState | null) {
    let history = state.history;
    if (match) {
      repo.saveCurrent({ match, past });
      if (match.status === 'finished') history = repo.upsertHistory(match);
      else if (prev?.status === 'finished' && prev.id === match.id) history = repo.removeHistory(match.id);
    } else {
      repo.clearCurrent();
    }
    state = { ...state, match, past, history };
    emit();
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Aplica uma ação à partida atual. `system` marca transições automáticas
     * (fim do tempo técnico/intervalo), que não entram na pilha de desfazer.
     * Retorna true se algo mudou.
     */
    dispatch(action: MatchAction, opts: { system?: boolean } = {}): boolean {
      const cur = state.match;
      if (!cur) return false;
      const next = reduceMatch(cur, action, now());
      if (next === cur) return false;
      const push = isUndoable(action) && !opts.system;
      const past = push ? [...state.past, takeSnapshot(cur)].slice(-MAX_UNDO) : state.past;
      commitMatch(next, past, cur);
      return true;
    },

    canUndo: () => state.past.length > 0 && !!state.match,

    undo(): boolean {
      const cur = state.match;
      const snap = state.past.at(-1);
      if (!cur || !snap) return false;
      commitMatch(restoreSnapshot(snap, cur, now()), state.past.slice(0, -1), cur);
      return true;
    },

    newMatch(input: NewMatchInput): MatchState {
      const match = createMatch(input, now());
      this.updateSettings({
        lastTeams: input.teams,
        lastInfo: { tournament: input.info.tournament, venue: input.info.venue },
      });
      commitMatch(match, [], null);
      return match;
    },

    /** Reinicia com os mesmos times e regras. Partidas finalizadas já estão no histórico. */
    restart(): MatchState | null {
      const cur = state.match;
      if (!cur) return null;
      const match = restartMatch(cur, now());
      commitMatch(match, [], null);
      return match;
    },

    closeMatch() {
      commitMatch(null, [], null);
    },

    updateSettings(patch: Partial<Settings>) {
      const settings = { ...state.settings, ...patch };
      repo.saveSettings(settings);
      state = { ...state, settings };
      emit();
    },

    deleteFromHistory(id: string) {
      state = { ...state, history: repo.removeHistory(id) };
      emit();
    },

    clearHistory() {
      repo.clearHistory();
      state = { ...state, history: [] };
      emit();
    },

    /** Recarrega do storage — usado quando outra janela (o Telão) muda os dados. */
    reload() {
      const cur = repo.loadCurrent();
      state = {
        match: cur?.match ?? null,
        past: cur?.past ?? [],
        settings: repo.loadSettings(),
        history: repo.loadHistory(),
      };
      emit();
    },
  };
}

export type MatchStore = ReturnType<typeof createMatchStore>;
