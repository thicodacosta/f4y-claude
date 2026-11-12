import { elapsed, startClock, stopClock, stoppedClock } from './clock';
import type {
  MatchAction,
  MatchEvent,
  MatchEventType,
  MatchRules,
  MatchState,
  NewMatchInput,
  TeamId,
} from './types';

/* ------------------------------------------------------------------ */
/* Regras puras                                                        */
/* ------------------------------------------------------------------ */

export const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');

export const setsToWin = (rules: MatchRules): number => Math.ceil(rules.bestOf / 2);

export const isDecidingSet = (rules: MatchRules, setNumber: number): boolean =>
  setNumber === rules.bestOf;

export const targetPoints = (rules: MatchRules, setNumber: number): number =>
  isDecidingSet(rules, setNumber) ? rules.tieBreakPoints : rules.setPoints;

/** Vencedor do set com esse placar, ou null se o set continua. */
export function setWinner(a: number, b: number, target: number, minLead: number): TeamId | null {
  if (Math.max(a, b) >= target && Math.abs(a - b) >= minLead) return a > b ? 'A' : 'B';
  return null;
}

/* ------------------------------------------------------------------ */
/* Criação                                                             */
/* ------------------------------------------------------------------ */

export function newMatchId(now: number): string {
  return `m_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createMatch(input: NewMatchInput, now: number, id = newMatchId(now)): MatchState {
  return {
    id,
    createdAt: now,
    info: { ...input.info },
    teams: { A: { ...input.teams.A }, B: { ...input.teams.B } },
    rules: { ...input.rules },
    status: 'not_started',
    currentSet: 1,
    score: { A: 0, B: 0 },
    setsWon: { A: 0, B: 0 },
    sets: [],
    serving: input.firstServer,
    setFirstServer: input.firstServer,
    timeoutsUsed: { A: 0, B: 0 },
    activeTimeout: null,
    intervalEndsAt: null,
    clock: stoppedClock(),
    setStartedAtMs: 0,
    events: [],
    notes: [],
    winner: null,
    finishedAt: null,
  };
}

/** Nova partida com os mesmos times, regras e informações. */
export function restartMatch(state: MatchState, now: number): MatchState {
  return createMatch(
    { teams: state.teams, info: state.info, rules: state.rules, firstServer: matchFirstServer(state) },
    now,
  );
}

/** Quem sacou no início da partida (registrado no evento 'start'). */
export function matchFirstServer(state: MatchState): TeamId {
  return state.events.find((e) => e.type === 'start')?.team ?? state.setFirstServer;
}

/* ------------------------------------------------------------------ */
/* Redutor                                                             */
/* ------------------------------------------------------------------ */

function log(
  s: MatchState,
  now: number,
  type: MatchEventType,
  extra: Partial<Pick<MatchEvent, 'team' | 'detail'>> = {},
): MatchState {
  const event: MatchEvent = {
    type,
    at: now,
    matchTimeMs: elapsed(s.clock, now),
    set: s.currentSet,
    scoreA: s.score.A,
    scoreB: s.score.B,
    ...extra,
  };
  return { ...s, events: [...s.events, event] };
}

function endSet(s: MatchState, winner: TeamId, now: number, forced = false): MatchState {
  const matchTime = elapsed(s.clock, now);
  let next: MatchState = {
    ...s,
    sets: [
      ...s.sets,
      {
        number: s.currentSet,
        scoreA: s.score.A,
        scoreB: s.score.B,
        winner,
        durationMs: Math.max(0, matchTime - s.setStartedAtMs),
        ...(forced ? { forced: true } : {}),
      },
    ],
    setsWon: { ...s.setsWon, [winner]: s.setsWon[winner] + 1 },
    activeTimeout: null,
  };
  next = log(next, now, 'set_end', { team: winner, detail: forced ? 'manual' : undefined });

  if (next.setsWon[winner] >= setsToWin(s.rules)) {
    next = { ...next, status: 'finished', winner, finishedAt: now, clock: stopClock(next.clock, now) };
    return log(next, now, 'match_end', { team: winner });
  }

  const nextServer = other(s.setFirstServer);
  next = {
    ...next,
    currentSet: s.currentSet + 1,
    score: { A: 0, B: 0 },
    timeoutsUsed: { A: 0, B: 0 },
    serving: nextServer,
    setFirstServer: nextServer,
    clock: startClock(next.clock, now),
  };

  if (s.rules.intervalDurationSec > 0) {
    return { ...next, status: 'interval', intervalEndsAt: now + s.rules.intervalDurationSec * 1000 };
  }
  return beginSet(next, now);
}

function beginSet(s: MatchState, now: number): MatchState {
  const next: MatchState = {
    ...s,
    status: 'in_progress',
    intervalEndsAt: null,
    setStartedAtMs: elapsed(s.clock, now),
  };
  return log(next, now, 'set_start');
}

function checkSetEnd(s: MatchState, now: number): MatchState {
  const w = setWinner(s.score.A, s.score.B, targetPoints(s.rules, s.currentSet), s.rules.minLead);
  return w ? endSet(s, w, now) : s;
}

const isInt = (n: number) => Number.isInteger(n) && n >= 0 && n <= 999;

/**
 * Aplica uma ação. Ações inválidas para o estado atual retornam o MESMO objeto,
 * o que permite ao store saber que nada mudou (e não empilhar no desfazer).
 */
export function reduceMatch(s: MatchState, action: MatchAction, now: number): MatchState {
  switch (action.type) {
    case 'start': {
      if (s.status !== 'not_started') return s;
      const next = { ...s, status: 'in_progress' as const, clock: startClock(s.clock, now), setStartedAtMs: 0 };
      return log(next, now, 'start', { team: s.serving });
    }

    case 'point': {
      if (s.status !== 'in_progress') return s;
      const t = action.team;
      let next: MatchState = { ...s, activeTimeout: null, score: { ...s.score, [t]: s.score[t] + 1 } };
      next = log(next, now, 'point', { team: t });
      if (s.serving !== t) {
        next = log({ ...next, serving: t }, now, 'serve_change', { team: t });
      }
      return checkSetEnd(next, now);
    }

    case 'removePoint': {
      if (s.status !== 'in_progress' && s.status !== 'paused') return s;
      const t = action.team;
      if (s.score[t] <= 0) return s;
      const next = { ...s, score: { ...s.score, [t]: s.score[t] - 1 } };
      return log(next, now, 'point_removed', { team: t });
    }

    case 'setServing': {
      if (s.status === 'finished' || s.serving === action.team) return s;
      const atSetStart = s.score.A === 0 && s.score.B === 0;
      const next: MatchState = {
        ...s,
        serving: action.team,
        setFirstServer: atSetStart ? action.team : s.setFirstServer,
      };
      return log(next, now, 'serve_manual', { team: action.team });
    }

    case 'correctScore': {
      if (s.status !== 'in_progress' && s.status !== 'paused') return s;
      const { a, b } = action;
      if (!isInt(a) || !isInt(b)) return s;
      if (a === s.score.A && b === s.score.B) return s;
      const detail = `${s.score.A}-${s.score.B} → ${a}-${b}`;
      const next = log({ ...s, score: { A: a, B: b } }, now, 'score_corrected', { detail });
      return checkSetEnd(next, now);
    }

    case 'timeout': {
      const t = action.team;
      if (s.status !== 'in_progress' || s.activeTimeout) return s;
      if (s.timeoutsUsed[t] >= s.rules.timeoutsPerSet) return s;
      const next: MatchState = {
        ...s,
        timeoutsUsed: { ...s.timeoutsUsed, [t]: s.timeoutsUsed[t] + 1 },
        activeTimeout: { team: t, endsAt: now + s.rules.timeoutDurationSec * 1000 },
      };
      return log(next, now, 'timeout', { team: t });
    }

    case 'endTimeout': {
      if (!s.activeTimeout) return s;
      return log({ ...s, activeTimeout: null }, now, 'timeout_end', { team: s.activeTimeout.team });
    }

    case 'pause': {
      if (s.status !== 'in_progress') return s;
      return log({ ...s, status: 'paused', clock: stopClock(s.clock, now) }, now, 'pause');
    }

    case 'resume': {
      if (s.status !== 'paused') return s;
      return log({ ...s, status: 'in_progress', clock: startClock(s.clock, now) }, now, 'resume');
    }

    case 'nextSet': {
      if (s.status === 'interval') return beginSet(s, now);
      if (s.status !== 'in_progress' && s.status !== 'paused') return s;
      if (s.score.A === s.score.B) return s;
      const leader: TeamId = s.score.A > s.score.B ? 'A' : 'B';
      return endSet({ ...s, clock: startClock(s.clock, now) }, leader, now, true);
    }

    case 'finish': {
      if (s.status === 'not_started' || s.status === 'finished') return s;
      const winner: TeamId | null =
        s.setsWon.A === s.setsWon.B ? null : s.setsWon.A > s.setsWon.B ? 'A' : 'B';
      const next: MatchState = {
        ...s,
        status: 'finished',
        winner,
        finishedAt: now,
        activeTimeout: null,
        intervalEndsAt: null,
        clock: stopClock(s.clock, now),
      };
      return log(next, now, 'match_end', { team: winner ?? undefined, detail: 'manual' });
    }

    case 'note': {
      const text = action.text.trim();
      if (!text) return s;
      return {
        ...s,
        notes: [...s.notes, { at: now, matchTimeMs: elapsed(s.clock, now), set: s.currentSet, text }],
      };
    }
  }
}

/** Ações que não entram na pilha de desfazer. */
export const isUndoable = (action: MatchAction): boolean => action.type !== 'note';

/* ------------------------------------------------------------------ */
/* Desfazer                                                            */
/* ------------------------------------------------------------------ */

/**
 * Snapshot compacto para a pilha de desfazer. Times/logos, informações e notas
 * não mudam com o desfazer, e o log de eventos é só de acréscimo — basta
 * guardar quantos eventos existiam. Isso mantém a pilha pequena no localStorage.
 */
export type Snapshot = Omit<MatchState, 'events' | 'teams' | 'info' | 'notes'> & { eventCount: number };

export function takeSnapshot(s: MatchState): Snapshot {
  const { events, teams: _t, info: _i, notes: _n, ...rest } = s;
  return { ...rest, eventCount: events.length };
}

/**
 * Restaura o estado anterior completo (placar, set, sets vencidos, saque,
 * tempos, histórico). O cronômetro volta ao estado rodando/parado anterior,
 * mas preserva o tempo real decorrido — exceto ao desfazer o início da partida.
 */
export function restoreSnapshot(snap: Snapshot, current: MatchState, now: number): MatchState {
  const { eventCount, ...rest } = snap;
  const realElapsed = elapsed(current.clock, now);
  const clock =
    snap.status === 'not_started'
      ? snap.clock
      : snap.clock.runningSince !== null
        ? { elapsedMs: realElapsed, runningSince: now }
        : stoppedClock(realElapsed);

  return {
    ...rest,
    teams: current.teams,
    info: current.info,
    notes: current.notes,
    events: current.events.slice(0, eventCount),
    clock,
  };
}
