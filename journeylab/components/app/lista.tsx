import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const POR_PAGINA = 20;

export function paginaDe(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Barra de busca/filtros via GET (funciona sem JavaScript; URL compartilhável). */
export function BarraBusca({
  q,
  placeholder,
  children,
}: {
  q?: string;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <form role="search" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface sm:flex-row sm:flex-wrap sm:items-end">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="q" className="sr-only">
          Buscar
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {children}
      <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Filtrar
      </button>
    </form>
  );
}

export function FiltroSelect({
  nome,
  rotulo,
  valor,
  opcoes,
}: {
  nome: string;
  rotulo: string;
  valor?: string;
  opcoes: { valor: string; rotulo: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`f-${nome}`} className="text-xs font-semibold text-muted-foreground">
        {rotulo}
      </label>
      <select
        id={`f-${nome}`}
        name={nome}
        defaultValue={valor ?? ""}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Paginacao({
  pagina,
  total,
  params,
}: {
  pagina: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (paginas <= 1) return <p className="text-sm text-muted-foreground">{total} {total === 1 ? "registro" : "registros"}</p>;
  const link = (p: number) => {
    const u = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    u.set("pagina", String(p));
    return `?${u.toString()}`;
  };
  const cls = "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm";
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {total} registros · página {pagina} de {paginas}
      </span>
      <span className="flex gap-2">
        {pagina > 1 ? (
          <Link href={link(pagina - 1)} className={cn(cls, "hover:bg-muted")}>
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Link>
        ) : null}
        {pagina < paginas ? (
          <Link href={link(pagina + 1)} className={cn(cls, "hover:bg-muted")}>
            Próxima <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

const TONS = {
  sucesso: "bg-success/12 text-[#0E7A4E] dark:text-success",
  alerta: "bg-warning/15 text-warning-foreground dark:text-warning",
  perigo: "bg-destructive/10 text-destructive",
  info: "bg-teal-soft text-teal-strong",
  neutro: "bg-muted text-muted-foreground",
} as const;

export function Selo({ tom = "neutro", children }: { tom?: keyof typeof TONS; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 w-fit items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap", TONS[tom])}>{children}</span>;
}

export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-card px-6 py-14 text-center">
      <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-teal-soft text-teal-strong" aria-hidden>
        <Inbox className="size-5" />
      </span>
      <p className="font-heading font-bold">{titulo}</p>
      <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

/** Avatar com iniciais (listas de pessoas/candidatos). */
export function Iniciais({ nome, className }: { nome: string; className?: string }) {
  const p = nome.trim().split(/\s+/);
  const ini = ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  return (
    <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-soft text-xs font-semibold text-teal-strong", className)}>
      {ini}
    </span>
  );
}
