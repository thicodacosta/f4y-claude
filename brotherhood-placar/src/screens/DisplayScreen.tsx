import { Maximize, Minimize, Trophy, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Confetti, ServeBall, SetStrip, TeamLogo, TimeoutDots } from '../components/ui';
import { formatDuration, secondsLeft } from '../domain/clock';
import { STATUS_LABEL, isTieBreak, lastSet, matchTimeMs, pointKind, timeoutsLeft } from '../domain/selectors';
import type { MatchState, TeamId } from '../domain/types';
import { useFullscreen, useNow, useWakeLock } from '../lib/browser';
import { href, navigate } from '../lib/router';
import { useMatch } from '../state/store';

/**
 * Modo Telão: só o essencial, em escala de ginásio. Tudo é dimensionado em
 * vw/vh para ocupar qualquer TV, projetor ou monitor por inteiro.
 */
export function DisplayScreen({ popup }: { popup: boolean }) {
  const match = useMatch();
  const now = useNow(250);
  const fs = useFullscreen();
  const [chrome, setChrome] = useState(true);

  useWakeLock(true);

  // Controles aparecem ao mexer o mouse/tocar e somem sozinhos.
  useEffect(() => {
    let id = window.setTimeout(() => setChrome(false), 2500);
    const show = () => {
      setChrome(true);
      window.clearTimeout(id);
      id = window.setTimeout(() => setChrome(false), 2500);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') void fs.toggle();
      else if (e.key === 'Escape' && !document.fullscreenElement && !popup) navigate(href.scoreboard);
      else show();
    };
    window.addEventListener('pointermove', show);
    window.addEventListener('pointerdown', show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointermove', show);
      window.removeEventListener('pointerdown', show);
      window.removeEventListener('keydown', onKey);
    };
  }, [fs, popup]);

  return (
    <div className={`fixed inset-0 overflow-hidden bg-ink select-none ${chrome ? '' : 'cursor-none'}`}>
      {match ? (
        <Board m={match} now={now} />
      ) : (
        <div className="grid h-full place-items-center text-center">
          <div>
            <img src="/brand/logo.jpg" alt="Brotherhood 50+" className="mx-auto w-[min(40vw,50vh)]" />
            <p className="mt-[3vh] font-display text-[3vw] font-bold tracking-widest text-muted uppercase">Aguardando partida</p>
          </div>
        </div>
      )}

      <div
        className={`absolute top-4 right-4 z-50 flex gap-2 transition-opacity duration-300 ${chrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        {fs.supported && (
          <button
            type="button"
            onClick={() => void fs.toggle()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-panel/90 px-4 font-semibold backdrop-blur hover:bg-panel-3"
          >
            {fs.isFull ? <Minimize size={18} /> : <Maximize size={18} />}
            {fs.isFull ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
        )}
        <button
          type="button"
          onClick={() => (popup ? window.close() : navigate(href.scoreboard))}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-panel/90 px-4 font-semibold backdrop-blur hover:bg-panel-3"
        >
          <X size={18} /> {popup ? 'Fechar telão' : 'Sair do telão'}
        </button>
      </div>
    </div>
  );
}

function Board({ m, now }: { m: MatchState; now: number }) {
  const colors = { A: m.teams.A.color, B: m.teams.B.color };
  const pk = pointKind(m);

  return (
    <div className="flex h-full flex-col">
      {/* Faixa superior */}
      <header className="flex items-center justify-between gap-[2vw] border-b border-line bg-panel/70 px-[2.5vw] py-[1.6vh]">
        <div className="flex min-w-0 flex-1 items-center gap-[1vw]">
          <img src="/brand/logo.jpg" alt="" className="h-[min(7vh,5vw)] w-[min(7vh,5vw)] rounded-full" />
          <span className="truncate font-display text-[min(2.4vw,4vh)] font-bold tracking-wide uppercase">
            {m.info.tournament || 'Brotherhood Placar'}
          </span>
        </div>
        <div className="text-center font-display leading-none">
          <span className="block text-[min(1.3vw,2.2vh)] font-semibold tracking-[0.3em] text-muted uppercase">
            {m.status === 'finished' ? 'Final' : isTieBreak(m) ? 'Tie-break' : 'Set'}
          </span>
          <span className="block text-[min(4.4vw,7vh)] font-extrabold text-gold">{m.status === 'finished' ? '' : m.currentSet}</span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-[1vw]">
          <span className="font-display text-[min(1.4vw,2.4vh)] font-semibold tracking-[0.2em] text-muted uppercase">{STATUS_LABEL[m.status]}</span>
          <span className="font-display text-[min(3.6vw,6vh)] font-bold tabular-nums">{formatDuration(matchTimeMs(m, now))}</span>
        </div>
      </header>

      {/* Placar */}
      <main className="relative grid min-h-0 flex-1 grid-cols-2 portrait:grid-cols-1 portrait:grid-rows-2">
        <Half m={m} t="A" badge={pk?.team === 'A' ? pk.kind : null} />
        <Half m={m} t="B" badge={pk?.team === 'B' ? pk.kind : null} />
        <div className="pointer-events-none absolute inset-y-[8%] left-1/2 w-px bg-line-strong portrait:hidden" aria-hidden />
        <Overlay m={m} now={now} />
      </main>

      {/* Parciais */}
      <footer className="flex min-h-[9vh] items-center justify-center border-t border-line bg-panel/70 px-[2vw] py-[1.2vh]">
        {m.sets.length > 0 ? (
          <SetStrip sets={m.sets} colors={colors} size="lg" />
        ) : (
          <span className="font-display text-[min(1.8vw,3vh)] font-semibold tracking-[0.3em] text-dim uppercase">
            União • Foco • Alegria • Vitória
          </span>
        )}
      </footer>
    </div>
  );
}

function Half({ m, t, badge }: { m: MatchState; t: TeamId; badge: 'set' | 'match' | null }) {
  const team = m.teams[t];
  const serving = m.serving === t && m.status !== 'finished';
  return (
    <section
      className="relative flex min-h-0 flex-col items-center justify-center gap-[1.5vh] px-[2vw]"
      style={{ background: `radial-gradient(90% 70% at 50% 0%, ${team.color}2e, transparent 70%)` }}
      aria-label={`${team.name}: ${m.score[t]} pontos, ${m.setsWon[t]} sets`}
    >
      <span className="absolute inset-x-[10%] top-0 h-[0.8vh] rounded-b-full" style={{ background: team.color }} aria-hidden />

      <div className="flex max-w-full items-center gap-[1.2vw]">
        <TeamLogo team={team} size={120} className="h-[min(5.5vw,9vh)]! w-[min(5.5vw,9vh)]! text-[min(2.2vw,3.6vh)]!" />
        <h2 className="truncate font-display text-[min(4.6vw,8vh)] leading-none font-extrabold tracking-wide uppercase">{team.name}</h2>
      </div>

      <div className="flex items-center gap-[2vw]">
        <ServeBall active={serving} size={64} className="h-[min(4vw,7vh)] w-[min(4vw,7vh)]" label={`${team.name} está sacando`} />
        <span
          key={m.score[t]}
          className="score-digits animate-pop text-[min(27vw,46vh)] portrait:text-[min(45vw,24vh)]"
          style={{ textShadow: `0 0 6vw ${team.color}40` }}
        >
          {m.score[t]}
        </span>
        <span className="w-[min(4vw,7vh)]" aria-hidden />
      </div>

      <div className="flex items-center gap-[1.5vw]">
        <span className="rounded-[1vw] px-[1.4vw] py-[0.6vh] font-display text-[min(2.4vw,4vh)] font-extrabold tabular-nums ring-2" style={{ color: team.color, boxShadow: `inset 0 0 0 2px ${team.color}` }}>
          SETS {m.setsWon[t]}
        </span>
        <TimeoutDots total={m.rules.timeoutsPerSet} left={timeoutsLeft(m, t)} color={team.color} />
      </div>

      {badge && (
        <span className="absolute bottom-[3vh] animate-pulse rounded-[0.8vw] bg-gold px-[1.4vw] py-[0.5vh] font-display text-[min(2vw,3.4vh)] font-extrabold tracking-[0.2em] text-ink uppercase">
          {badge === 'match' ? 'Match point' : 'Set point'}
        </span>
      )}
    </section>
  );
}

function Overlay({ m, now }: { m: MatchState; now: number }) {
  if (m.activeTimeout) {
    const team = m.teams[m.activeTimeout.team];
    return (
      <Card>
        <p className="font-display text-[min(2vw,3.4vh)] font-semibold tracking-[0.3em] text-muted uppercase">Tempo técnico</p>
        <p className="mt-[1vh] font-display text-[min(4vw,7vh)] font-extrabold uppercase" style={{ color: team.color }}>
          {team.name}
        </p>
        <p className="score-digits mt-[1vh] text-[min(14vw,24vh)] text-gold">{secondsLeft(m.activeTimeout.endsAt, now)}</p>
      </Card>
    );
  }
  if (m.status === 'not_started') {
    return (
      <Card subtle>
        <p className="font-display text-[min(2.6vw,4.4vh)] font-bold tracking-[0.3em] text-muted uppercase">Aguardando início</p>
      </Card>
    );
  }
  if (m.status === 'paused') {
    return (
      <Card subtle>
        <p className="font-display text-[min(3vw,5vh)] font-bold tracking-[0.3em] text-gold uppercase">Partida pausada</p>
      </Card>
    );
  }
  if (m.status === 'interval') {
    const ls = lastSet(m);
    if (!ls) return null;
    return (
      <Card>
        <p className="font-display text-[min(2vw,3.4vh)] font-semibold tracking-[0.3em] text-muted uppercase">Fim do set {ls.number}</p>
        <p className="mt-[1vh] font-display text-[min(4.4vw,7.5vh)] font-extrabold uppercase" style={{ color: m.teams[ls.winner].color }}>
          {m.teams[ls.winner].name}
        </p>
        <p className="score-digits mt-[1vh] text-[min(10vw,17vh)]">
          {ls.scoreA}
          <span className="mx-[2vw] text-dim">–</span>
          {ls.scoreB}
        </p>
        {m.intervalEndsAt && (
          <p className="mt-[2vh] font-display text-[min(2.2vw,3.6vh)] font-semibold tracking-widest text-muted uppercase">
            Set {m.currentSet} em <span className="text-fg tabular-nums">{formatDuration(secondsLeft(m.intervalEndsAt, now) * 1000)}</span>
          </p>
        )}
      </Card>
    );
  }
  if (m.status === 'finished') {
    const w = m.winner;
    return (
      <>
        {w && <Confetti colors={[m.teams[w].color, '#E8B931', '#ffffff', '#C9CFDB']} />}
        <Card>
          <Trophy className="mx-auto h-[min(7vw,11vh)] w-[min(7vw,11vh)] text-gold" />
          <p className="mt-[1vh] font-display text-[min(2vw,3.4vh)] font-semibold tracking-[0.3em] text-muted uppercase">
            {w ? 'Vitória' : 'Partida encerrada'}
          </p>
          {w && (
            <p className="font-display text-[min(5.5vw,9vh)] leading-none font-extrabold uppercase" style={{ color: m.teams[w].color }}>
              {m.teams[w].name}
            </p>
          )}
          <p className="score-digits mt-[1.5vh] text-[min(11vw,18vh)]">
            {m.setsWon.A}
            <span className="mx-[2vw] text-dim">–</span>
            {m.setsWon.B}
          </p>
        </Card>
      </>
    );
  }
  return null;
}

function Card({ children, subtle }: { children: ReactNode; subtle?: boolean }) {
  return (
    <div className={`absolute inset-0 z-20 grid place-items-center ${subtle ? 'pointer-events-none' : 'bg-ink/70 backdrop-blur-sm'}`}>
      <div
        className={`animate-fade-up rounded-[2vw] border px-[5vw] py-[4vh] text-center shadow-2xl ${
          subtle ? 'translate-y-[30vh] border-line bg-panel/90 px-[3vw] py-[1.5vh] portrait:translate-y-0' : 'border-gold/40 bg-panel'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
