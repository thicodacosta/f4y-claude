import Link from "next/link";
import type { Metadata } from "next";
import { Ban, CalendarClock, Clock, DoorOpen, LayoutGrid, List, Plus, TriangleAlert, UserRound, Users } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje as hojeCivil } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { valorPermitido } from "@/lib/validacao";
import { faseAtual, PENDENTES, RESPONSAVEL, ritmo, SITUACAO, situacao, sinais, type Situacao } from "@/lib/onboarding/calculo";
import { FILTRO_SITUACAO, filtroOnboardings, filtroSituacao } from "@/lib/onboarding/regras";
import { buscarAlertas, contarAlertas } from "@/lib/onboarding/alertas";
import { BarraProgresso } from "@/components/secao";
import { EstadoVazio, Iniciais, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao, ItemAtividade, LinkExportar } from "@/components/app/painel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

const VISOES = { lista: { nome: "Lista", icone: List }, kanban: { nome: "Kanban", icone: LayoutGrid }, painel: { nome: "Painel", icone: CalendarClock } } as const;

type Card = {
  id: string;
  nome: string;
  cargo: string | null;
  gestor: string | null;
  sit: Situacao;
  progresso: number;
  fase: string;
  inicio: Date;
  alertas: { atrasadas: number; bloqueadas: number; proximas: number };
};

