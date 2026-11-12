import {
  ArrowLeftRight,
  CircleStop,
  ExternalLink,
  Flag,
  Keyboard,
  Maximize,
  Minimize,
  MoreHorizontal,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  SkipForward,
  SquarePen,
  Timer,
  Trophy,
  Tv,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useConfirm } from '../components/confirm';
import { CorrectScoreDialog, NotesDialog } from '../components/MatchDialogs';
import { TeamPanel } from '../components/TeamPanel';
import { BrandMark, Button, Confetti, Dialog, LinkButton, SetStrip, StatusPill, TeamLogo } from '../components/ui';
import { formatDuration, secondsLeft } from '../domain/clock';
import { other } from '../domain/rules';
import {
  canCallTimeout,
  canScore,
  isTieBreak,
  lastSet,
  matchTimeMs,
  pointKind,
  sideSwitchDue,
  timeoutsLeft,
} from '../domain/selectors';
import type { MatchState, TeamId } from '../domain/types';
import { openDisplayWindow, useFullscreen, useNow, useWakeLock } from '../lib/browser';
import { href, navigate } from '../lib/router';
import { store, useCanUndo, useMatch } from '../state/store';

export function ScoreboardScreen() {
  const match = useMatch();
  if (!match) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="flex flex-col items-center gap-5">
          <BrandMark size={64} />
          <p className="text-muted">Nenhuma partida configurada.</p>
          <LinkButton href={href.setup} variant="primary" size="lg">
            <Play size={20} /> Nova partida
          </LinkButton>
        </div>
      </div>
    );
  }
  return <Scoreboard match={match} />;
}

type DialogName = 'correct' | 'notes' | 'more' | 'keys' | null;

