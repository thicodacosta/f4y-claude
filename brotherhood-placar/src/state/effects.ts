import { useEffect, useRef } from 'react';
import type { MatchState } from '../domain/types';
import type { Settings } from '../storage/repository';
import { sounds } from '../lib/sound';
import { store } from './store';

/**
 * Transições automáticas: fim do tempo técnico e fim do intervalo entre sets.
 * Rodam só na janela de operação (o Telão em janela separada é somente leitura).
 */
export function useAutoTransitions(match: MatchState | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !match) return;
    const deadline = match.activeTimeout?.endsAt ?? (match.status === 'interval' ? match.intervalEndsAt : null);
    if (deadline === null) return;
    const fire = () => {
      const m = store.getState().match;
      if (!m) return;
      if (m.activeTimeout && Date.now() >= m.activeTimeout.endsAt) store.dispatch({ type: 'endTimeout' }, { system: true });
      else if (m.status === 'interval' && m.intervalEndsAt && Date.now() >= m.intervalEndsAt)
        store.dispatch({ type: 'nextSet' }, { system: true });
    };
    const id = window.setTimeout(fire, Math.max(0, deadline - Date.now()) + 50);
    return () => window.clearTimeout(id);
  }, [enabled, match]);
}

/** Toca sons conforme novos eventos chegam ao log da partida. */
export function useMatchSounds(match: MatchState | null, settings: Settings, enabled: boolean) {
  const seen = useRef<{ id: string; count: number } | null>(null);
  useEffect(() => {
    if (!match) return;
    const prev = seen.current;
    seen.current = { id: match.id, count: match.events.length };
    if (!enabled || !prev || prev.id !== match.id || match.events.length <= prev.count) return;
    const fresh = match.events.slice(prev.count).map((e) => e.type);
    if (fresh.includes('match_end')) settings.sounds.setEnd && sounds.matchEnd();
    else if (fresh.includes('set_end')) settings.sounds.setEnd && sounds.setEnd();
    else if (fresh.includes('timeout')) settings.sounds.point && sounds.timeout();
    else if (fresh.includes('point')) settings.sounds.point && sounds.point();
  }, [match, settings, enabled]);
}
