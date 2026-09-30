import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, ClipboardPlus } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje as hojeCivil, somarDias } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import { ESTADO_CADENCIA, SEMAFORO, umaCasa, type SemaforoCor } from "@/lib/feedback/avaliacao";
import { filtroAvaliacoes } from "@/lib/feedback/regras";
import { carregarCadencia, ordenarPorCadencia } from "@/lib/feedback/consultas";
import { EstadoVazio, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao, LinkExportar } from "@/components/app/painel";
import type { Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = { title: "Feedback 1:1" };

const PERIODOS = { "30": "Últimos 30 dias", "90": "Últimos 90 dias", "365": "Últimos 12 meses", todos: "Todo o histórico" } as const;
const ORDENS = { semaforo: "Atenção primeiro (vermelho → verde)", semaforo_asc: "Verde → vermelho", recentes: "Mais recentes" } as const;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function Barra({ valor, max, rotulo }: { valor: number; max: number; rotulo: string }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={rotulo}>
      <span className="block h-full rounded-full bg-teal" style={{ width: `${max ? Math.round((valor / max) * 100) : 0}%` }} />
    </span>
  );
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("feedback");
  const sp = await searchParams;
  const h = hojeCivil();
  const periodo = valorPermitido(sp.periodo, PERIODOS) ?? "90";
  const status = valorPermitido(sp.status, SEMAFORO) as SemaforoCor | undefined;
  const ordem = valorPermitido(sp.ordem, ORDENS) ?? "semaforo";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const pagina = paginaDe(sp.pagina);
  const areas = await db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const departamento = areas.find((a) => a.id === sp.departamento)?.id;

  const where: Prisma.AvaliacaoFeedbackWhereInput = {
    AND: [
      filtroAvaliacoes(ctx, escopo),
      periodo === "todos" ? {} : { data: { gte: somarDias(h, -Number(periodo)) } },
      status ? { semaforo: status } : {},
      departamento ? { colaborador: { equipe: { areaId: departamento } } } : {},
      q ? { colaborador: { nome: { contains: q, mode: "insensitive" } } } : {},
    ],
  };
  const orderBy: Prisma.AvaliacaoFeedbackOrderByWithRelationInput[] =
    ordem === "recentes" ? [{ data: "desc" }] : ordem === "semaforo" ? [{ semaforo: "desc" }, { mediaGeral: "asc" }] : [{ semaforo: "asc" }, { mediaGeral: "desc" }];

  const [total, lista, agregado, cadencia] = await Promise.all([
    db.avaliacaoFeedback.count({ where }),
    db.avaliacaoFeedback.findMany({
      where,
      include: { colaborador: { select: { nome: true, cargo: true, equipe: { select: { nome: true, area: { select: { nome: true } } } } } }, gestor: { select: { nome: true } } },
      orderBy,
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.avaliacaoFeedback.findMany({
      where,
      select: { data: true, mediaGeral: true, semaforo: true, colaborador: { select: { equipe: { select: { area: { select: { nome: true } } } } } } },
      take: 5000,
    }),
    carregarCadencia(ctx, escopo),
  ]);

  const media = agregado.length ? agregado.reduce((n, a) => n + Number(a.mediaGeral), 0) / agregado.length : null;
  const dist = { verde: 0, amarelo: 0, vermelho: 0 } as Record<SemaforoCor, number>;
  for (const a of agregado) dist[a.semaforo]++;
  const porMes = new Map<string, number[]>();
  const porDep = new Map<string, number[]>();
  for (const a of agregado) {
    const chave = a.data.toISOString().slice(0, 7);
    porMes.set(chave, [...(porMes.get(chave) ?? []), Number(a.mediaGeral)]);
    const dep = a.colaborador.equipe?.area?.nome ?? "Sem departamento";
    porDep.set(dep, [...(porDep.get(dep) ?? []), Number(a.mediaGeral)]);
  }
  const evolucao = [...porMes].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([m, v]) => ({ m, n: v.length, media: v.reduce((x, y) => x + y, 0) / v.length }));
  const departamentos = [...porDep].map(([d, v]) => ({ d, n: v.length, media: v.reduce((x, y) => x + y, 0) / v.length })).sort((a, b) => a.media - b.media);
  const atencao = cadencia.filter((c) => c.cadencia.estado === "atrasado" || c.cadencia.estado === "proximo").sort(ordenarPorCadencia);
  const podeCriar = !!pode(ctx, "feedback", "criar") && !ctx.suporte;
  const params = { periodo, status, ordem, q: q || undefined, departamento };

  return (
    <>
      {sp.excluido && (
        <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          Feedback excluído.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">{escopo === "todos" ? "Feedbacks da organização" : "Feedbacks da sua equipe"}</h2>
        <div className="flex flex-wrap gap-2">
          {pode(ctx, "feedback", "exportar") && <LinkExportar href="/feedback/exportar" />}
          {podeCriar && (
            <>
              <Link href="/feedback/agendar" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                <CalendarPlus className="size-4" aria-hidden /> Agendar 1:1
              </Link>
              <Link href="/feedback/novo" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <ClipboardPlus className="size-4" aria-hidden /> Novo feedback
              </Link>
            </>
          )}
        </div>
      </div>

      <form role="search" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-semibold text-muted-foreground">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nome do colaborador" className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56" />
        </div>
        {[
          { nome: "periodo", rotulo: "Período", valor: periodo, opcoes: Object.entries(PERIODOS), vazio: null },
          { nome: "departamento", rotulo: "Departamento", valor: departamento ?? "", opcoes: areas.map((a) => [a.id, a.nome]), vazio: "Todos" },
          { nome: "status", rotulo: "Status", valor: status ?? "", opcoes: (["vermelho", "amarelo", "verde"] as const).map((s) => [s, SEMAFORO[s].nome]), vazio: "Todos" },
          { nome: "ordem", rotulo: "Ordenar por", valor: ordem, opcoes: Object.entries(ORDENS), vazio: null },
        ].map((f) => (
          <div key={f.nome} className="flex flex-col gap-1">
            <label htmlFor={`f-${f.nome}`} className="text-xs font-semibold text-muted-foreground">{f.rotulo}</label>
            <select id={`f-${f.nome}`} name={f.nome} defaultValue={f.valor} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
              {f.vazio && <option value="">{f.vazio}</option>}
              {f.opcoes.map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
        ))}
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Filtrar</button>
      </form>

      <section aria-label="Indicadores do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Feedbacks no período</p>
          <p className="font-heading text-[28px] font-bold tabular-nums">{agregado.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Média geral</p>
          <p className="font-heading text-[28px] font-bold tabular-nums">{media === null ? "—" : umaCasa(media)}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Distribuição do semáforo</p>
          <ul className="mt-2 grid grid-cols-3 gap-2 text-sm">
            {(["vermelho", "amarelo", "verde"] as const).map((s) => (
              <li key={s} className="flex flex-col gap-1">
                <Selo tom={SEMAFORO[s].tom}>{SEMAFORO[s].nome.split(" · ")[0]}</Selo>
                <span className="font-heading text-lg font-bold tabular-nums">{dist[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,380px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="lista" className="flex flex-col gap-3">
            <h3 id="lista" className="font-heading text-base font-bold">Feedbacks registrados</h3>
            {lista.length === 0 ? (
              <EstadoVazio
                titulo={q || status || departamento ? "Nenhum feedback com esses filtros" : "Nenhum feedback no período"}
                descricao="Registre um feedback após a conversa 1:1: 16 critérios de Performance e Cultura, com médias e semáforo."
                acao={podeCriar ? <Link href="/feedback/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Novo feedback</Link> : undefined}
              />
            ) : (
              <Tabela colunas={["Colaborador", "Departamento", "Gestor", "Data", "Perf.", "Cult.", "Geral", "Status"]} minWidth={900}>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <Celula>
                      <span className="flex items-center gap-3">
                        <Iniciais nome={a.colaborador.nome} />
                        <span className="min-w-0">
                          <Link href={`/feedback/avaliacoes/${a.id}`} className="font-medium hover:text-teal-strong">{a.colaborador.nome}</Link>
                          <span className="block text-xs text-muted-foreground">{a.colaborador.cargo ?? "—"}</span>
                        </span>
                      </span>
                    </Celula>
                    <Celula className="text-muted-foreground">{a.colaborador.equipe?.area?.nome ?? a.colaborador.equipe?.nome ?? "—"}</Celula>
                    <Celula className="text-muted-foreground">{a.gestor?.nome ?? "—"}</Celula>
                    <Celula className="tabular-nums">{formatarData(a.data)}</Celula>
                    <Celula className="tabular-nums">{umaCasa(a.mediaPerformance)}</Celula>
                    <Celula className="tabular-nums">{umaCasa(a.mediaCultura)}</Celula>
                    <Celula className="font-semibold tabular-nums">{umaCasa(a.mediaGeral)}</Celula>
                    <Celula><Selo tom={SEMAFORO[a.semaforo].tom}>{SEMAFORO[a.semaforo].nome}</Selo></Celula>
                  </tr>
                ))}
              </Tabela>
            )}
            <Paginacao pagina={pagina} total={total} params={params} />
          </section>

          {escopo === "equipe" && (
            <section aria-labelledby="time" className="flex flex-col gap-3">
              <h3 id="time" className="font-heading text-base font-bold">Seu time</h3>
              {cadencia.length === 0 ? (
                <EstadoVazio titulo="Nenhum liderado ativo" descricao="Pessoas com você como gestor direto no cadastro aparecem aqui." />
              ) : (
                <Tabela colunas={["Pessoa", "Último feedback", "Próxima data", "Cadência"]} minWidth={640}>
                  {cadencia.map((c) => (
                    <tr key={c.id}>
                      <Celula><span className="font-medium">{c.nome}</span><span className="block text-xs text-muted-foreground">{c.cargo ?? "—"}</span></Celula>
                      <Celula>
                        {c.ultimo ? (
                          <Link href={`/feedback/avaliacoes/${c.ultimo.id}`} className="flex items-center gap-2 hover:text-teal-strong">
                            {formatarData(c.ultimo.data)} <Selo tom={SEMAFORO[c.ultimo.semaforo].tom}>{SEMAFORO[c.ultimo.semaforo].nome.split(" · ")[0]}</Selo>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Nunca</span>
                        )}
                      </Celula>
                      <Celula className="tabular-nums">{c.cadencia.proxima ? formatarData(c.cadencia.proxima) : "—"}</Celula>
                      <Celula><Selo tom={ESTADO_CADENCIA[c.cadencia.estado].tom}>{ESTADO_CADENCIA[c.cadencia.estado].nome}</Selo></Celula>
                    </tr>
                  ))}
                </Tabela>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Cartao aria-labelledby="cadencia">
            <CabecalhoCartao id="cadencia" titulo="Cadência: próximos e atrasados" descricao="Cadência sugerida de 30 dias ou a periodicidade do último feedback." />
            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {atencao.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Todos em dia.</li>}
              {atencao.slice(0, 12).map((c) => (
                <li key={c.id} id={`cadencia-${c.id}`} className="flex flex-col gap-2 px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.ultimo ? `Último: ${formatarData(c.ultimo.data)}` : "Sem feedback — referência: data de entrada"} · previsto {formatarData(c.cadencia.proxima!)}
                      </span>
                    </span>
                    <Selo tom={ESTADO_CADENCIA[c.cadencia.estado].tom}>
                      {c.cadencia.estado === "atrasado" ? `Atrasado ${-c.cadencia.dias!} d` : c.cadencia.dias === 0 ? "Hoje" : `Em ${c.cadencia.dias} d`}
                    </Selo>
                  </div>
                  {podeCriar && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/feedback/novo?colaborador=${c.id}`} className="font-medium text-teal-strong hover:underline">Registrar feedback</Link>
                      {c.proximo1a1 ? (
                        <Link href={`/feedback/${c.proximo1a1.id}`} className="text-muted-foreground hover:underline">1:1 agendado</Link>
                      ) : (
                        <Link href={`/feedback/agendar?colaborador=${c.id}`} className="font-medium text-teal-strong hover:underline">Agendar 1:1</Link>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Cartao>

          {evolucao.length >= 2 && (
            <Cartao aria-labelledby="evolucao">
              <CabecalhoCartao id="evolucao" titulo="Evolução da média geral" descricao="Por mês, no período filtrado." />
              <ul className="flex flex-col gap-2 px-5 pb-5 text-sm">
                {evolucao.map((e) => (
                  <li key={e.m} className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-3">
                    <span className="text-muted-foreground">{MESES[Number(e.m.slice(5)) - 1]}/{e.m.slice(2, 4)}</span>
                    <Barra valor={e.media} max={5} rotulo={`Média ${umaCasa(e.media)} em ${e.m}`} />
                    <span className="text-right tabular-nums">{umaCasa(e.media)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          {departamentos.length >= 2 && (
            <Cartao aria-labelledby="deps">
              <CabecalhoCartao id="deps" titulo="Por departamento" descricao="Média geral no período." />
              <ul className="flex flex-col gap-2 px-5 pb-5 text-sm">
                {departamentos.map((d) => (
                  <li key={d.d} className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-3">
                    <span className="truncate">{d.d} <span className="text-xs text-muted-foreground">({d.n})</span></span>
                    <Barra valor={d.media} max={5} rotulo={`Média ${umaCasa(d.media)} em ${d.d}`} />
                    <span className="text-right tabular-nums">{umaCasa(d.media)}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
