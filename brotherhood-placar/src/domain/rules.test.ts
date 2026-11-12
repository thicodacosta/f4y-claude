import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DEFAULT_TEAMS } from './defaults';
import { createMatch, reduceMatch, restartMatch, setWinner, targetPoints } from './rules';
import { pointKind, sideSwitchDue, timeoutsLeft, totalPoints } from './selectors';
import type { MatchAction, MatchRules, MatchState, TeamId } from './types';

const T0 = 1_700_000_000_000;

function make(rules: Partial<MatchRules> = {}, firstServer: TeamId = 'A') {
  return createMatch(
    {
      teams: DEFAULT_TEAMS,
      info: { tournament: 'Copa', venue: 'Ginásio', date: '2026-11-12' },
      rules: { ...DEFAULT_RULES, intervalDurationSec: 0, ...rules },
      firstServer,
    },
    T0,
    'test',
  );
}

function run(s: MatchState, actions: MatchAction[], t = T0) {
  return actions.reduce((acc, a, i) => reduceMatch(acc, a, t + (i + 1) * 1000), s);
}

const points = (team: TeamId, n: number): MatchAction[] => Array.from({ length: n }, () => ({ type: 'point', team }));

function started(rules: Partial<MatchRules> = {}, firstServer: TeamId = 'A') {
  return reduceMatch(make(rules, firstServer), { type: 'start' }, T0);
}

/** Vence um set de 25 x 0 para `team`. */
const winSet = (team: TeamId, target = 25) => points(team, target);

describe('regras puras', () => {
  it('setWinner exige alvo e diferença mínima', () => {
    expect(setWinner(25, 23, 25, 2)).toBe('A');
    expect(setWinner(25, 24, 25, 2)).toBeNull();
    expect(setWinner(26, 24, 25, 2)).toBe('A');
    expect(setWinner(24, 26, 25, 2)).toBe('B');
    expect(setWinner(15, 13, 15, 2)).toBe('A');
  });

  it('o set decisivo usa a pontuação do tie-break', () => {
    expect(targetPoints(DEFAULT_RULES, 4)).toBe(25);
    expect(targetPoints(DEFAULT_RULES, 5)).toBe(15);
    expect(targetPoints({ ...DEFAULT_RULES, bestOf: 3 }, 3)).toBe(15);
  });
});

describe('adição de pontos', () => {
  it('não pontua antes de iniciar a partida', () => {
    const s = make();
    expect(reduceMatch(s, { type: 'point', team: 'A' }, T0)).toBe(s);
  });

  it('soma ponto à equipe e registra evento', () => {
    const s = run(started(), [{ type: 'point', team: 'B' }]);
    expect(s.score).toEqual({ A: 0, B: 1 });
    expect(s.events.some((e) => e.type === 'point' && e.team === 'B')).toBe(true);
  });

  it('não pontua com a partida pausada', () => {
    const s = run(started(), [{ type: 'pause' }]);
    expect(reduceMatch(s, { type: 'point', team: 'A' }, T0 + 5000)).toBe(s);
  });
});

describe('remoção de pontos', () => {
  it('remove ponto sem alterar o saque', () => {
    const s = run(started(), [{ type: 'point', team: 'B' }, { type: 'removePoint', team: 'B' }]);
    expect(s.score).toEqual({ A: 0, B: 0 });
    expect(s.serving).toBe('B');
  });

  it('nunca deixa pontuação negativa', () => {
    const s = started();
    expect(reduceMatch(s, { type: 'removePoint', team: 'A' }, T0)).toBe(s);
    expect(reduceMatch(s, { type: 'correctScore', a: -1, b: 3 }, T0)).toBe(s);
    expect(reduceMatch(s, { type: 'correctScore', a: 1.5, b: 3 }, T0)).toBe(s);
  });
});

describe('saque', () => {
  it('quem saca e vence o rally mantém o saque', () => {
    const s = run(started({}, 'A'), [{ type: 'point', team: 'A' }]);
    expect(s.serving).toBe('A');
    expect(s.events.some((e) => e.type === 'serve_change')).toBe(false);
  });

  it('quem recebe e vence o rally ganha o saque (side-out)', () => {
    const s = run(started({}, 'A'), [{ type: 'point', team: 'B' }]);
    expect(s.serving).toBe('B');
    expect(s.events.filter((e) => e.type === 'serve_change')).toHaveLength(1);
  });

  it('permite correção manual da equipe sacadora', () => {
    const s = run(started({}, 'A'), [{ type: 'setServing', team: 'B' }]);
    expect(s.serving).toBe('B');
    expect(s.setFirstServer).toBe('B'); // ainda 0 x 0: corrige quem abre o set
  });

  it('o saque inicial do set seguinte alterna', () => {
    const s = run(started({}, 'A'), winSet('A'));
    expect(s.currentSet).toBe(2);
    expect(s.serving).toBe('B');
    const s3 = run(s, winSet('B'));
    expect(s3.serving).toBe('A');
  });
});

