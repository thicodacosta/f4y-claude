import { ChevronRight, Play, RefreshCw, ScrollText, Settings, Tv } from 'lucide-react';
import { BrandMark, Button, LinkButton, SetStrip, StatusPill, TeamLogo } from '../components/ui';
import { formatDate } from '../lib/browser';
import { href } from '../lib/router';
import { installUpdate, useUpdateReady } from '../pwa/registerServiceWorker';
import { useHistory, useMatch } from '../state/store';

export function HomeScreen() {
  const match = useMatch();
  const history = useHistory();
  const updateReady = useUpdateReady();
  const live = match && match.status !== 'finished' ? match : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
      {updateReady && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl border border-gold/40 bg-panel px-4 py-3">
          <RefreshCw size={18} className="shrink-0 text-gold" />
          <p className="flex-1 text-sm">
            Nova versão disponível.{live && ' A partida em andamento fica salva.'}
          </p>
          <Button size="sm" variant="primary" onClick={installUpdate}>
            Atualizar
          </Button>
        </div>
      )}
      <header className="flex items-center justify-between">
        <BrandMark size={40} />
        <nav className="flex gap-1" aria-label="Atalhos">
          <a href={href.history} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-fg" aria-label="Histórico">
            <ScrollText size={20} />
          </a>
          <a href={href.settings} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-fg" aria-label="Configurações">
            <Settings size={20} />
          </a>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 py-10 text-center">
        <div className="animate-fade-up">
          <img
            src="/brand/logo.jpg"
            alt="Brotherhood 50+"
            width={300}
            height={289}
            className="mx-auto w-56 [mask-image:radial-gradient(closest-side,#000_82%,transparent)] sm:w-72"
          />
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-wide uppercase sm:text-5xl">
            Brotherhood <span className="text-gold">Placar</span>
          </h1>
          <p className="eyebrow mt-3">União • Foco • Alegria • Vitória</p>
        </div>

        {live && (
          <a
            href={href.scoreboard}
            className="card group w-full max-w-lg animate-fade-up p-4 text-left transition hover:border-gold/40"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">Partida em andamento</span>
              <StatusPill status={live.status} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <TeamLogo team={live.teams.A} size={40} />
              <span className="flex-1 truncate font-display text-lg font-bold uppercase">{live.teams.A.name}</span>
              <span className="score-digits text-4xl tabular-nums">
                {live.score.A}
                <span className="mx-2 text-dim">:</span>
                {live.score.B}
              </span>
              <span className="flex-1 truncate text-right font-display text-lg font-bold uppercase">{live.teams.B.name}</span>
              <TeamLogo team={live.teams.B} size={40} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>
                Set {live.currentSet} · Sets {live.setsWon.A}–{live.setsWon.B}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-gold">
                Continuar <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </a>
        )}

        <div className="flex w-full max-w-lg flex-col gap-3 sm:flex-row">
          <LinkButton href={href.setup} variant={live ? 'secondary' : 'primary'} size="lg" className="flex-1">
            <Play size={20} /> Nova partida
          </LinkButton>
          {live && (
            <LinkButton href={href.display} size="lg" className="flex-1">
              <Tv size={20} /> Modo Telão
            </LinkButton>
          )}
        </div>
      </main>

      {history.length > 0 && (
        <section className="mx-auto w-full max-w-lg" aria-labelledby="recentes">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="recentes" className="eyebrow">Últimas partidas</h2>
            <a href={href.history} className="text-sm font-semibold text-gold hover:underline">
              Ver todas
            </a>
          </div>
          <ul className="card divide-y divide-line">
            {history.slice(0, 3).map((m) => (
              <li key={m.id}>
                <a href={href.match(m.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      <span className={m.winner === 'A' ? 'text-fg' : 'text-muted'}>{m.teams.A.name}</span>
                      <span className="mx-1.5 text-dim">×</span>
                      <span className={m.winner === 'B' ? 'text-fg' : 'text-muted'}>{m.teams.B.name}</span>
                    </span>
                    <span className="block text-xs text-dim">{formatDate(m.info.date)}{m.info.tournament && ` · ${m.info.tournament}`}</span>
                  </span>
                  <span className="score-digits text-2xl">
                    {m.setsWon.A}–{m.setsWon.B}
                  </span>
                  <span className="hidden sm:block">
                    <SetStrip sets={m.sets} colors={{ A: m.teams.A.color, B: m.teams.B.color }} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