function Scoreboard({ match: m }: { match: MatchState }) {
  const now = useNow(250);
  const canUndo = useCanUndo();
  const confirm = useConfirm();
  const fs = useFullscreen();
  const [dialog, setDialog] = useState<DialogName>(null);
  const toast = useEventToast(m);

  useWakeLock(m.status !== 'finished');

  const colors = { A: m.teams.A.color, B: m.teams.B.color };
  const pk = pointKind(m);
  const live = m.status === 'in_progress' || m.status === 'paused';
  const leaderTied = m.score.A === m.score.B;

  /* --------------- ações --------------- */

  const undo = async () => {
    if (!store.canUndo()) return;
    if (m.status === 'finished') {
      const ok = await confirm({
        title: 'Reabrir partida finalizada?',
        message: 'Desfazer vai reabrir a partida e retirá-la do histórico até que ela seja encerrada novamente.',
        confirmLabel: 'Desfazer e reabrir',
      });
      if (!ok) return;
    }
    store.undo();
  };

  const nextSet = async () => {
    if (m.status === 'interval') return store.dispatch({ type: 'nextSet' });
    const leader: TeamId = m.score.A > m.score.B ? 'A' : 'B';
    const ok = await confirm({
      title: `Encerrar o set ${m.currentSet}?`,
      message: (
        <>
          O set será encerrado agora com o placar <b className="text-fg">{m.score.A}–{m.score.B}</b>, vencido por{' '}
          <b className="text-fg">{m.teams[leader].name}</b>, mesmo sem atingir a pontuação.
        </>
      ),
      confirmLabel: 'Encerrar set',
    });
    if (ok) store.dispatch({ type: 'nextSet' });
  };

  const finish = async () => {
    const ok = await confirm({
      title: 'Encerrar partida?',
      message: 'A partida será finalizada com os sets disputados até aqui e salva no histórico. Não será possível marcar novos pontos.',
      confirmLabel: 'Encerrar partida',
      tone: 'danger',
    });
    if (ok) store.dispatch({ type: 'finish' });
  };

  const restart = async () => {
    const ok = await confirm({
      title: 'Reiniciar partida?',
      message:
        m.status === 'finished'
          ? 'Uma nova partida será criada com os mesmos times e regras. O resultado atual já está salvo no histórico.'
          : 'Todo o placar será zerado e a partida atual será descartada. Os times e as regras serão mantidos.',
      confirmLabel: 'Reiniciar',
      tone: m.status === 'finished' ? 'primary' : 'danger',
    });
    if (ok) store.restart();
  };

  const swapServe = () => store.dispatch({ type: 'setServing', team: other(m.serving) });
  const togglePause = () => store.dispatch({ type: m.status === 'paused' ? 'resume' : 'pause' });

  /* --------------- teclado (operação por notebook ou clicker) --------------- */

  const handlers = useRef({ undo, togglePause });
  handlers.current = { undo, togglePause };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, dialog[open]') || e.altKey || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') store.dispatch({ type: 'point', team: 'A' });
      else if (k === 'arrowright' || k === 'l') store.dispatch({ type: 'point', team: 'B' });
      else if (k === 'z' || k === 'backspace') void handlers.current.undo();
      else if (k === 'p') handlers.current.togglePause();
      else if (k === 'f') void fs.toggle();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]);

  /* --------------- painéis --------------- */

  const panel = (t: TeamId) => (
    <TeamPanel
      side={t}
      team={m.teams[t]}
      score={m.score[t]}
      setsWon={m.setsWon[t]}
      serving={m.serving === t && m.status !== 'finished'}
      canScore={canScore(m)}
      canRemove={live && m.score[t] > 0}
      timeoutsTotal={m.rules.timeoutsPerSet}
      timeoutsLeft={timeoutsLeft(m, t)}
      canTimeout={canCallTimeout(m, t)}
      badge={pk?.team === t ? (pk.kind === 'match' ? 'Match point' : 'Set point') : null}
      onPoint={() => store.dispatch({ type: 'point', team: t })}
      onRemove={() => store.dispatch({ type: 'removePoint', team: t })}
      onTimeout={() => store.dispatch({ type: 'timeout', team: t })}
    />
  );

  return (
    <div className="flex h-dvh flex-col gap-2 p-2 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] sm:gap-3 sm:p-3 short:gap-1.5 short:p-1.5">
      {/* Barra superior */}
      <header className="flex items-center gap-2 px-1 short:hidden">
        <a href={href.home} aria-label="Início" className="shrink-0">
          <BrandMark size={36} withName={false} />
        </a>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold tracking-wide uppercase sm:text-lg">
            {m.info.tournament || 'Partida amistosa'}
          </p>
          {m.info.venue && <p className="truncate text-xs text-muted">{m.info.venue}</p>}
        </div>
        <StatusPill status={m.status} className="max-sm:hidden" />
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-panel-2 px-3 py-1.5 font-display text-lg font-bold tabular-nums ring-1 ring-line" aria-label="Tempo de partida">
          <Timer size={16} className="text-muted" />
          {formatDuration(matchTimeMs(m, now))}
        </span>
        <Button size="sm" onClick={() => navigate(href.display)} className="max-md:hidden" title="Modo Telão">
          <Tv size={16} /> Telão
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDialog('more')} aria-label="Mais opções">
          <MoreHorizontal size={20} />
        </Button>
      </header>

      {/* Placar */}
      <div className="relative flex min-h-0 flex-1 gap-2 portrait:flex-col sm:gap-3 short:gap-1.5">
        {panel('A')}

        {/* Faixa central */}
        <div className="flex shrink-0 items-center justify-center gap-3 portrait:flex-row landscape:w-[min(22vw,15rem)] landscape:flex-col short:w-[min(18vw,9rem)] short:gap-1.5">
          <span className="hidden items-center gap-1 font-display text-lg font-bold tabular-nums short:flex" aria-label="Tempo de partida">
            <Timer size={14} className="text-muted" />
            {formatDuration(matchTimeMs(m, now))}
          </span>
          <div className="text-center">
            <p className="eyebrow">{isTieBreak(m) ? 'Tie-break' : 'Set'}</p>
            <p className="font-display text-3xl leading-none font-extrabold text-gold landscape:text-5xl short:text-3xl">{m.currentSet}</p>
          </div>
          <div className="flex items-center gap-2 font-display font-extrabold tabular-nums landscape:text-5xl portrait:text-3xl short:text-3xl" aria-label={`Sets: ${m.setsWon.A} a ${m.setsWon.B}`}>
            <span style={{ color: colors.A }}>{m.setsWon.A}</span>
            <span className="text-dim">:</span>
            <span style={{ color: colors.B }}>{m.setsWon.B}</span>
          </div>
          <div className="portrait:hidden short:hidden">
            <SetStrip sets={m.sets} colors={colors} />
          </div>
          <StatusPill status={m.status} className="sm:hidden short:hidden" />
          {sideSwitchDue(m) && (
            <span className="rounded-lg bg-sky-400/15 px-2 py-1 text-center font-display text-xs font-bold tracking-widest text-sky-300 uppercase">
              Troca de lado
            </span>
          )}
          {m.status === 'not_started' && (
            <Button variant="primary" size="lg" onClick={() => store.dispatch({ type: 'start' })} className="landscape:w-full short:h-11 short:px-3">
              <Play size={20} /> Iniciar
            </Button>
          )}
        </div>

        {panel('B')}

        {/* Sobreposições de estado */}
        <StateOverlay m={m} now={now} onUndo={undo} onRestart={restart} />
      </div>

      {/* Barra de controle */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-[env(safe-area-inset-bottom)]" aria-label="Controles da partida">
        <Button onClick={undo} disabled={!canUndo} size="lg" className="flex-1 sm:flex-none short:h-11" title="Desfazer (Z)">
          <Undo2 size={20} /> Desfazer
        </Button>
        {(live || m.status === 'not_started') && (
          <Button onClick={togglePause} disabled={!live} size="lg" className="flex-1 sm:flex-none short:h-11" title="Pausar/retomar (P)">
            {m.status === 'paused' ? <Play size={20} /> : <Pause size={20} />}
            {m.status === 'paused' ? 'Retomar' : 'Pausar'}
          </Button>
        )}
        <Button onClick={swapServe} disabled={m.status === 'finished'} size="lg" className="max-sm:hidden short:h-11" title="Alterar equipe sacadora">
          <ArrowLeftRight size={20} /> Saque
        </Button>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Button size="lg" variant="ghost" onClick={() => setDialog('correct')} disabled={!live}>
            <SquarePen size={18} /> Corrigir
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setDialog('notes')}>
            <NotebookPen size={18} /> Observação
          </Button>
          <Button size="lg" variant="ghost" onClick={nextSet} disabled={!(m.status === 'interval' || (live && !leaderTied))}>
            <SkipForward size={18} /> Avançar set
          </Button>
          <Button size="lg" variant="ghost" onClick={finish} disabled={m.status === 'not_started' || m.status === 'finished'}>
            <Flag size={18} /> Encerrar
          </Button>
        </div>
        <Button size="lg" variant="ghost" onClick={() => setDialog('more')} className="lg:hidden short:h-11" aria-label="Mais controles">
          <MoreHorizontal size={20} />
        </Button>
      </nav>

      {toast && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
          <div className="animate-fade-up rounded-2xl border border-gold/40 bg-panel px-5 py-3 font-display text-lg font-bold tracking-wide uppercase shadow-2xl">
            {toast}
          </div>
        </div>
      )}

      {/* Diálogos */}
      <CorrectScoreDialog
        open={dialog === 'correct'}
        match={m}
        onClose={() => setDialog(null)}
        onApply={(a, b) => {
          store.dispatch({ type: 'correctScore', a, b });
          setDialog(null);
        }}
      />
      <NotesDialog open={dialog === 'notes'} match={m} onClose={() => setDialog(null)} onAdd={(text) => store.dispatch({ type: 'note', text })} />
      <KeysDialog open={dialog === 'keys'} onClose={() => setDialog(null)} />
      <Dialog open={dialog === 'more'} onClose={() => setDialog(null)} title="Controles da partida">
        <div className="grid grid-cols-2 gap-2">
          <MenuItem icon={<ArrowLeftRight size={18} />} label="Alterar saque" disabled={m.status === 'finished'} onClick={() => (swapServe(), setDialog(null))} />
          <MenuItem icon={<SquarePen size={18} />} label="Corrigir placar" disabled={!live} onClick={() => setDialog('correct')} />
          <MenuItem icon={<NotebookPen size={18} />} label="Observação" onClick={() => setDialog('notes')} />
          <MenuItem
            icon={<SkipForward size={18} />}
            label={m.status === 'interval' ? 'Iniciar próximo set' : 'Avançar set'}
            disabled={!(m.status === 'interval' || (live && !leaderTied))}
            onClick={() => (setDialog(null), void nextSet())}
          />
          <MenuItem icon={<Flag size={18} />} label="Encerrar partida" disabled={m.status === 'not_started' || m.status === 'finished'} onClick={() => (setDialog(null), void finish())} />
          <MenuItem icon={<RotateCcw size={18} />} label="Reiniciar partida" onClick={() => (setDialog(null), void restart())} />
          <MenuItem icon={<Tv size={18} />} label="Modo Telão" onClick={() => navigate(href.display)} />
          <MenuItem
            icon={<ExternalLink size={18} />}
            label="Telão em outra janela"
            onClick={() => (openDisplayWindow(href.displayWindow), setDialog(null))}
          />
          {fs.supported && (
            <MenuItem icon={fs.isFull ? <Minimize size={18} /> : <Maximize size={18} />} label={fs.isFull ? 'Sair da tela cheia' : 'Tela cheia'} onClick={() => (void fs.toggle(), setDialog(null))} />
          )}
          <MenuItem icon={<ScrollText size={18} />} label="Histórico" onClick={() => navigate(href.history)} />
          <MenuItem icon={<Keyboard size={18} />} label="Atalhos de teclado" onClick={() => setDialog('keys')} />
          <MenuItem icon={<CircleStop size={18} />} label="Fechar placar" onClick={() => navigate(href.home)} />
        </div>
      </Dialog>
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 rounded-xl border border-line bg-panel-2 px-3 py-3 text-left text-sm font-semibold transition hover:border-line-strong hover:bg-panel-3 disabled:opacity-35"
    >
      <span className="text-gold">{icon}</span>
      {label}
    </button>
  );
}

function KeysDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: [string, string][] = [
    ['← ou A', 'Ponto para o Time A'],
    ['→ ou L', 'Ponto para o Time B'],
    ['Z ou ⌫', 'Desfazer última ação'],
    ['P', 'Pausar / retomar'],
    ['F', 'Tela cheia'],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Atalhos de teclado" footer={<Button onClick={onClose}>Fechar</Button>}>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-2.5">
            <dt>
              <kbd className="rounded-md border border-line-strong bg-panel-2 px-2 py-1 font-display font-bold">{k}</kbd>
            </dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

/** Tempo técnico, pausa, intervalo e fim de partida. */
function StateOverlay({ m, now, onUndo, onRestart }: { m: MatchState; now: number; onUndo: () => void; onRestart: () => void }) {
  if (m.activeTimeout) {
    const t = m.activeTimeout.team;
    const left = secondsLeft(m.activeTimeout.endsAt, now);
    return (
      <Banner>
        <TeamLogo team={m.teams[t]} size={40} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Tempo técnico</p>
          <p className="truncate font-display text-xl font-bold uppercase">{m.teams[t].name}</p>
        </div>
        <span className="score-digits text-5xl text-gold tabular-nums" aria-live="polite">
          {left}
        </span>
        <Button onClick={() => store.dispatch({ type: 'endTimeout' })}>Encerrar</Button>
      </Banner>
    );
  }

  if (m.status === 'paused') {
    return (
      <Banner>
        <Pause className="text-gold" />
        <p className="flex-1 font-display text-xl font-bold uppercase">Partida pausada</p>
        <Button variant="primary" onClick={() => store.dispatch({ type: 'resume' })}>
          <Play size={18} /> Retomar
        </Button>
      </Banner>
    );
  }

  if (m.status === 'interval') {
    const ls = lastSet(m);
    const left = m.intervalEndsAt ? secondsLeft(m.intervalEndsAt, now) : 0;
    return (
      <Center>
        <p className="eyebrow">Fim do set {ls?.number}</p>
        {ls && (
          <>
            <p className="mt-2 font-display text-3xl font-extrabold uppercase" style={{ color: m.teams[ls.winner].color }}>
              {m.teams[ls.winner].name}
            </p>
            <p className="score-digits mt-2 text-6xl">
              {ls.scoreA}
              <span className="mx-3 text-dim">–</span>
              {ls.scoreB}
            </p>
          </>
        )}
        <p className="mt-4 text-muted">
          Set {m.currentSet} {m.currentSet === m.rules.bestOf && '(tie-break) '}começa em{' '}
          <b className="font-display text-xl text-fg tabular-nums">{formatDuration(left * 1000)}</b>
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <span className="text-muted">Saque:</span>
          {(['A', 'B'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => store.dispatch({ type: 'setServing', team: t })}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${m.serving === t ? 'bg-gold text-ink' : 'bg-panel-3 text-muted hover:text-fg'}`}
              aria-pressed={m.serving === t}
            >
              {m.teams[t].name}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onUndo}>
            <Undo2 size={18} /> Desfazer último ponto
          </Button>
          <Button variant="primary" onClick={() => store.dispatch({ type: 'nextSet' })}>
            <Play size={18} /> Iniciar set agora
          </Button>
        </div>
      </Center>
    );
  }

  if (m.status === 'finished') {
    const w = m.winner;
    return (
      <>
        {w && <Confetti colors={[m.teams[w].color, '#E8B931', '#ffffff', '#C9CFDB']} />}
        <Center>
          <Trophy size={44} className="mx-auto text-gold" />
          <p className="eyebrow mt-3">Partida finalizada</p>
          {w ? (
            <p className="mt-1 font-display text-4xl font-extrabold uppercase" style={{ color: m.teams[w].color }}>
              {m.teams[w].name} vence!
            </p>
          ) : (
            <p className="mt-1 font-display text-3xl font-extrabold uppercase">Partida encerrada</p>
          )}
          <p className="score-digits mt-3 text-7xl">
            {m.setsWon.A}
            <span className="mx-3 text-dim">–</span>
            {m.setsWon.B}
          </p>
          <div className="mt-3">
            <SetStrip sets={m.sets} colors={{ A: m.teams.A.color, B: m.teams.B.color }} />
          </div>
          <p className="mt-3 text-sm text-muted">Duração {formatDuration(m.clock.elapsedMs)}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <LinkButton href={href.match(m.id)} variant="primary">
              <ScrollText size={18} /> Ver resumo e exportar
            </LinkButton>
            <Button onClick={onRestart}>
              <RotateCcw size={18} /> Revanche
            </Button>
            <LinkButton href={href.setup} variant="ghost">
              Nova partida
            </LinkButton>
          </div>
        </Center>
      </>
    );
  }

  return null;
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-1/2 z-20 mx-auto flex w-[min(36rem,calc(100%-1rem))] -translate-y-1/2 animate-fade-up items-center gap-3 rounded-2xl border border-gold/40 bg-panel/95 p-3 pl-4 shadow-2xl backdrop-blur">
      {children}
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-ink/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-fade-up rounded-3xl border border-line-strong bg-panel p-6 text-center shadow-2xl">{children}</div>
    </div>
  );
}

/** Mensagem curta ao fechar um set (quando não há intervalo para exibi-lo). */
function useEventToast(m: MatchState) {
  const [msg, setMsg] = useState<string | null>(null);
  const seen = useRef({ id: m.id, count: m.events.length });
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    const prev = seen.current;
    seen.current = { id: m.id, count: m.events.length };
    if (prev.id !== m.id || m.events.length <= prev.count) return;
    const fresh = m.events.slice(prev.count);
    const setEnd = fresh.find((e) => e.type === 'set_end');
    const corrected = fresh.find((e) => e.type === 'score_corrected');
    let text: string | null = null;
    if (setEnd && m.status === 'in_progress' && setEnd.team) {
      text = `Set ${setEnd.set} para ${m.teams[setEnd.team].name} · ${setEnd.scoreA}–${setEnd.scoreB}`;
    } else if (corrected) {
      text = `Placar corrigido: ${corrected.detail}`;
    }
    if (!text) return;
    setMsg(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2800);
  }, [m]);
  return msg;
}
