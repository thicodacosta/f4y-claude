import Link from "next/link";
import { ArrowUpRight, Download, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Blocos do painel no padrão do kit de referência (cards brancos, chips de
 * ícone, KPI com barra), sempre com os tokens JourneyLab.
 * Registro no design system: design-system/components/Card.md (variações de painel).
 */

export function Cartao({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section {...props} className={cn("flex flex-col rounded-lg border border-border bg-card shadow-surface", className)}>
      {children}
    </section>
  );
}

export function CabecalhoCartao({ titulo, id, acao, descricao }: { titulo: string; id?: string; acao?: React.ReactNode; descricao?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h2 id={id} className="font-heading text-base font-bold">
          {titulo}
        </h2>
        {descricao && <p className="mt-0.5 text-[13px] text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function LinkVerTudo({ href, children = "Ver tudo" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-[13px] font-medium hover:bg-muted">
      {children}
    </Link>
  );
}

export function ChipIcone({ icone: Icone, tom = "teal", className }: { icone: LucideIcon; tom?: "teal" | "navy" | "neutro" | "alerta"; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md",
        tom === "teal" && "bg-teal-soft text-teal-strong",
        tom === "navy" && "bg-primary text-teal dark:text-primary-foreground",
        tom === "neutro" && "bg-muted text-muted-foreground",
        tom === "alerta" && "bg-destructive/10 text-destructive",
        className,
      )}
      aria-hidden
    >
      <Icone className="size-[18px]" />
    </span>
  );
}

export function CartaoKpi({
  rotulo,
  valor,
  detalhe,
  href,
  icone,
  progresso,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  href: string;
  icone: LucideIcon;
  progresso?: number;
  alerta?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface sm:gap-4 sm:p-5 transition-shadow outline-none hover:shadow-hover focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-[13px] leading-snug font-medium text-muted-foreground">{rotulo}</span>
        <ChipIcone icone={icone} tom={alerta ? "alerta" : "teal"} className="hidden size-9 sm:flex" />
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="font-heading text-[28px] leading-none font-bold tabular-nums">{valor}</span>
        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </span>
      {progresso !== undefined ? (
        <span className="flex flex-col gap-1.5">
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-teal" style={{ width: `${progresso}%` }} />
          </span>
          <span className="text-xs text-muted-foreground">{detalhe}</span>
        </span>
      ) : (
        <span className={cn("text-xs", alerta ? "font-semibold text-destructive" : "text-muted-foreground")}>{detalhe}</span>
      )}
    </Link>
  );
}

/** Linha de atividade: chip de ícone + título/subtítulo + valor à direita. */
export function ItemAtividade({
  href,
  icone,
  titulo,
  subtitulo,
  valor,
  alerta,
}: {
  href: string;
  icone: LucideIcon;
  titulo: string;
  subtitulo?: string;
  valor?: string;
  alerta?: boolean;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted">
        <ChipIcone icone={icone} tom={alerta ? "alerta" : "neutro"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{titulo}</span>
          {subtitulo && <span className="block truncate text-xs text-muted-foreground">{subtitulo}</span>}
        </span>
        {valor && <span className={cn("shrink-0 text-xs tabular-nums", alerta ? "font-semibold text-destructive" : "text-muted-foreground")}>{valor}</span>}
      </Link>
    </li>
  );
}

/** Cabeçalho de módulo: chip do produto + título, com as abas à direita (padrão da topbar do kit). */
export function CabecalhoModulo({ titulo, icone, descricao, children }: { titulo: string; icone: LucideIcon; descricao?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <ChipIcone icone={icone} tom="navy" className="size-11" />
        <div className="min-w-0">
          <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight">{titulo}</h1>
          {descricao && <p className="truncate text-[13px] text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Link de exportação CSV (a rota confere permissão e registra auditoria). */
export function LinkExportar({ href, children = "Exportar CSV" }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
      <Download className="size-4" aria-hidden /> {children}
    </a>
  );
}
