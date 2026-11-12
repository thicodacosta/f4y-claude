/**
 * Modelo de domínio do placar. Nada aqui depende de React, DOM ou storage:
 * é a camada que um backend, um app nativo ou um service worker poderiam reutilizar.
 */

export type TeamId = 'A' | 'B';

export interface Team {
  name: string;
  /** Cor predominante em hex (#rrggbb). */
  color: string;
  /** URL ou data URL do escudo/logotipo. Opcional. */
  logo?: string;
}

export interface MatchRules {
  bestOf: 3 | 5;
  /** Pontos para vencer os sets regulares. */
  setPoints: number;
  /** Pontos para vencer o set decisivo (tie-break). */
  tieBreakPoints: number;
  /** Diferença mínima para fechar um set. */
  minLead: number;
  timeoutsPerSet: number;
  timeoutDurationSec: number;
  /** Intervalo entre sets. 0 = inicia o próximo set imediatamente. */
  intervalDurationSec: number;
}

export interface MatchInfo {
  tournament: string;
  venue: string;
  /** Data no formato AAAA-MM-DD. */
  date: string;
}

export type MatchStatus = 'not_started' | 'in_progress' | 'paused' | 'interval' | 'finished';

export interface Clock {
  /** Tempo acumulado até o último start/pause. */
  elapsedMs: number;
  /** Epoch ms desde quando está rodando; null = parado. */
  runningSince: number | null;
}

export interface SetResult {
  number: number;
  scoreA: number;
  scoreB: number;
  winner: TeamId;
  durationMs: number;
  /** true quando o set foi encerrado manualmente (avançar set). */
  forced?: boolean;
}

export type MatchEventType =
  | 'start'
  | 'point'
  | 'point_removed'
  | 'serve_change'
  | 'serve_manual'
  | 'score_corrected'
  | 'timeout'
  | 'timeout_end'
  | 'pause'
  | 'resume'
  | 'set_end'
  | 'set_start'
  | 'match_end';

export interface MatchEvent {
  type: MatchEventType;
  /** Epoch ms. */
  at: number;
  /** Tempo de partida (cronômetro) no momento do evento. */
  matchTimeMs: number;
  set: number;
  scoreA: number;
  scoreB: number;
  team?: TeamId;
  detail?: string;
}

export interface Note {
  at: number;
  matchTimeMs: number;
  set: number;
  text: string;
}

export interface MatchState {
  id: string;
  createdAt: number;
  info: MatchInfo;
  teams: Record<TeamId, Team>;
  rules: MatchRules;

  status: MatchStatus;
  currentSet: number;
  score: Record<TeamId, number>;
  setsWon: Record<TeamId, number>;
  sets: SetResult[];

  serving: TeamId;
  /** Quem sacou primeiro no set atual (define o saque do próximo set). */
  setFirstServer: TeamId;

  timeoutsUsed: Record<TeamId, number>;
  activeTimeout: { team: TeamId; endsAt: number } | null;
  intervalEndsAt: number | null;

  clock: Clock;
  /** Tempo de partida em que o set atual começou. */
  setStartedAtMs: number;

  /** Log cronológico. Só recebe acréscimos — o desfazer trunca. */
  events: MatchEvent[];
  /** Observações do operador. Nunca são desfeitas. */
  notes: Note[];

  winner: TeamId | null;
  finishedAt: number | null;
}

export type MatchAction =
  | { type: 'start' }
  | { type: 'point'; team: TeamId }
  | { type: 'removePoint'; team: TeamId }
  | { type: 'setServing'; team: TeamId }
  | { type: 'correctScore'; a: number; b: number }
  | { type: 'timeout'; team: TeamId }
  | { type: 'endTimeout' }
  | { type: 'pause' }
  | { type: 'resume' }
  /** No intervalo: começa o próximo set já. Em jogo: encerra o set atual dando-o a quem lidera. */
  | { type: 'nextSet' }
  | { type: 'finish' }
  | { type: 'note'; text: string };

export interface NewMatchInput {
  teams: Record<TeamId, Team>;
  info: MatchInfo;
  rules: MatchRules;
  firstServer: TeamId;
}
