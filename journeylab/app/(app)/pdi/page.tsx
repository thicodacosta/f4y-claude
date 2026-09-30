import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Plus, Target, TrendingUp } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import { acaoVencida, calcularPdi, formatarBRL, STATUS_PDI, TIPO_ACAO, type StatusPdiCalculado, type TipoAcao } from "@/lib/pdi/calculo";
import { nomeFoco } from "@/lib/pdi/focos";
import { COM_ACOES, filtroPdis } from "@/lib/pdi/regras";
import { BarraProgresso } from "@/components/secao";
import { BarraBusca, EstadoVazio, FiltroSelect, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Celula, Tabela } from "@/components/app/tabela";
import { Cartao, CabecalhoCartao, CartaoKpi, LinkExportar } from "@/components/app/painel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "PDI" };

const ABAS = { lista: "Lista", kanban: "Kanban", dashboard: "Dashboard" } as const;
const ORDEM: StatusPdiCalculado[] = ["em_risco", "em_andamento", "concluido"];

export default async function PdiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("pdi");
  const sp = await searchParams;
  const podeCriar = !!pode(ctx, "pdi", "criar") && !ctx.suporte;
  if (sp.action === "create") {
    const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "action"));
    redirect(podeCriar ? `/pdi/novo${q.size ? `?${q}` : ""}` : "/pdi");
  }
  const aba = valorPermitido(sp.tab, ABAS) ?? "lista";
  const status = valorPermitido(sp.status, STATUS_PDI) as StatusPdiCalculado | undefined;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const pagina = paginaDe(sp.pagina);
  const h = hoje();

  const areas = await db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const departamento = areas.find((a) => a.id === sp.departamento)?.id;
  const brutos = await db.pdi.findMany({
    where: {
      AND: [
        filtroPdis(ctx, escopo),
        q ? { colaborador: { nome: { contains: q, mode: "insensitive" } } } : {},
        departamento ? { colaborador: { equipe: { areaId: departamento } } } : {},
      ],
    },
    include: { ...COM_ACOES, colaborador: { select: { id: true, nome: true, cargo: true, equipe: { select: { nome: true, area: { select: { nome: true } } } } } } },
    orderBy: { criadoEm: "desc" },
    take: 500,
  });
  const todos = brutos.map((p) => ({ p, c: calcularPdi(p.focos, h) }));
  const pdis = todos.filter((x) => !status || x.c.status === status).sort((a, b) => STATUS_PDI[a.c.status].ordem - STATUS_PDI[b.c.status].ordem || a.p.fim.getTime() - b.p.fim.getTime());
  const conta = (s: StatusPdiCalculado) => todos.filter((x) => x.c.status === s).length;
  const mediaProgresso = todos.length ? Math.round(todos.reduce((s, x) => s + x.c.progresso, 0) / todos.length) : 0;
  const vencidas = todos
    .flatMap(({ p }) => p.focos.flatMap((f) => f.acoes.filter((a) => acaoVencida(a, h)).map((a) => ({ a, p }))))
    .sort((x, y) => x.a.prazo!.getTime() - y.a.prazo!.getTime());
  const params = { tab: aba === "lista" ? undefined : aba, status, q: q || undefined, departamento };
  const href = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...params, ...extra }).filter((e): e is [string, string] => !!e[1]));
    return `/pdi${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CartaoKpi rotulo="PDIs" valor={String(todos.length)} detalhe={escopo === "todos" ? "Toda a empresa" : "Seus liderados diretos"} href="/pdi" icone={Target} />
        <CartaoKpi rotulo="Em risco" valor={String(conta("em_risco"))} detalhe="Com ação vencida" href={href({ status: "em_risco", pagina: undefined })} icone={AlertTriangle} alerta={conta("em_risco") > 0} />
        <CartaoKpi rotulo="Em andamento" valor={String(conta("em_andamento"))} detalhe="Dentro dos prazos" href={href({ status: "em_andamento", pagina: undefined })} icone={Clock} />
        <CartaoKpi rotulo="Concluídos" valor={String(conta("concluido"))} detalhe="Todas as ações concluídas" href={href({ status: "concluido", pagina: undefined })} icone={CheckCircle2} />
        <CartaoKpi rotulo="Progresso médio" valor={`${mediaProgresso}%`} detalhe="Média dos planos" href="/pdi?tab=dashboard" icone={TrendingUp} progresso={mediaProgresso} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Visualização" className="max-w-full overflow-x-auto">
          <ul className="flex w-max gap-1 rounded-md border border-border bg-card p-1 shadow-surface">
            {(Object.keys(ABAS) as (keyof typeof ABAS)[]).map((a) => (
              <li key={a}>
                <Link
                  href={href({ tab: a === "lista" ? undefined : a, pagina: undefined })}
                  aria-current={aba === a ? "page" : undefined}
                  className={cn("inline-flex h-8 items-center rounded-sm px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground", aba === a && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}
                >
                  {ABAS[a]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {pode(ctx, "pdi", "exportar") && <LinkExportar href="/pdi/exportar" />}
          {podeCriar && (
            <Link href="/pdi/novo" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" aria-hidden /> Novo PDI
            </Link>
          )}
        </div>
      </div>

      <BarraBusca q={q} placeholder="Buscar por colaborador">
        {aba !== "lista" && <input type="hidden" name="tab" value={aba} />}
        <FiltroSelect nome="status" rotulo="Status" valor={status} opcoes={ORDEM.map((s) => ({ valor: s, rotulo: STATUS_PDI[s].nome }))} />
        <FiltroSelect nome="departamento" rotulo="Departamento" valor={departamento} opcoes={areas.map((a) => ({ valor: a.id, rotulo: a.nome }))} />
      </BarraBusca>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,340px)]">
        <div className="flex min-w-0 flex-col gap-3">
          {todos.length === 0 ? (
            <EstadoVazio
              titulo="Nenhum PDI"
              descricao={podeCriar ? "Crie o primeiro plano: escolha o colaborador, os focos de desenvolvimento e as ações." : "Quando houver planos no seu escopo, eles aparecem aqui."}
              acao={
                podeCriar ? (
                  <Link href="/pdi/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                    Novo PDI
                  </Link>
                ) : undefined
              }
            />
          ) : aba === "lista" ? (
            <>
              {pdis.length === 0 ? (
                <EstadoVazio titulo="Nenhum PDI com estes filtros" descricao="Ajuste a busca ou os filtros." />
              ) : (
                <Tabela colunas={["Colaborador", "Plano", "Período", "Status", "Progresso"]} minWidth={780}>
                  {pdis.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(({ p, c }) => (
                    <tr key={p.id}>
                      <Celula>
                        <span className="flex items-center gap-3">
                          <Iniciais nome={p.colaborador.nome} />
                          <span className="min-w-0">
                            <span className="block font-medium">{p.colaborador.nome}</span>
                            <span className="block text-xs text-muted-foreground">{[p.colaborador.cargo, p.colaborador.equipe?.area?.nome].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                        </span>
                      </Celula>
                      <Celula>
                        <Link href={`/pdi/${p.id}`} className="font-medium hover:text-teal-strong">
                          {p.titulo}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{p.focos.map((f) => nomeFoco(f.focoChave, f.nomePersonalizado)).join(" · ") || "Sem focos"}</span>
                      </Celula>
                      <Celula className="text-xs tabular-nums text-muted-foreground">
                        {formatarData(p.inicio)} – {formatarData(p.fim)}
                      </Celula>
                      <Celula>
                        <Selo tom={STATUS_PDI[c.status].tom}>{STATUS_PDI[c.status].nome}</Selo>
                        {c.vencidas > 0 && <span className="mt-1 block text-xs font-medium text-destructive">{c.vencidas} ação(ões) vencida(s)</span>}
                        {c.incompleto && <span className="mt-1 block text-xs text-muted-foreground">Plano incompleto</span>}
                      </Celula>
                      <Celula className="w-40">
                        <span className="mb-1 block text-xs tabular-nums text-muted-foreground">{c.progresso}%</span>
                        <BarraProgresso valor={c.progresso} rotulo={`Progresso do PDI de ${p.colaborador.nome}`} />
                      </Celula>
                    </tr>
                  ))}
                </Tabela>
              )}
              <Paginacao pagina={pagina} total={pdis.length} params={{ ...params, tab: undefined }} />
            </>
          ) : aba === "kanban" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {ORDEM.filter((s) => !status || s === status).map((s) => {
                const lista = pdis.filter((x) => x.c.status === s);
                return (
                  <section key={s} aria-labelledby={`col-${s}`} className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted/50 p-3">
                    <h2 id={`col-${s}`} className="flex items-center justify-between px-1 text-sm font-semibold">
                      <Selo tom={STATUS_PDI[s].tom}>{STATUS_PDI[s].nome}</Selo>
                      <span className="rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground">{lista.length}</span>
                    </h2>
                    {lista.length === 0 && <p className="px-1 pb-2 text-xs text-muted-foreground">Nenhum PDI.</p>}
                    <ul className="flex flex-col gap-3">
                      {lista.map(({ p, c }) => (
                        <li key={p.id}>
                          <Link href={`/pdi/${p.id}`} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-surface hover:shadow-hover">
                            <span className="flex items-center gap-2">
                              <Iniciais nome={p.colaborador.nome} />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{p.colaborador.nome}</span>
                                <span className="block truncate text-xs text-muted-foreground">{p.titulo}</span>
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {c.progresso}% · {c.totalAcoes} ação(ões) · até {formatarData(p.fim)}
                            </span>
                            <BarraProgresso valor={c.progresso} rotulo={`Progresso do PDI de ${p.colaborador.nome}`} />
                            {c.vencidas > 0 && <span className="text-xs font-medium text-destructive">{c.vencidas} ação(ões) vencida(s)</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <p className="text-xs text-muted-foreground lg:col-span-3">O status é calculado pelas ações: para mover um PDI, atualize as ações no detalhe do plano.</p>
            </div>
          ) : (
            <Dashboard todos={todos} areas={areas} />
          )}
        </div>

        <Cartao aria-labelledby="atencao" className="h-fit">
          <CabecalhoCartao id="atencao" titulo="Atenção" descricao={`${conta("em_risco")} PDI(s) em risco · ${vencidas.length} ação(ões) vencida(s)`} />
          <ul className="flex flex-col gap-1 px-3 pb-3">
            {vencidas.length === 0 && <li className="px-2 pb-2 text-sm text-muted-foreground">Nenhuma ação vencida.</li>}
            {vencidas.slice(0, 8).map(({ a, p }) => (
              <li key={a.id}>
                <Link href={`/pdi/${p.id}#acao-${a.id}`} className="flex flex-col rounded-md px-2 py-2 hover:bg-muted">
                  <span className="truncate text-sm font-medium">{a.descricao}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.colaborador.nome} · <span className="font-medium text-destructive">venceu em {formatarData(a.prazo!)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {vencidas.length > 8 && (
              <li className="px-2 text-xs text-muted-foreground">
                <Link href={href({ status: "em_risco", tab: undefined })} className="font-medium text-teal-strong hover:underline">
                  Ver todos os PDIs em risco
                </Link>
              </li>
            )}
          </ul>
        </Cartao>
      </div>
    </>
  );
}

