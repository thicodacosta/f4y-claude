import { forwardRef } from 'react';
import { formatDuration } from '../domain/clock';
import type { MatchState } from '../domain/types';
import { formatDate } from '../lib/browser';
import { TeamLogo } from './ui';

export const CARD_W = 1080;
export const CARD_H = 1350;

/** Arte do resultado final para exportação (formato retrato de rede social). */
export const ResultCard = forwardRef<HTMLDivElement, { m: MatchState }>(function ResultCard({ m }, ref) {
  const w = m.winner;
  return (
    <div
      ref={ref}
      style={{ width: CARD_W, height: CARD_H }}
      className="relative flex flex-col overflow-hidden bg-ink p-[72px] font-sans text-fg"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(700px 500px at 0% 0%, ${m.teams.A.color}33, transparent 70%), radial-gradient(700px 500px at 100% 100%, ${m.teams.B.color}33, transparent 70%)`,
        }}
      />
      <div className="relative flex items-center gap-6">
        <img src="/brand/logo.jpg" alt="" width={120} height={120} className="h-[120px] w-[120px] rounded-full" />
        <div>
          <p className="font-display text-[54px] leading-none font-extrabold tracking-wide uppercase">
            Brotherhood <span className="text-gold">Placar</span>
          </p>
          <p className="mt-2 font-display text-[26px] font-semibold tracking-[0.25em] text-muted uppercase">Resultado final</p>
        </div>
      </div>

      <div className="relative mt-14 border-y border-line-strong py-8">
        <p className="font-display text-[34px] font-bold tracking-wide uppercase">{m.info.tournament || 'Partida amistosa'}</p>
        <p className="mt-1 text-[26px] text-muted">
          {formatDate(m.info.date)}
          {m.info.venue && ` · ${m.info.venue}`}
        </p>
      </div>

      <div className="relative mt-14 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        {(['A', 'B'] as const).map((t, i) => (
          <div key={t} className={`flex flex-col items-center gap-5 text-center ${i === 1 ? 'col-start-3' : ''}`}>
            <TeamLogo team={m.teams[t]} size={170} />
            <p className="font-display text-[46px] leading-tight font-extrabold uppercase" style={{ color: w === t ? m.teams[t].color : undefined }}>
              {m.teams[t].name}
            </p>
          </div>
        ))}
        <p className="score-digits col-start-2 row-start-1 text-[200px]">
          {m.setsWon.A}
          <span className="mx-4 text-dim">–</span>
          {m.setsWon.B}
        </p>
      </div>

      <div className="relative mt-12 flex flex-wrap justify-center gap-4">
        {m.sets.map((s) => (
          <div key={s.number} className="rounded-2xl bg-white/5 px-7 py-4 text-center ring-1 ring-line-strong">
            <p className="font-display text-[20px] font-semibold tracking-[0.2em] text-muted uppercase">Set {s.number}</p>
            <p className="font-display text-[48px] font-extrabold tabular-nums">
              <span style={{ color: s.winner === 'A' ? m.teams.A.color : undefined }}>{s.scoreA}</span>
              <span className="mx-2 text-dim">–</span>
              <span style={{ color: s.winner === 'B' ? m.teams.B.color : undefined }}>{s.scoreB}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="relative mt-auto flex items-end justify-between">
        <p className="font-display text-[28px] font-semibold tracking-[0.2em] text-gold uppercase">União • Foco • Alegria • Vitória</p>
        <p className="font-display text-[28px] font-bold text-muted tabular-nums">⏱ {formatDuration(m.clock.elapsedMs)}</p>
      </div>
    </div>
  );
});
