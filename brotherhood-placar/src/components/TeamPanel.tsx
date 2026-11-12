import { Hand, Minus, Plus } from 'lucide-react';
import { useRef } from 'react';
import { readableOn } from '../lib/browser';
import type { Team, TeamId } from '../domain/types';
import { ServeBall, TeamLogo, TimeoutDots } from './ui';

interface Props {
  side: TeamId;
  team: Team;
  score: number;
  setsWon: number;
  serving: boolean;
  canScore: boolean;
  canRemove: boolean;
  timeoutsTotal: number;
  timeoutsLeft: number;
  canTimeout: boolean;
  badge?: string | null;
  onPoint: () => void;
  onRemove: () => void;
  onTimeout: () => void;
}

/** Intervalo mínimo entre dois pontos da mesma equipe: barra toque duplo acidental. */
const GUARD_MS = 350;

export function TeamPanel(p: Props) {
  const last = useRef(0);
  const fg = readableOn(p.team.color);

  const point = () => {
    const now = Date.now();
    if (now - last.current < GUARD_MS) return;
    last.current = now;
    navigator.vibrate?.(12);
    p.onPoint();
  };

  return (
    <section
      aria-label={`Time ${p.side}: ${p.team.name}`}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-panel/90"
      style={{
        backgroundImage: `radial-gradient(120% 80% at ${p.side === 'A' ? '0% 0%' : '100% 0%'}, ${p.team.color}26, transparent 60%)`,
      }}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.team.color }} aria-hidden />

      {/* Cabeçalho do time */}
      <header className={`flex items-center gap-3 px-4 pt-4 short:gap-2 short:px-3 short:pt-2.5 ${p.side === 'B' ? 'landscape:flex-row-reverse landscape:text-right' : ''}`}>
        <TeamLogo team={p.team} size={44} className="portrait:h-9! portrait:w-9! short:h-8! short:w-8!" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl leading-tight font-bold tracking-wide uppercase sm:text-2xl lg:text-3xl short:text-lg!">{p.team.name}</h2>
          <div className={`mt-1 flex items-center gap-2 ${p.side === 'B' ? 'landscape:justify-end' : ''}`}>
            <TimeoutDots total={p.timeoutsTotal} left={p.timeoutsLeft} color={p.team.color} />
            {p.badge && (
              <span className="rounded-md bg-gold px-1.5 py-0.5 font-display text-[0.65rem] font-bold tracking-widest text-ink uppercase">
                {p.badge}
              </span>
            )}
          </div>
        </div>
        <ServeBall active={p.serving} size={30} label={`${p.team.name} está sacando`} />
      </header>

      {/* Placar */}
      <div className="flex min-h-0 flex-1 items-center gap-3 px-4 portrait:py-1 landscape:flex-col landscape:justify-center">
        <div className="flex flex-1 items-center justify-center landscape:flex-none">
          <span
            key={p.score}
            className="score-digits animate-pop text-[min(30vw,20vh)] landscape:text-[min(24vw,40vh)] short:text-[min(20vw,46vh)]"
            aria-live="polite"
            aria-label={`${p.score} pontos`}
          >
            {p.score}
          </span>
        </div>
        {/* No celular em pé, o botão de ponto fica à direita, no alcance do polegar */}
        <button
          type="button"
          onClick={point}
          disabled={!p.canScore}
          className="grid h-[min(26vw,15vh)] w-[min(26vw,15vh)] shrink-0 place-items-center rounded-3xl font-display text-xl font-bold shadow-lg transition active:scale-95 disabled:opacity-30 landscape:hidden"
          style={{ background: p.team.color, color: fg }}
          aria-label={`Ponto para ${p.team.name}`}
        >
          <Plus size={44} strokeWidth={3} />
        </button>
      </div>

      {/* Rodapé de ações */}
      <footer className={`flex items-center gap-2 px-4 pb-4 pt-2 short:px-2.5 short:pb-2.5 short:pt-0 ${p.side === 'B' ? 'landscape:flex-row-reverse' : ''}`}>
        <button
          type="button"
          onClick={p.onRemove}
          disabled={!p.canRemove}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl short:h-11 short:w-11 border border-line bg-panel-2 text-muted transition hover:text-fg disabled:opacity-30"
          aria-label={`Remover ponto de ${p.team.name}`}
          title="Remover ponto"
        >
          <Minus size={20} />
        </button>
        <button
          type="button"
          onClick={p.onTimeout}
          disabled={!p.canTimeout}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl short:h-11 short:px-2.5 border border-line bg-panel-2 px-3 text-sm font-semibold text-muted transition hover:text-fg disabled:opacity-30"
          title="Tempo técnico"
        >
          <Hand size={18} />
          <span className="portrait:sr-only sm:portrait:not-sr-only short:sr-only">Tempo</span>
          <span className="sr-only"> técnico para {p.team.name}</span>
        </button>
        <button
          type="button"
          onClick={point}
          disabled={!p.canScore}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-display text-xl font-bold tracking-wider uppercase shadow-lg transition active:scale-[0.98] disabled:opacity-30 portrait:hidden lg:h-16 lg:text-2xl short:h-11 short:text-lg"
          style={{ background: p.team.color, color: fg }}
          aria-label={`Ponto para ${p.team.name}`}
        >
          <Plus size={26} strokeWidth={3} /> Ponto
        </button>
        <span className="ml-auto rounded-xl bg-white/5 px-3 py-2 text-center font-display leading-none ring-1 ring-line landscape:hidden">
          <span className="block text-[0.6rem] font-semibold tracking-[0.2em] text-muted uppercase">Sets</span>
          <span className="text-2xl font-extrabold tabular-nums">{p.setsWon}</span>
        </span>
      </footer>
    </section>
  );
}
