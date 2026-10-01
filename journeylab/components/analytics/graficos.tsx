import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { ChipIcone } from "@/components/app/painel";
import { formatarNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Gráficos do People Analytics / Retenção — SVG puro com tokens do design
 * system (sem biblioteca). Cada gráfico tem rótulo acessível com os valores;
 * a cor nunca é a única informação.
 */

const fmt = (v: number | null | undefined, casas = 1) => (v === null || v === undefined ? "—" : formatarNumero(v, Number.isInteger(v) ? 0 : casas));

/** Variação com sentido: `menorMelhor` inverte a cor (ex.: turnover). */
export function Variacao({ valor, unidade = "", menorMelhor = false, rotulo = "vs. período anterior" }: { valor: number | null; unidade?: string; menorMelhor?: boolean; rotulo?: string }) {
  if (valor === null || Number.isNaN(valor)) return null;
  const neutro = Math.abs(valor) < 0.05;
  const bom = neutro ? null : menorMelhor ? valor < 0 : valor > 0;
  const Icone = neutro ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", bom === null ? "text-muted-foreground" : bom ? "text-[#0E7A4E] dark:text-success" : "text-destructive")}>
      <Icone className="size-3.5" aria-hidden />
      {valor > 0 ? "+" : ""}
      {fmt(valor)}
      {unidade} <span className="font-normal text-muted-foreground">{rotulo}</span>
    </span>
  );
}

/** Indicador (KPI) sem link — com variação e barra opcional. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  variacao,
  alerta,
  href,
  progresso,
}: {
  rotulo: string;
  valor: string;
  detalhe?: React.ReactNode;
  icone: LucideIcon;
  variacao?: React.ReactNode;
  alerta?: boolean;
  href?: string;
  progresso?: number | null;
}) {
  const corpo = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-[13px] leading-snug font-medium text-muted-foreground">{rotulo}</span>
        <ChipIcone icone={icone} tom={alerta ? "alerta" : "teal"} className="hidden size-9 sm:flex" />
      </span>
      <span className="font-heading text-[28px] leading-none font-bold tabular-nums">{valor}</span>
      {progresso !== undefined && progresso !== null && (
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.max(0, Math.min(100, progresso))}%` }} />
        </span>
      )}
      <span className="flex flex-col gap-1">
        {variacao}
        {detalhe && <span className={cn("text-xs", alerta ? "font-semibold text-destructive" : "text-muted-foreground")}>{detalhe}</span>}
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow outline-none hover:shadow-hover focus-visible:ring-3 focus-visible:ring-ring/50")}>
      {corpo}
    </Link>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

/** Barras horizontais com rótulo, valor e detalhe. */
export function BarrasHorizontais({
  itens,
  unidade = "",
  tom = "teal",
  max,
  vazio = "Sem dados no período.",
}: {
  itens: { rotulo: string; valor: number; detalhe?: string; destaque?: boolean }[];
  unidade?: string;
  tom?: "teal" | "perigo" | "alerta" | "navy";
  max?: number;
  vazio?: string;
}) {
  if (!itens.length) return <p className="text-sm text-muted-foreground">{vazio}</p>;
  const topo = max ?? Math.max(...itens.map((i) => i.valor), 1);
  const cor = { teal: "var(--teal)", perigo: "var(--destructive)", alerta: "var(--warning)", navy: "var(--primary)" }[tom];
  return (
    <ul className="flex flex-col gap-2.5">
      {itens.map((i) => (
        <li key={i.rotulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
          <span className={cn("truncate", i.destaque && "font-semibold")} title={i.rotulo}>
            {i.rotulo}
          </span>
          <span className="col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:col-span-1" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (i.valor / topo) * 100)}%`, background: i.destaque ? "var(--destructive)" : cor }} />
          </span>
          <span className="col-start-2 row-start-1 text-right text-xs tabular-nums sm:col-start-3">
            <strong className="text-sm">
              {fmt(i.valor)}
              {unidade}
            </strong>
            {i.detalhe && <span className="text-muted-foreground"> · {i.detalhe}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Movimentação mensal: admissões × saídas (barras) e linha de headcount. */
export function GraficoMovimentacao({ pontos }: { pontos: { rotulo: string; headcount: number; admissoes: number; saidas: number; voluntarias: number; turnover: number | null }[] }) {
  if (!pontos.length) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  const W = 720;
  const H = 230;
  const topo = 24;
  const base = H - 34;
  const largura = (W - 60) / pontos.length;
  const maxMov = Math.max(1, ...pontos.map((p) => Math.max(p.admissoes, p.saidas)));
  const maxHc = Math.max(1, ...pontos.map((p) => p.headcount));
  const yMov = (v: number) => base - (v / maxMov) * (base - topo) * 0.85;
  const yHc = (v: number) => base - (v / maxHc) * (base - topo);
  const xc = (i: number) => 40 + i * largura + largura / 2;
  const descricao = pontos.map((p) => `${p.rotulo}: ${p.headcount} pessoas, ${p.admissoes} admissões, ${p.saidas} saídas`).join("; ");
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] w-full" role="img" aria-label={`Movimentação mensal. ${descricao}`}>
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1="40" x2={W - 20} y1={base - f * (base - topo)} y2={base - f * (base - topo)} stroke="var(--border)" />
          ))}
          {pontos.map((p, i) => {
            const bw = Math.min(14, largura / 3.2);
            return (
              <g key={p.rotulo}>
                <rect x={xc(i) - bw - 1} y={yMov(p.admissoes)} width={bw} height={base - yMov(p.admissoes)} rx="2" fill="var(--teal)" />
                <rect x={xc(i) + 1} y={yMov(p.saidas)} width={bw} height={base - yMov(p.saidas)} rx="2" fill="var(--destructive)" opacity="0.85" />
                {p.saidas > 0 && (
                  <text x={xc(i) + 1 + bw / 2} y={yMov(p.saidas) - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                    {p.saidas}
                  </text>
                )}
                <text x={xc(i)} y={H - 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {p.rotulo}
                </text>
              </g>
            );
          })}
          <polyline points={pontos.map((p, i) => `${xc(i)},${yHc(p.headcount)}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2" />
          {pontos.map((p, i) => (
            <circle key={i} cx={xc(i)} cy={yHc(p.headcount)} r="3" fill="var(--primary)" />
          ))}
          <text x={xc(pontos.length - 1)} y={yHc(pontos[pontos.length - 1].headcount) - 8} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
            {pontos[pontos.length - 1].headcount}
          </text>
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-teal" aria-hidden /> Admissões
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-destructive" aria-hidden /> Saídas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-primary" aria-hidden /> Headcount
        </span>
      </figcaption>
    </figure>
  );
}

/** Linha simples (ex.: turnover mensal %) com referência opcional tracejada. */
export function GraficoLinha({ pontos, unidade = "%", referencia, rotuloReferencia }: { pontos: { rotulo: string; valor: number | null }[]; unidade?: string; referencia?: number | null; rotuloReferencia?: string }) {
  const validos = pontos.filter((p) => p.valor !== null) as { rotulo: string; valor: number }[];
  if (validos.length < 2) return <p className="text-sm text-muted-foreground">A tendência aparece com pelo menos dois meses de dados.</p>;
  const W = 720;
  const H = 170;
  const max = Math.max(1, ...validos.map((p) => p.valor), referencia ?? 0) * 1.15;
  const x = (i: number) => 40 + (i * (W - 70)) / Math.max(1, pontos.length - 1);
  const y = (v: number) => H - 26 - (v / max) * (H - 46);
  return (
    <figure>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] w-full" role="img" aria-label={`Série: ${pontos.map((p) => `${p.rotulo} ${p.valor ?? "sem dados"}${unidade}`).join("; ")}`}>
          <line x1="40" x2={W - 30} y1={y(0)} y2={y(0)} stroke="var(--border)" />
          {referencia !== null && referencia !== undefined && (
            <g>
              <line x1="40" x2={W - 30} y1={y(referencia)} y2={y(referencia)} stroke="var(--warning)" strokeDasharray="5 4" />
              <text x={W - 30} y={y(referencia) - 5} textAnchor="end" className="fill-muted-foreground text-[9px]">
                {rotuloReferencia ?? "Referência"} {fmt(referencia)}
                {unidade}
              </text>
            </g>
          )}
          <polyline points={pontos.map((p, i) => (p.valor === null ? null : `${x(i)},${y(p.valor)}`)).filter(Boolean).join(" ")} fill="none" stroke="var(--teal)" strokeWidth="2" />
          {pontos.map((p, i) =>
            p.valor === null ? null : (
              <g key={i}>
                <circle cx={x(i)} cy={y(p.valor)} r="3" fill="var(--teal)" />
                <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {p.rotulo}
                </text>
              </g>
            ),
          )}
        </svg>
      </div>
    </figure>
  );
}

/** Funil com conversão entre etapas. */
export function Funil({ etapas }: { etapas: { etapa: string; n: number }[] }) {
  const topo = Math.max(1, etapas[0]?.n ?? 1);
  return (
    <ol className="flex flex-col gap-2">
      {etapas.map((e, i) => {
        const conv = i > 0 && etapas[i - 1].n > 0 ? Math.round((e.n / etapas[i - 1].n) * 100) : null;
        return (
          <li key={e.etapa} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate">{e.etapa}</span>
            <span className="h-6 overflow-hidden rounded-md bg-muted" aria-hidden>
              <span className="block h-full rounded-md bg-primary/85" style={{ width: `${Math.max(2, (e.n / topo) * 100)}%` }} />
            </span>
            <span className="w-24 text-right text-xs tabular-nums">
              <strong className="text-sm">{e.n}</strong>
              {conv !== null && <span className="text-muted-foreground"> · {conv}%</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra empilhada de distribuição (ex.: semáforo, nível de risco). */
export function Distribuicao({ partes }: { partes: { rotulo: string; n: number; cor: string }[] }) {
  const total = partes.reduce((s, p) => s + p.n, 0);
  if (!total) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${p.n}`).join(", ")}>
        {partes.map((p) => (p.n ? <span key={p.rotulo} style={{ width: `${(p.n / total) * 100}%`, background: p.cor }} /> : null))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {partes.map((p) => (
          <li key={p.rotulo} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: p.cor }} aria-hidden />
            {p.rotulo}: <strong className="text-foreground tabular-nums">{p.n}</strong> ({Math.round((p.n / total) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

export const COR = { sucesso: "var(--success)", alerta: "var(--warning)", perigo: "var(--destructive)", teal: "var(--teal)", navy: "var(--primary)", neutro: "var(--muted-foreground)" } as const;
export { fmt as formatarIndicador };
