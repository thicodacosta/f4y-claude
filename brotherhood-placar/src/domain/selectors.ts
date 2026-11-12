import { elapsed } from './clock';
import { isDecidingSet, other, setsToWin, targetPoints } from './rules';
import type { MatchState, MatchStatus, TeamId } from './types';

export const STATUS_LABEL: Record<MatchStatus, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  paused: 'Pausada',
  interval: 'Intervalo',
  finished: 'Finalizada',
};

export const matchTimeMs = (s: MatchState, now: number) => elapsed(s.clock, now);

export const canScore = (s: MatchState) => s.status === 'in_progress';

export const timeoutsLeft = (s: MatchState, t: TeamId) =>
  Math.max(0, s.rules.timeoutsPerSet - s.timeoutsUsed[t]);

export const canCallTimeout = (s: MatchState, t: TeamId) =>
  s.status === 'in_progress' && !s.activeTimeout && timeoutsLeft(s, t) > 0;

export const currentTarget = (s: MatchState) => targetPoints(s.rules, s.currentSet);

export const isTieBreak = (s: MatchState) => isDecidingSet(s.rules, s.currentSet);

/** Equipe que fecha o set com o próximo ponto (set point), se houver. */
export function setPointFor(s: MatchState): TeamId | null {
  if (s.status !== 'in_progress' && s.status !== 'paused') return null;
  const target = currentTarget(s);
  for (const t of ['A', 'B'] as const) {
    const mine = s.score[t] + 1;
    if (mine >= target && mine - s.score[other(t)] >= s.rules.minLead) return t;
  }
  return null;
}

export type PointKind = 'set' | 'match' | null;

export function pointKind(s: MatchState): { team: TeamId; kind: Exclude<PointKind, null> } | null {
  const t = setPointFor(s);
  if (!t) return null;
  return { team: t, kind: s.setsWon[t] + 1 >= setsToWin(s.rules) ? 'match' : 'set' };
}

/** No tie-break, as equipes trocam de lado quando a primeira chega à metade do alvo. */
export function sideSwitchDue(s: MatchState): boolean {
  if (!isTieBreak(s) || s.status !== 'in_progress') return false;
  const half = Math.ceil(s.rules.tieBreakPoints / 2);
  const hi = Math.max(s.score.A, s.score.B);
  const lo = Math.min(s.score.A, s.score.B);
  return hi === half && lo < half;
}

export const lastSet = (s: MatchState) => s.sets[s.sets.length - 1] ?? null;

export const matchLabel = (s: MatchState) => `${s.teams.A.name} × ${s.teams.B.name}`;

export function totalPoints(s: MatchState): Record<TeamId, number> {
  const sum = { A: 0, B: 0 };
  for (const set of s.sets) {
    sum.A += set.scoreA;
    sum.B += set.scoreB;
  }
  // pontos do set em andamento (ou interrompido) que ainda não viraram SetResult
  if (s.currentSet > (s.sets.at(-1)?.number ?? 0)) {
    sum.A += s.score.A;
    sum.B += s.score.B;
  }
  return sum;
}
