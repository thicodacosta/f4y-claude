import { ChevronRight, Play, ScrollText } from 'lucide-react';
import { PageShell } from '../components/layout';
import { LinkButton, SetStrip, TeamLogo } from '../components/ui';
import { formatDuration } from '../domain/clock';
import { formatDate } from '../lib/browser';
import { href } from '../lib/router';
import { useHistory } from '../state/store';

export function HistoryScreen() {
  const history = useHistory();

  return (
    <PageShell title="Histórico">
      {history.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <ScrollText size={40} className="text-dim" />
          <div>
            <p className="font-display text-xl font-bold uppercase">Nenhuma partida finalizada</p>
            <p className="mt-1 text-muted">As partidas encerradas ficam salvas neste dispositivo.</p>
          </div>
          <LinkButton href={href.setup} variant="primary">
            <Play size={18} /> Nova partida
          </LinkButton>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {history.map((m) => (
            <li key={m.id}>
              <a href={href.match(m.id)} className="card group flex flex-col gap-3 p-4 transition hover:border-gold/40 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow truncate">
                    {formatDate(m.info.date)}
                    {m.info.tournament && ` · ${m.info.tournament}`}
                    {m.info.venue && ` · ${m.info.venue}`}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <TeamLogo team={m.teams.A} size={36} />
                    <span className={`truncate font-display text-lg font-bold uppercase ${m.winner === 'A' ? '' : 'text-muted'}`}>{m.teams.A.name}</span>
                    <span className="score-digits shrink-0 text-3xl">
                      {m.setsWon.A}
                      <span className="mx-1.5 text-dim">–</span>
                      {m.setsWon.B}
                    </span>
                    <span className={`truncate font-display text-lg font-bold uppercase ${m.winner === 'B' ? '' : 'text-muted'}`}>{m.teams.B.name}</span>
                    <TeamLogo team={m.teams.B} size={36} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <SetStrip sets={m.sets} colors={{ A: m.teams.A.color, B: m.teams.B.color }} />
                  <span className="text-sm text-dim tabular-nums">{formatDuration(m.clock.elapsedMs)}</span>
                  <ChevronRight size={18} className="text-dim transition group-hover:translate-x-0.5 group-hover:text-gold" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