function CartaoOnboarding({ c, compacto = false }: { c: Card; compacto?: boolean }) {
  return (
    <Link href={`/onboarding/${c.id}`} className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface transition-shadow outline-none hover:shadow-hover focus-visible:ring-3 focus-visible:ring-ring/50">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <Iniciais nome={c.nome} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{c.nome}</span>
            <span className="block truncate text-xs text-muted-foreground">{c.cargo ?? "Cargo não informado"}</span>
          </span>
        </span>
        {!compacto && <Selo tom={SITUACAO[c.sit].tom}>{SITUACAO[c.sit].nome}</Selo>}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Gestor</dt>
          <dd className="truncate font-medium">{c.gestor ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{c.sit === "nao_iniciado" ? "Início" : "Fase atual"}</dt>
          <dd className="truncate font-medium">{c.sit === "nao_iniciado" ? formatarData(c.inicio) : c.fase}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span className="tabular-nums">{c.progresso}%</span>
        </div>
        <BarraProgresso valor={c.progresso} rotulo={`Progresso do onboarding de ${c.nome}`} />
      </div>
      {(c.alertas.atrasadas > 0 || c.alertas.bloqueadas > 0 || c.alertas.proximas > 0) && (
        <p className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {c.alertas.atrasadas > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
              <TriangleAlert className="size-3" aria-hidden /> {c.alertas.atrasadas} atrasada(s)
            </span>
          )}
          {c.alertas.bloqueadas > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
              <Ban className="size-3" aria-hidden /> {c.alertas.bloqueadas} bloqueada(s)
            </span>
          )}
          {c.alertas.proximas > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-warning-foreground dark:text-warning">
              <Clock className="size-3" aria-hidden /> {c.alertas.proximas} vencendo
            </span>
          )}
        </p>
      )}
    </Link>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("onboarding");
  const sp = await searchParams;
  const visao = valorPermitido(sp.visao, VISOES) ?? "lista";
  const sitFiltro = valorPermitido(sp.status, FILTRO_SITUACAO);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const pagina = paginaDe(sp.pagina);
  const h = hojeCivil();
  const escopoFiltro = filtroOnboardings(ctx, escopo);
  const busca = q ? { colaborador: { OR: [{ nome: { contains: q, mode: "insensitive" as const } }, { cargo: { contains: q, mode: "insensitive" as const } }] } } : {};
  const where = { AND: [escopoFiltro, filtroSituacao(sitFiltro, h), busca] };
  const paginar = visao === "lista";

  const [total, naoIniciados, emAndamento, concluidos, filtrados, lista] = await Promise.all([
    db.onboarding.count({ where: { AND: [escopoFiltro, filtroSituacao(undefined, h)] } }),
    db.onboarding.count({ where: { AND: [escopoFiltro, filtroSituacao("nao_iniciado", h)] } }),
    db.onboarding.count({ where: { AND: [escopoFiltro, filtroSituacao("em_andamento", h)] } }),
    db.onboarding.count({ where: { AND: [escopoFiltro, filtroSituacao("concluido", h)] } }),
    db.onboarding.count({ where }),
    db.onboarding.findMany({
      where,
      include: {
        colaborador: { select: { nome: true, cargo: true, gestor: { select: { nome: true } } } },
        fases: { select: { nome: true, marcoDias: true, ordem: true } },
        tarefas: { select: { status: true, prazo: true, responsavelTipo: true } },
      },
      orderBy: [{ inicio: "desc" }],
      ...(paginar ? { skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA } : { take: 300 }),
    }),
  ]);

  const cards: (Card & { ritmoEstado: string; tarefas: typeof lista[number]["tarefas"] })[] = lista.map((o) => {
    const sit = situacao(o, h);
    const ativo = sit === "em_andamento";
    const sin = o.tarefas.map((t) => sinais(t, h));
    return {
      id: o.id,
      nome: o.colaborador.nome,
      cargo: o.colaborador.cargo,
      gestor: o.colaborador.gestor?.nome ?? null,
      sit,
      progresso: o.progresso,
      fase: faseAtual(o.fases, o.inicio, h)?.nome ?? "—",
      inicio: o.inicio,
      alertas: ativo
        ? { atrasadas: sin.filter((s) => s.atrasada).length, bloqueadas: sin.filter((s) => s.bloqueada).length, proximas: sin.filter((s) => s.venceHoje || s.proxima).length }
        : { atrasadas: 0, bloqueadas: 0, proximas: 0 },
      ritmoEstado: ativo ? ritmo(o.tarefas, o.inicio, h).estado : "—",
      tarefas: o.tarefas,
    };
  });

  const podeCriar = pode(ctx, "onboarding", "criar") === "todos" && !ctx.suporte;
  const alertas = visao === "painel" ? await buscarAlertas(ctx, escopo) : [];
  const url = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ q: q || undefined, status: sitFiltro, visao: visao === "lista" ? undefined : visao, ...extra }).filter(([, v]) => v) as [string, string][]);
    const s = u.toString();
    return `/onboarding${s ? `?${s}` : ""}`;
  };
  const kpis = [
    { rotulo: "Total", valor: total, status: undefined, detalhe: "exceto cancelados" },
    { rotulo: "Não iniciados", valor: naoIniciados, status: "nao_iniciado", detalhe: "com início futuro" },
    { rotulo: "Em andamento", valor: emAndamento, status: "em_andamento", detalhe: "em curso" },
    { rotulo: "Concluídos", valor: concluidos, status: "concluido", detalhe: "todas as obrigatórias feitas" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">{escopo === "todos" ? "Onboardings da organização" : "Onboardings da sua equipe"}</h2>
        <div className="flex flex-wrap gap-2">
          {pode(ctx, "onboarding", "exportar") && <LinkExportar href="/onboarding/exportar" />}
          {podeCriar && (
            <Link href="/onboarding/novo" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" aria-hidden /> Novo Onboarding
            </Link>
          )}
        </div>
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.rotulo}
            href={url({ status: k.status, pagina: undefined })}
            aria-current={sitFiltro === k.status || (!sitFiltro && !k.status) ? "true" : undefined}
            className={cn(
              "flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-surface transition-shadow hover:shadow-hover",
              sitFiltro === k.status || (!sitFiltro && !k.status) ? "border-teal" : "border-border",
            )}
          >
            <span className="text-[13px] font-medium text-muted-foreground">{k.rotulo}</span>
            <span className="font-heading text-[28px] leading-none font-bold tabular-nums">{k.valor}</span>
            <span className="text-xs text-muted-foreground">{k.detalhe}</span>
          </Link>
        ))}
      </section>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface lg:flex-row lg:items-end lg:justify-between">
        <form role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {visao !== "lista" && <input type="hidden" name="visao" value={visao} />}
          <div className="flex flex-col gap-1">
            <label htmlFor="q" className="text-xs font-semibold text-muted-foreground">
              Buscar
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="Nome ou cargo" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-64" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-xs font-semibold text-muted-foreground">
              Situação
            </label>
            <select id="status" name="status" defaultValue={sitFiltro ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">Todos (exceto cancelados)</option>
              {Object.entries(FILTRO_SITUACAO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Filtrar
          </button>
        </form>
        <nav aria-label="Visualização" className="flex w-max gap-1 rounded-md border border-border bg-background p-1">
          {Object.entries(VISOES).map(([v, d]) => (
            <Link
              key={v}
              href={url({ visao: v === "lista" ? undefined : v, pagina: undefined })}
              aria-current={visao === v ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                visao === v && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <d.icone className="size-4" aria-hidden /> {d.nome}
            </Link>
          ))}
        </nav>
      </div>

      {visao === "lista" &&
        (cards.length === 0 ? (
          <EstadoVazio
            titulo={q || sitFiltro ? "Nenhum onboarding com esses filtros" : "Nenhum onboarding ainda"}
            descricao={podeCriar ? "Crie um onboarding ou cadastre uma pessoa — com o módulo ativo, o onboarding é criado automaticamente." : "Quando houver onboardings de pessoas da sua equipe, eles aparecem aqui."}
            acao={
              podeCriar ? (
                <Link href="/onboarding/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  Novo Onboarding
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((c) => (
                <li key={c.id}>
                  <CartaoOnboarding c={c} />
                </li>
              ))}
            </ul>
            <Paginacao pagina={pagina} total={filtrados} params={{ q: q || undefined, status: sitFiltro }} />
          </>
        ))}

      {visao === "kanban" && (
        <div className="grid gap-3 md:grid-cols-3">
          {(["nao_iniciado", "em_andamento", "concluido"] as const).map((col) => {
            const daColuna = cards.filter((c) => c.sit === col);
            return (
              <section key={col} aria-label={`${SITUACAO[col].nome} (${daColuna.length})`} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3">
                <header className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold">{SITUACAO[col].nome}</h3>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{daColuna.length}</span>
                </header>
                {daColuna.map((c) => (
                  <CartaoOnboarding key={c.id} c={c} compacto />
                ))}
                {daColuna.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nenhum</p>}
              </section>
            );
          })}
        </div>
      )}

      {visao === "painel" && (
        <PainelOnboarding cards={cards} alertas={alertas} />
      )}
    </>
  );
}

function PainelOnboarding({
  cards,
  alertas,
}: {
  cards: (Card & { ritmoEstado: string; tarefas: { status: string; prazo: Date; responsavelTipo: "rh" | "gestor" | "colaborador" }[] })[];
  alertas: Awaited<ReturnType<typeof buscarAlertas>>;
}) {
  const h = hojeCivil();
  const ativos = cards.filter((c) => c.sit === "em_andamento");
  const c = contarAlertas(alertas);
  const porFase = new Map<string, number>();
  for (const a of ativos) porFase.set(a.fase, (porFase.get(a.fase) ?? 0) + 1);
  const media = ativos.length ? Math.round(ativos.reduce((n, a) => n + a.progresso, 0) / ativos.length) : 0;
  const emDia = ativos.filter((a) => a.ritmoEstado !== "atras").length;
  const porResp = (["rh", "gestor", "colaborador"] as const).map((r) => {
    const pend = ativos.flatMap((a) => a.tarefas).filter((t) => t.responsavelTipo === r && PENDENTES.includes(t.status as never));
    return { r, pendentes: pend.length, atrasadas: pend.filter((t) => t.prazo < h).length };
  });
  const grupos = [
    { titulo: "Atrasadas", n: c.atrasadas, lista: alertas.filter((a) => a.sinais.atrasada), icone: TriangleAlert, alerta: true },
    { titulo: "Vencem hoje", n: c.hoje, lista: alertas.filter((a) => a.sinais.venceHoje), icone: Clock, alerta: false },
    { titulo: "Vencem em até 3 dias", n: c.proximas, lista: alertas.filter((a) => a.sinais.proxima), icone: CalendarClock, alerta: false },
    { titulo: "Bloqueadas", n: c.bloqueadas, lista: alertas.filter((a) => a.sinais.bloqueada), icone: Ban, alerta: true },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <Cartao key={g.titulo} aria-label={g.titulo}>
            <CabecalhoCartao titulo={`${g.titulo} (${g.n})`} />
            <div className="px-3 pb-3">
              {g.lista.length === 0 ? (
                <p className="px-2 pb-3 text-sm text-muted-foreground">Nenhuma.</p>
              ) : (
                <ul>
                  {g.lista.slice(0, 8).map((a) => (
                    <ItemAtividade
                      key={a.tarefaId}
                      href={`/onboarding/${a.onboardingId}#tarefa-${a.tarefaId}`}
                      icone={g.icone}
                      titulo={a.titulo}
                      subtitulo={`${a.colaborador} · ${RESPONSAVEL[a.responsavelTipo]}`}
                      valor={formatarData(a.prazo)}
                      alerta={g.alerta}
                    />
                  ))}
                </ul>
              )}
            </div>
          </Cartao>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <Cartao className="p-5">
          <p className="text-[13px] font-medium text-muted-foreground">Progresso médio (em andamento)</p>
          <p className="font-heading text-[28px] font-bold tabular-nums">{media}%</p>
          <BarraProgresso valor={media} rotulo="Progresso médio" />
          <p className="mt-2 text-xs text-muted-foreground">
            {emDia} de {ativos.length} em dia com os prazos esperados até hoje.
          </p>
        </Cartao>
        <Cartao aria-label="Por fase atual">
          <CabecalhoCartao titulo="Em andamento por fase" />
          <ul className="flex flex-col gap-2 px-5 pb-5 text-sm">
            {[...porFase].map(([f, n]) => (
              <li key={f} className="flex justify-between">
                <span className="flex items-center gap-2">
                  <DoorOpen className="size-4 text-muted-foreground" aria-hidden /> {f}
                </span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
            {porFase.size === 0 && <li className="text-muted-foreground">Nenhum onboarding em andamento.</li>}
          </ul>
        </Cartao>
        <Cartao aria-label="Pendências por responsável">
          <CabecalhoCartao titulo="Pendências por responsável" />
          <ul className="flex flex-col gap-2 px-5 pb-5 text-sm">
            {porResp.map((p) => (
              <li key={p.r} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {p.r === "colaborador" ? <UserRound className="size-4 text-muted-foreground" aria-hidden /> : <Users className="size-4 text-muted-foreground" aria-hidden />}
                  {RESPONSAVEL[p.r]}
                </span>
                <span className="tabular-nums">
                  {p.pendentes} pendente(s){p.atrasadas ? <strong className="text-destructive"> · {p.atrasadas} atrasada(s)</strong> : ""}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </div>
  );
}