describe('encerramento de sets', () => {
  it('fecha o set em 25 com dois de vantagem e inicia o próximo', () => {
    const s = run(started(), [...points('A', 24), ...points('B', 23), { type: 'point', team: 'A' }]);
    expect(s.sets).toHaveLength(1);
    expect(s.sets[0]).toMatchObject({ number: 1, scoreA: 25, scoreB: 23, winner: 'A' });
    expect(s.setsWon).toEqual({ A: 1, B: 0 });
    expect(s.currentSet).toBe(2);
    expect(s.score).toEqual({ A: 0, B: 0 });
    expect(s.status).toBe('in_progress');
  });

  it('exige diferença mínima de dois pontos (24 x 24 → 26 x 24)', () => {
    let s = run(started(), [...points('A', 24), ...points('B', 24)]);
    s = run(s, [{ type: 'point', team: 'A' }]);
    expect(s.sets).toHaveLength(0);
    expect(s.score).toEqual({ A: 25, B: 24 });
    s = run(s, [{ type: 'point', team: 'B' }, { type: 'point', team: 'B' }]);
    expect(s.score).toEqual({ A: 25, B: 26 });
    expect(s.sets).toHaveLength(0);
    s = run(s, [{ type: 'point', team: 'B' }]);
    expect(s.sets[0]).toMatchObject({ scoreA: 25, scoreB: 27, winner: 'B' });
  });

  it('respeita diferença mínima configurável', () => {
    const s = run(started({ minLead: 1 }), [...points('A', 24), ...points('B', 24), { type: 'point', team: 'A' }]);
    expect(s.sets[0]).toMatchObject({ scoreA: 25, scoreB: 24 });
  });

  it('reinicia os tempos técnicos a cada set', () => {
    let s = run(started(), [{ type: 'timeout', team: 'A' }, { type: 'endTimeout' }]);
    expect(timeoutsLeft(s, 'A')).toBe(1);
    s = run(s, winSet('A'));
    expect(timeoutsLeft(s, 'A')).toBe(2);
  });

  it('entra em intervalo quando configurado e retoma com nextSet', () => {
    let s = run(started({ intervalDurationSec: 180 }), winSet('A'));
    expect(s.status).toBe('interval');
    expect(s.intervalEndsAt).not.toBeNull();
    expect(reduceMatch(s, { type: 'point', team: 'A' }, T0 + 99_000)).toBe(s);
    s = reduceMatch(s, { type: 'nextSet' }, T0 + 200_000);
    expect(s.status).toBe('in_progress');
    expect(s.currentSet).toBe(2);
  });

  it('avança o set manualmente dando a vitória a quem lidera, mas não em empate', () => {
    let s = run(started(), [...points('A', 10), ...points('B', 10)]);
    expect(reduceMatch(s, { type: 'nextSet' }, T0)).toBe(s);
    s = run(s, [{ type: 'point', team: 'B' }, { type: 'nextSet' }]);
    expect(s.sets[0]).toMatchObject({ scoreA: 10, scoreB: 11, winner: 'B', forced: true });
    expect(s.currentSet).toBe(2);
  });

  it('set point e match point', () => {
    let s = run(started({ bestOf: 3 }), points('A', 24));
    expect(pointKind(s)).toEqual({ team: 'A', kind: 'set' });
    s = run(s, [{ type: 'point', team: 'A' }, ...points('A', 24)]);
    expect(pointKind(s)).toEqual({ team: 'A', kind: 'match' });
  });

  it('indica troca de lado no tie-break', () => {
    const s = run(started({ bestOf: 3 }), [...winSet('A'), ...winSet('B'), ...points('A', 8)]);
    expect(s.currentSet).toBe(3);
    expect(sideSwitchDue(s)).toBe(true);
  });
});

