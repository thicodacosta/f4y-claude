import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { href } from '../lib/router';
import { BrandMark } from './ui';

export function PageShell({
  title,
  back = href.home,
  actions,
  children,
}: {
  title: string;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-16 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-line bg-ink/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <a href={back} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-fg" aria-label="Voltar">
          <ChevronLeft size={22} />
        </a>
        <h1 className="flex-1 truncate font-display text-xl font-bold tracking-wide uppercase sm:text-2xl">{title}</h1>
        {actions}
        <a href={href.home} className="hidden sm:block" aria-label="Início">
          <BrandMark size={34} withName={false} />
        </a>
      </header>
      <main className="flex-1 pt-6">{children}</main>
    </div>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold tracking-wide uppercase">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-silver">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-dim">{hint}</p>}
    </div>
  );
}

/** Seletor segmentado acessível (radiogroup). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-xl border border-line bg-panel-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? 'bg-panel-3 text-fg shadow ring-1 ring-line-strong' : 'text-muted hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-panel-3 ring-1 ring-line transition peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold" />
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
