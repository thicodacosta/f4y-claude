import { ImagePlus, Play, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useConfirm } from '../components/confirm';
import { Field, PageShell, Section, Segmented } from '../components/layout';
import { RulesFields } from '../components/RulesFields';
import { Button, ServeBall, TeamLogo } from '../components/ui';
import { TEAM_COLOR_PRESETS } from '../domain/defaults';
import type { MatchRules, Team, TeamId } from '../domain/types';
import { resizeImage, todayISO } from '../lib/browser';
import { href, navigate } from '../lib/router';
import { store, useMatch, useSettings } from '../state/store';

function TeamEditor({ side, team, onChange }: { side: TeamId; team: Team; onChange: (t: Team) => void }) {
  const id = useId();
  const [error, setError] = useState('');

  const onFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      onChange({ ...team, logo: await resizeImage(file) });
    } catch {
      setError('Não foi possível ler esta imagem.');
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-panel-2/60 p-4" style={{ boxShadow: `inset 4px 0 0 ${team.color}` }}>
      <p className="eyebrow mb-3">Time {side}</p>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <TeamLogo team={team} size={72} />
          <div className="flex gap-1">
            <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-fg" title="Enviar escudo">
              <ImagePlus size={17} />
              <span className="sr-only">Enviar escudo do time {side}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {team.logo && (
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-danger"
                onClick={() => onChange({ ...team, logo: undefined })}
                aria-label={`Remover escudo do time ${side}`}
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Field label="Nome" htmlFor={`${id}-name`}>
            <input
              id={`${id}-name`}
              className="field font-semibold"
              value={team.name}
              maxLength={28}
              onChange={(e) => onChange({ ...team, name: e.target.value })}
              placeholder={`Time ${side}`}
              required
            />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-silver">Cor</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {TEAM_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...team, color: c })}
                  className={`h-7 w-7 rounded-full transition ${team.color.toLowerCase() === c.toLowerCase() ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-panel-2' : 'hover:scale-110'}`}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                  aria-pressed={team.color.toLowerCase() === c.toLowerCase()}
                />
              ))}
              <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-line-strong" title="Outra cor">
                <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
                <input
                  type="color"
                  value={team.color}
                  onChange={(e) => onChange({ ...team, color: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Escolher outra cor para o time ${side}`}
                />
              </label>
            </div>
          </fieldset>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const settings = useSettings();
  const current = useMatch();
  const confirm = useConfirm();

  const [teams, setTeams] = useState<{ A: Team; B: Team }>(() => settings.lastTeams);
  const [firstServer, setFirstServer] = useState<TeamId>('A');
  const [tournament, setTournament] = useState(settings.lastInfo.tournament);
  const [venue, setVenue] = useState(settings.lastInfo.venue);
  const [date, setDate] = useState(todayISO());
  const [rules, setRules] = useState<MatchRules>(settings.rules);

  const valid = teams.A.name.trim() && teams.B.name.trim();

  const start = async () => {
    if (!valid) return;
    if (current && current.status !== 'finished' && current.status !== 'not_started') {
      const ok = await confirm({
        title: 'Substituir partida?',
        message: `Há uma partida em andamento (${current.teams.A.name} × ${current.teams.B.name}). Ela será descartada e não irá para o histórico.`,
        confirmLabel: 'Descartar e criar nova',
        tone: 'danger',
      });
      if (!ok) return;
    }
    store.newMatch({
      teams: {
        A: { ...teams.A, name: teams.A.name.trim() },
        B: { ...teams.B, name: teams.B.name.trim() },
      },
      info: { tournament: tournament.trim(), venue: venue.trim(), date },
      rules,
      firstServer,
    });
    navigate(href.scoreboard);
  };

  return (
    <PageShell title="Nova partida">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <Section title="Times">
          <div className="grid gap-4 md:grid-cols-2">
            <TeamEditor side="A" team={teams.A} onChange={(A) => setTeams((t) => ({ ...t, A }))} />
            <TeamEditor side="B" team={teams.B} onChange={(B) => setTeams((t) => ({ ...t, B }))} />
          </div>
          <div className="mt-5">
            <Field label="Quem começa sacando?">
              <Segmented
                label="Equipe que começa sacando"
                value={firstServer}
                onChange={setFirstServer}
                options={(['A', 'B'] as const).map((t) => ({
                  value: t,
                  label: (
                    <>
                      <ServeBall active={firstServer === t} size={16} />
                      <span className="truncate">{teams[t].name || `Time ${t}`}</span>
                    </>
                  ),
                }))}
              />
            </Field>
          </div>
        </Section>

        <Section title="Partida">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Campeonato ou torneio" htmlFor="s-tour">
              <input id="s-tour" className="field" value={tournament} onChange={(e) => setTournament(e.target.value)} placeholder="Ex.: Copa 50+ de Verão" maxLength={60} />
            </Field>
            <Field label="Local" htmlFor="s-venue">
              <input id="s-venue" className="field" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ex.: Ginásio do condomínio" maxLength={60} />
            </Field>
            <Field label="Data" htmlFor="s-date">
              <input id="s-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
        </Section>

        <details className="card group p-5 sm:p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <span>
              <span className="block font-display text-lg font-bold tracking-wide uppercase">Regras desta partida</span>
              <span className="block text-sm text-muted">
                Melhor de {rules.bestOf} · sets de {rules.setPoints} · tie-break de {rules.tieBreakPoints} · {rules.timeoutsPerSet} tempos de {rules.timeoutDurationSec}s
              </span>
            </span>
            <span className="text-sm font-semibold text-gold group-open:hidden">Editar</span>
          </summary>
          <div className="mt-5">
            <RulesFields value={rules} onChange={setRules} />
          </div>
        </details>

        <div className="sticky bottom-0 -mx-4 border-t border-line bg-ink/90 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" variant="primary" size="lg" className="w-full sm:ml-auto sm:flex sm:w-auto" disabled={!valid}>
            <Play size={20} /> Ir para o placar
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
