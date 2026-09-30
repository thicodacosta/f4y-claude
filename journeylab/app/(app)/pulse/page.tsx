import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Activity, BarChart3, ClipboardList, Gauge, Pencil, Plus, Users } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { formatarData } from "@/lib/formato";
import { hoje } from "@/lib/datas";
import { AUDIENCIA, filtroPesquisas, STATUS_PESQUISA } from "@/lib/pulse/regras";
import { adesaoPulse, enpsDaPesquisa } from "@/lib/pulse/consultas";
import { urlResposta } from "@/lib/pulse/links";
import { classificarEnps } from "@/lib/pulse/perguntas";
import { EstadoVazio, Selo } from "@/components/app/lista";
import { CartaoKpi } from "@/components/app/painel";
import { BotaoPesquisa, CopiarLink } from "@/components/pulse/acoes";

export const metadata: Metadata = { title: "Pulse" };

const COLUNAS = ["rascunho", "aberta", "encerrada"] as const;

export default async function PulsePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, db } = await exigirModulo("pulse");
  const sp = await searchParams;
  const gestao = pode(ctx, "pulse", "criar") === "todos" && !ctx.suporte;
  if (sp.action === "create" && gestao) redirect("/pulse/nova");
  const q = (sp.q ?? "").trim().slice(0, 80);

  const pesquisas = await db.pesquisaPulse.findMany({
    where: { AND: [filtroPesquisas(pode(ctx, "pulse", "criar") === "todos"), q ? { titulo: { contains: q, mode: "insensitive" } } : {}] },
    include: { _count: { select: { perguntas: true } }, perguntas: { where: { tipo: "nps" }, select: { id: true } } },
    orderBy: { criadoEm: "desc" },
    take: 90,
  });

  const enviadas = pesquisas.filter((p) => p.status !== "rascunho");
  const adesoes = new Map(await Promise.all(enviadas.map(async (p) => [p.id, await adesaoPulse(ctx, p.id)] as const)));
  const taxas = enviadas.map((p) => adesoes.get(p.id)!).filter((a) => a.publico > 0).map((a) => Math.min(100, (a.respondentes / a.publico) * 100));
  const taxaMedia = taxas.length ? Math.round(taxas.reduce((a, b) => a + b, 0) / taxas.length) : null;
  const comNps = pesquisas.filter((p) => p.status === "encerrada" && p.perguntas.length).slice(0, 12);
  const enpsLista = (await Promise.all(comNps.map((p) => enpsDaPesquisa(ctx, p.id, p.perguntas.map((x) => x.id))))).filter((e) => e !== null);
  const enpsMedio = enpsLista.length ? Math.round(enpsLista.reduce((s, e) => s + e.enps, 0) / enpsLista.length) : null;
  const ativas = pesquisas.filter((p) => p.status === "aberta").length;
  const h = hoje();

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoKpi rotulo="Pesquisas" valor={String(pesquisas.length)} detalhe={gestao ? "Inclui rascunhos" : "Ativas e encerradas"} href="/pulse" icone={ClipboardList} />
        <CartaoKpi rotulo="Ativas" valor={String(ativas)} detalhe={ativas ? "Em coleta agora" : "Nenhuma em coleta"} href="/pulse#coluna-aberta" icone={Activity} />
        <CartaoKpi rotulo="Taxa média de resposta" valor={taxaMedia === null ? "—" : `${taxaMedia}%`} detalhe="Pesquisas enviadas" href="/pulse#coluna-encerrada" icone={Users} progresso={taxaMedia ?? undefined} />
        <CartaoKpi
          rotulo="eNPS médio"
          valor={enpsMedio === null ? "—" : String(enpsMedio)}
          detalhe={enpsMedio === null ? "Sem eNPS liberado" : `${classificarEnps(enpsMedio).nome} · ${enpsLista.length} pesquisa(s)`}
          href="/pulse#coluna-encerrada"
          icone={Gauge}
          alerta={enpsMedio !== null && enpsMedio < 0}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2" role="search">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Buscar
            <input name="q" defaultValue={q} placeholder="Título da pesquisa" className="h-10 w-64 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
          </label>
          <button type="submit" className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            Filtrar
          </button>
        </form>
        {gestao && (
          <Link href="/pulse/nova" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" aria-hidden /> Nova pesquisa
          </Link>
        )}
      </div>

      {pesquisas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma pesquisa"
          descricao={gestao ? "Crie a primeira a partir de um template (eNPS, Pulso Mensal, Clima…) ou do zero." : "Quando o RH enviar pesquisas, os resultados agregados aparecem aqui."}
          acao={
            gestao ? (
              <Link href="/pulse/nova" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                Nova pesquisa
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUNAS.filter((c) => gestao || c !== "rascunho").map((coluna) => {
            const lista = pesquisas.filter((p) => p.status === coluna);
            return (
              <section key={coluna} id={`coluna-${coluna}`} aria-labelledby={`t-${coluna}`} className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted/50 p-3">
                <h2 id={`t-${coluna}`} className="flex items-center justify-between px-1 text-sm font-semibold">
                  {STATUS_PESQUISA[coluna].nome}
                  <span className="rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground">{lista.length}</span>
                </h2>
                {lista.length === 0 && <p className="px-1 pb-2 text-xs text-muted-foreground">Nenhuma pesquisa.</p>}
                <ul className="flex flex-col gap-3">
                  {lista.map((p) => {
                    const a = adesoes.get(p.id);
                    const pct = a && a.publico ? Math.min(100, Math.round((a.respondentes / a.publico) * 100)) : 0;
                    const vencida = p.status === "aberta" && p.encerraEm && p.encerraEm < h;
                    return (
                      <li key={p.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/pulse/${p.id}`} className="font-heading font-bold leading-snug hover:text-teal-strong">
                            {p.titulo}
                          </Link>
                          <Selo tom={p.anonima ? "info" : "neutro"}>{p.anonima ? "Anônima" : "Identificada"}</Selo>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {AUDIENCIA[p.audienciaTipo as keyof typeof AUDIENCIA] ?? p.audienciaTipo} · {p._count.perguntas} pergunta(s)
                          {p.encerraEm && <> · até {formatarData(p.encerraEm)}</>}
                          {p.status === "encerrada" && p.encerradaEm && <> · encerrada em {formatarData(p.encerradaEm)}</>}
                        </p>
                        {a && (
                          <div className="flex flex-col gap-1">
                            <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                              <span className="block h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {a.respondentes}/{a.publico} responderam · {pct}%{vencida && <strong className="text-destructive"> · prazo vencido</strong>}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {p.status === "rascunho" && gestao && (
                            <Link href={`/pulse/${p.id}/editar`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted">
                              <Pencil className="size-4" aria-hidden /> Editar
                            </Link>
                          )}
                          {p.status !== "rascunho" && (
                            <Link href={`/pulse/${p.id}?tab=resultados`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted">
                              <BarChart3 className="size-4" aria-hidden /> Ver resultados
                            </Link>
                          )}
                          {p.status === "aberta" && gestao && <CopiarLink url={urlResposta(p.id)} compacto />}
                          {p.status === "aberta" && gestao && <BotaoPesquisa acao="encerrar" id={p.id} compacto />}
                          {gestao && <BotaoPesquisa acao="duplicar" id={p.id} compacto aoConcluir="abrir" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