type Item = {
  p: { focos: { focoChave: string; nomePersonalizado: string | null; acoes: { tipo: string; investimento: { toString(): string } | null }[] }[]; colaborador: { equipe: { area: { nome: string } | null } | null } };
  c: ReturnType<typeof calcularPdi>;
};

function Barras({ itens, formato = (n: number) => String(n) }: { itens: { rotulo: string; valor: number; tom?: string }[]; formato?: (n: number) => string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground" title={i.rotulo}>
            {i.rotulo}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className={cn("block h-full rounded-full", i.tom ?? "bg-teal")} style={{ width: `${(i.valor / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{formato(i.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

function Dashboard({ todos, areas }: { todos: Item[]; areas: { id: string; nome: string }[] }) {
  const cor: Record<StatusPdiCalculado, string> = { em_risco: "bg-destructive", em_andamento: "bg-warning", concluido: "bg-success" };
  const acoes = todos.flatMap((x) => x.p.focos.flatMap((f) => f.acoes));
  const investimento = acoes.reduce((s, a) => s + (a.investimento ? Number(a.investimento.toString()) : 0), 0);
  const porDep = [...areas.map((a) => a.nome), "Sem departamento"]
    .map((nome) => {
      const doDep = todos.filter((x) => (x.p.colaborador.equipe?.area?.nome ?? "Sem departamento") === nome);
      return { rotulo: nome, valor: doDep.length ? Math.round(doDep.reduce((s, x) => s + x.c.progresso, 0) / doDep.length) : -1 };
    })
    .filter((x) => x.valor >= 0);
  const focos = new Map<string, number>();
  for (const x of todos) for (const f of x.p.focos) focos.set(nomeFoco(f.focoChave, f.nomePersonalizado), (focos.get(nomeFoco(f.focoChave, f.nomePersonalizado)) ?? 0) + 1);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao aria-labelledby="d-status" className="p-5">
        <h3 id="d-status" className="mb-3 font-heading font-bold">
          PDIs por status
        </h3>
        <Barras itens={ORDEM.map((s) => ({ rotulo: STATUS_PDI[s].nome, valor: todos.filter((x) => x.c.status === s).length, tom: cor[s] }))} />
      </Cartao>
      <Cartao aria-labelledby="d-dep" className="p-5">
        <h3 id="d-dep" className="mb-3 font-heading font-bold">
          Progresso médio por departamento
        </h3>
        {porDep.length ? <Barras itens={porDep} formato={(n) => `${n}%`} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </Cartao>
      <Cartao aria-labelledby="d-tipo" className="p-5">
        <h3 id="d-tipo" className="mb-3 font-heading font-bold">
          Ações por tipo
        </h3>
        <Barras itens={(Object.keys(TIPO_ACAO) as TipoAcao[]).map((t) => ({ rotulo: TIPO_ACAO[t], valor: acoes.filter((a) => a.tipo === t).length }))} />
        <p className="mt-4 text-sm">
          Investimento estimado total: <strong className="tabular-nums">{formatarBRL(investimento)}</strong>
        </p>
      </Cartao>
      <Cartao aria-labelledby="d-focos" className="p-5">
        <h3 id="d-focos" className="mb-3 font-heading font-bold">
          Focos mais frequentes
        </h3>
        {focos.size ? (
          <Barras
            itens={[...focos.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([rotulo, valor]) => ({ rotulo, valor }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sem focos cadastrados.</p>
        )}
      </Cartao>
    </div>
  );
}
