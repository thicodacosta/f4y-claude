import { Volleyball } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { readableOn } from '../lib/browser';
import { STATUS_LABEL } from '../domain/selectors';
import type { MatchStatus, SetResult, Team } from '../domain/types';

/* ---------------- Botões ---------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-gold-hi to-gold text-ink shadow-[0_8px_24px_-8px_rgb(232_185_49/0.6)] hover:brightness-105 active:brightness-95',
  secondary: 'bg-panel-2 text-fg border border-line hover:bg-panel-3 hover:border-line-strong',
  ghost: 'text-muted hover:text-fg hover:bg-white/5',
  danger: 'bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[0.95rem] gap-2 rounded-xl',
  lg: 'h-14 px-6 text-lg gap-2.5 rounded-2xl',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex shrink-0 items-center justify-center font-semibold transition select-none disabled:opacity-40 disabled:saturate-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`inline-flex shrink-0 items-center justify-center font-semibold transition select-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </a>
  );
}

/* ---------------- Diálogo (dialog nativo: foco preso e Esc por padrão) ---------------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dlg-title"
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-xl' : 'max-w-md'} rounded-2xl border border-line-strong bg-panel p-0 text-fg shadow-2xl`}
    >
      {open && (
        <div className="animate-fade-up">
          <div className="border-b border-line px-5 py-4">
            <h2 id="dlg-title" className="font-display text-xl font-bold tracking-wide uppercase">
              {title}
            </h2>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/* ---------------- Identidade dos times ---------------- */

export function TeamLogo({ team, size = 48, className = '' }: { team: Team; size?: number; className?: string }) {
  const initials = team.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold ring-2 ring-white/10 ${className}`}
      style={{ width: size, height: size, background: team.color, color: readableOn(team.color), fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </span>
  );
}

export function ServeBall({
  active,
  size = 22,
  label,
  className = '',
}: {
  active: boolean;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={active ? 'img' : undefined}
      aria-label={active ? (label ?? 'Saque') : undefined}
      aria-hidden={!active}
      className={`inline-grid place-items-center transition-all duration-300 ${active ? 'scale-100 text-gold animate-glow' : 'scale-75 text-transparent'}`}
    >
      <Volleyball size={size} strokeWidth={2.2} className={className} />
    </span>
  );
}

export function TimeoutDots({ total, left, color }: { total: number; left: number; color: string }) {
  if (total <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${left} de ${total} tempos técnicos disponíveis`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2 w-5 rounded-full transition-colors"
          style={{ background: i < left ? color : 'rgb(255 255 255 / 0.12)' }}
        />
      ))}
    </span>
  );
}

const STATUS_STYLE: Record<MatchStatus, string> = {
  not_started: 'bg-white/8 text-muted',
  in_progress: 'bg-ok/15 text-ok',
  paused: 'bg-gold/15 text-gold',
  interval: 'bg-sky-400/15 text-sky-300',
  finished: 'bg-white/10 text-silver',
};

export function StatusPill({ status, className = '' }: { status: MatchStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-xs font-semibold tracking-[0.14em] uppercase ${STATUS_STYLE[status]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'in_progress' ? 'animate-pulse' : ''}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Sequência de parciais: 25-21 · 23-25 · … */
export function SetStrip({
  sets,
  colors,
  size = 'md',
}: {
  sets: SetResult[];
  colors: { A: string; B: string };
  size?: 'md' | 'lg';
}) {
  if (sets.length === 0) return null;
  const cls = size === 'lg' ? 'text-[2.4vw] px-[1vw] py-[0.3vw] gap-[0.6vw]' : 'text-sm px-2.5 py-1 gap-1.5';
  return (
    <ol className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Parciais dos sets">
      {sets.map((s) => (
        <li
          key={s.number}
          className={`inline-flex items-center rounded-lg bg-white/5 font-display font-bold tabular-nums ring-1 ring-line ${cls}`}
          title={`Set ${s.number}`}
        >
          <span style={{ color: s.winner === 'A' ? colors.A : undefined }} className={s.winner === 'A' ? '' : 'text-muted'}>
            {s.scoreA}
          </span>
          <span className="text-dim">–</span>
          <span style={{ color: s.winner === 'B' ? colors.B : undefined }} className={s.winner === 'B' ? '' : 'text-muted'}>
            {s.scoreB}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function BrandMark({ size = 40, withName = true }: { size?: number; withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/logo.jpg" alt="" width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
      {withName && (
        <span className="leading-none">
          <span className="block font-display text-lg font-bold tracking-wider uppercase">Brotherhood</span>
          <span className="block font-display text-[0.65rem] font-semibold tracking-[0.32em] text-gold uppercase">Placar</span>
        </span>
      )}
    </span>
  );
}

export function Confetti({ colors }: { colors: string[] }) {
  const pieces = Array.from({ length: 70 }, (_, i) => i);
  return (
    <div className="confetti pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDuration: `${2.6 + ((i * 13) % 20) / 10}s`,
            animationDelay: `${((i * 7) % 30) / 10}s`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}