describe('encerramento da partida', () => {
  it('termina quando uma equipe vence 3 sets (melhor de 5)', () => {
    const s = run(started(), [...winSet('A'), ...winSet('B'), ...winSet('A'), ...winSet('B'), ...winSet('A', 15)]);
    expect(s.status).toBe('finished');
    expect(s.winner).toBe('A');
    expect(s.setsWon).toEqual({ A: 3, B: 2 });
    expect(s.sets.map((x) => [x.scoreA, x.scoreB])).toEqual([[25, 0], [0, 25], [25, 0], [0, 25], [15, 0]]);
    expect(s.clock.runningSince).toBeNull();
    expect(s.events.at(-1)?.type).toBe('match_end');
  });

  it('termina com 2 sets no melhor de 3', () => {
    const s = run(started({ bestOf: 3 }), [...winSet('B'), ...winSet('B')]);
    expect(s.status).toBe('finished');
    expect(s.winner).toBe('B');
  });

  it('não aceita alterações depois de finalizada', () => {
    const s = run(started({ bestOf: 3 }), [...winSet('B'), ...winSet('B')]);
    const blocked: MatchAction[] = [
      { type: 'point', team: 'A' },
      { type: 'removePoint', team: 'B' },
      { type: 'correctScore', a: 3, b: 3 },
      { type: 'setServing', team: 'A' },
      { type: 'timeout', team: 'A' },
      { type: 'pause' },
      { type: 'nextSet' },
      { type: 'finish' },
    ];
    for (const a of blocked) expect(reduceMatch(s, a, T0 + 1e6)).toBe(s);
  });

  it('encerramento manual define vencedor pelos sets', () => {
    const s = run(started(), [...winSet('A'), ...points('B', 7), { type: 'finish' }]);
    expect(s.status).toBe('finished');
    expect(s.winner).toBe('A');
    expect(totalPoints(s)).toEqual({ A: 25, B: 7 });
  });
});

describe('tempos técnicos', () => {
  it('limita a quantidade por set e não sobrepõe tempos', () => {
    let s = run(started(), [{ type: 'timeout', team: 'A' }]);
    expect(s.activeTimeout?.team).toBe('A');
    expect(s.activeTimeout?.endsAt).toBe(T0 + 1000 + 30_000);
    expect(reduceMatch(s, { type: 'timeout', team: 'B' }, T0)).toBe(s);
    s = run(s, [{ type: 'endTimeout' }, { type: 'timeout', team: 'A' }, { type: 'endTimeout' }]);
    expect(timeoutsLeft(s, 'A')).toBe(0);
    expect(reduceMatch(s, { type: 'timeout', team: 'A' }, T0)).toBe(s);
  });

  it('um ponto encerra o tempo técnico ativo', () => {
    const s = run(started(), [{ type: 'timeout', team: 'B' }, { type: 'point', team: 'A' }]);
    expect(s.activeTimeout).toBeNull();
  });
});

describe('cronômetro', () => {
  it('pausa e retoma sem contar o tempo parado', () => {
    let s = started();
    s = reduceMatch(s, { type: 'pause' }, T0 + 10_000);
    expect(s.clock).toEqual({ elapsedMs: 10_000, runningSince: null });
    s = reduceMatch(s, { type: 'resume' }, T0 + 60_000);
    expect(s.clock).toEqual({ elapsedMs: 10_000, runningSince: T0 + 60_000 });
  });
});

describe('reinício', () => {
  it('cria partida zerada com os mesmos times e o mesmo saque inicial', () => {
    const s = run(started({}, 'B'), [...winSet('A'), ...points('B', 5)]);
    const r = restartMatch(s, T0 + 1e6);
    expect(r.id).not.toBe(s.id);
    expect(r.status).toBe('not_started');
    expect(r.score).toEqual({ A: 0, B: 0 });
    expect(r.setsWon).toEqual({ A: 0, B: 0 });
    expect(r.sets).toEqual([]);
    expect(r.serving).toBe('B');
    expect(r.teams).toEqual(s.teams);
    expect(r.rules).toEqual(s.rules);
  });
});

describe('observações', () => {
  it('registra nota sem texto vazio', () => {
    const s = started();
    expect(reduceMatch(s, { type: 'note', text: '   ' }, T0)).toBe(s);
    expect(reduceMatch(s, { type: 'note', text: ' Lesão leve ' }, T0).notes[0].text).toBe('Lesão leve');
  });
});
