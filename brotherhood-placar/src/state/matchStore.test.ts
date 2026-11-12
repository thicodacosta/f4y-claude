import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DEFAULT_TEAMS } from '../domain/defaults';
import type { NewMatchInput, TeamId } from '../domain/types';
import { createRepository, KEYS, memoryKV } from '../storage/repository';
import { createMatchStore } from './matchStore';

function setup(rules = {}) {
  const kv = memoryKV();
  let t = 1_700_000_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const store = createMatchStore(createRepository(kv), clock.now);
  const input: NewMatchInput = {
    teams: DEFAULT_TEAMS,
    info: { tournament: 'Copa', venue: 'Quadra', date: '2026-11-12' },
    rules: { ...DEFAULT_RULES, intervalDurationSec: 0, ...rules },
    firstServer: 'A',
  };
  return { kv, clock, store, input };
}

const point = (store: ReturnType<typeof setup>['store'], team: TeamId, n = 1) => {
  for (let i = 0; i < n; i++) store.dispatch({ type: 'point', team });
};

describe('desfazer', () => {
  it('desfaz o último ponto e devolve o saque', () => {
    const { store, input } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'B');
    expect(store.getState().match!.serving).toBe('B');
    store.undo();
    const m = store.getState().match!;
    expect(m.score).toEqual({ A: 0, B: 0 });
    expect(m.serving).toBe('A');
    expect(m.events.filter((e) => e.type === 'point')).toHaveLength(0);
  });

  it('desfaz o ponto que encerrou o set: volta set, sets vencidos e placar', () => {
    const { store, input } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'A', 24);
    point(store, 'B', 22);
    point(store, 'A'); // 25 x 22 → set 2
    expect(store.getState().match!.currentSet).toBe(2);
    store.undo();
    const m = store.getState().match!;
    expect(m.currentSet).toBe(1);
    expect(m.score).toEqual({ A: 24, B: 22 });
    expect(m.setsWon).toEqual({ A: 0, B: 0 });
    expect(m.sets).toHaveLength(0);
    expect(m.serving).toBe('B');
  });

  it('desfaz o fim da partida e a remove do histórico', () => {
    const { store, input } = setup({ bestOf: 3 });
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'A', 50);
    expect(store.getState().match!.status).toBe('finished');
    expect(store.getState().history).toHaveLength(1);
    store.undo();
    expect(store.getState().match!.status).toBe('in_progress');
    expect(store.getState().match!.score).toEqual({ A: 24, B: 0 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('desfazer a pausa volta a rodar o cronômetro sem perder o tempo real', () => {
    const { store, input, clock } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    clock.advance(60_000);
    store.dispatch({ type: 'pause' });
    clock.advance(5_000);
    store.undo();
    const m = store.getState().match!;
    expect(m.status).toBe('in_progress');
    expect(m.clock.runningSince).toBe(clock.now());
    expect(m.clock.elapsedMs).toBe(60_000);
  });

  it('ações inválidas não entram na pilha', () => {
    const { store, input } = setup();
    store.newMatch(input);
    expect(store.dispatch({ type: 'point', team: 'A' })).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it('transições automáticas (sistema) não entram na pilha', () => {
    const { store, input } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    store.dispatch({ type: 'timeout', team: 'A' });
    store.dispatch({ type: 'endTimeout' }, { system: true });
    expect(store.getState().past).toHaveLength(2);
  });

  it('notas não são desfeitas', () => {
    const { store, input } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'A');
    store.dispatch({ type: 'note', text: 'Troca de bola' });
    store.undo();
    const m = store.getState().match!;
    expect(m.score.A).toBe(0);
    expect(m.notes).toHaveLength(1);
  });
});

describe('persistência', () => {
  it('cada ação é gravada imediatamente e sobrevive a um recarregamento', () => {
    const { kv, store, input, clock } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'B', 3);
    expect(kv.data.has(KEYS.current)).toBe(true);

    const reloaded = createMatchStore(createRepository(kv), clock.now);
    const m = reloaded.getState().match!;
    expect(m.score).toEqual({ A: 0, B: 3 });
    expect(m.serving).toBe('B');
    expect(reloaded.canUndo()).toBe(true);
    reloaded.undo();
    expect(reloaded.getState().match!.score.B).toBe(2);
  });

  it('a pilha de desfazer não guarda logos nem o log completo', () => {
    const { kv, store, input } = setup();
    store.newMatch({ ...input, teams: { ...input.teams, A: { ...input.teams.A, logo: 'data:image/png;base64,' + 'x'.repeat(50_000) } } });
    store.dispatch({ type: 'start' });
    point(store, 'A', 20);
    const raw = kv.data.get(KEYS.current)!;
    expect(raw.length).toBeLessThan(50_000 + 40_000);
  });

  it('salva configurações e últimos times usados', () => {
    const { kv, store, input, clock } = setup();
    store.newMatch({ ...input, teams: { ...input.teams, B: { name: 'Tubarões', color: '#E5484D' } } });
    store.updateSettings({ sounds: { point: false, setEnd: true } });
    const reloaded = createMatchStore(createRepository(kv), clock.now);
    expect(reloaded.getState().settings.lastTeams.B.name).toBe('Tubarões');
    expect(reloaded.getState().settings.sounds.point).toBe(false);
  });

  it('ignora dados corrompidos', () => {
    const kv = memoryKV();
    kv.setItem(KEYS.current, '{quebrado');
    kv.setItem(KEYS.history, '"não é lista"');
    const store = createMatchStore(createRepository(kv));
    expect(store.getState().match).toBeNull();
    expect(store.getState().history).toEqual([]);
  });

  it('reduz a pilha de desfazer quando a cota estoura, sem perder o placar', () => {
    const { kv, store, input } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'A', 10);
    const original = kv.setItem;
    kv.setItem = (k, v) => {
      if (v.length > 6_000) throw new Error('QuotaExceeded');
      original(k, v);
    };
    point(store, 'B');
    const saved = JSON.parse(kv.data.get(KEYS.current)!);
    expect(saved.match.score).toEqual({ A: 10, B: 1 });
    expect(saved.past.length).toBeLessThan(12);
  });
});

describe('reinício', () => {
  it('reinicia zerando placar e pilha, mantendo times', () => {
    const { store, input } = setup();
    store.newMatch(input);
    store.dispatch({ type: 'start' });
    point(store, 'A', 5);
    const before = store.getState().match!;
    store.restart();
    const m = store.getState().match!;
    expect(m.id).not.toBe(before.id);
    expect(m.status).toBe('not_started');
    expect(m.score).toEqual({ A: 0, B: 0 });
    expect(store.canUndo()).toBe(false);
    expect(m.teams.A.name).toBe(before.teams.A.name);
  });
});
