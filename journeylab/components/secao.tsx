import { cn } from "@/lib/utils";

/** Container + ritmo de seção (grid.md / spacing.md). */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Secao({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("py-14 sm:py-20", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[13px] font-semibold uppercase tracking-[0.08em] text-teal-strong", className)}>{children}</p>
  );
}

export function CabecalhoSecao({
  eyebrow,
  titulo,
  descricao,
  className,
  acao,
}: {
  eyebrow?: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  className?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex max-w-2xl flex-col gap-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="font-heading text-[28px] leading-tight font-bold tracking-tight sm:text-[36px]">{titulo}</h2>
        {descricao && <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/** Cabeçalho de página interna (área autenticada/admin). */
export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
  eyebrow,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-heading text-2xl leading-tight font-bold tracking-tight sm:text-[26px]">{titulo}</h1>
        {descricao && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function BarraProgresso({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-teal" style={{ width: `${valor}%` }} />
    </div>
  );
}
