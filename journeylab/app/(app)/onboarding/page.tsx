import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroOnboardings, hojeSemHora, podeConcluirTarefa, RESPONSAVEL } from "@/lib/onboarding/regras";
import { iniciarOnboarding } from "@/lib/onboarding/actions";
import { valorPermitido } from "@/lib/validacao";
import { formatarData } from "@/lib/formato";
import { BarraProgresso } from "@/components/secao";
import { EstadoVazio, FiltroSelect, Paginacao, POR_PAGINA, paginaDe, Selo } from "@/components/app/lista";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";
import { LinkExportar } from "@/components/app/painel";

export const metadata: Metadata = { title: "Onboarding" };

const STATUS = { em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" } as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ctx, escopo, db } = await exigirModulo("onboarding");
  const sp = await searchParams;
  const pagina = paginaDe(sp.pagina);
  const status = valorPermitido(sp.status, STATUS) ?? "em_andamento";
  const hoje = hojeSemHora();
  const escopoConcluir = pode(ctx, "onboarding", "concluir");
  const where = { AND: [filtroOnboardings(ctx, escopo), { status }] };

  const [total, onboardings, minhas] = await Promise.all([
    db.onboarding.count({ where }),
    db.onboarding.findMany({
      where,
      include: {
        colaborador: { select: { nome: true, cargo: true } },
        tarefas: { select: { status: true, prazo: true } },
      },
      orderBy: { inicio: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    // Tarefas pendentes sob minha responsabilidade (ou de RH, se eu tiver escopo "todos").
    db.tarefaOnboarding.findMany({
      where: {
        status: "pendente",
        onboarding: { status: "em_andamento" },
        OR: [
          ...(ctx.colaboradorId ? [{ responsavelId: ctx.colaboradorId }] : []),
          ...(escopoConcluir === "todos" ? [{ responsavelTipo: "rh" as const }] : []),
        ],
      },
      include: { onboarding: { select: { id: true, colaborador: { select: { nome: true } } } } },
      orderBy: { prazo: "asc" },
      take: 20,
    }),
  ]);
  const minhasPermitidas = minhas.filter((t) => podeConcluirTarefa(ctx, escopoConcluir, t));

  const podeIniciar = pode(ctx, "onboarding", "criar") === "todos";
  const [pessoas, modelos] = podeIniciar
    ? await Promise.all([
        db.colaborador.findMany({
          where: { status: { not: "desligado" }, onboardings: { none: { status: "em_andamento" } } },
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        }),
        db.modeloOnboarding.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
      ])
    : [[], []];

  return (
    <>
      {minhasPermitidas.length > 0 && (
        <section aria-labelledby="minhas" className="flex flex-col gap-3">
          <h2 id="minhas" className="font-heading text-lg font-bold">Minhas tarefas pendentes</h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {minhasPermitidas.map((t) => {
              const atrasada = t.prazo < hoje;
              return (
                <li key={t.id}>
                  <Link href={`/onboarding/${t.onboarding.id}#tarefa-${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/50">
                    <span>
                      <span className="font-medium">{t.titulo}</span>
                      <span className="text-muted-foreground"> · {t.onboarding.colaborador.nome} · {RESPONSAVEL[t.responsavelTipo]}</span>
                    </span>
                    <span className={atrasada ? "flex items-center gap-1 font-medium text-destructive" : "text-muted-foreground"}>
                      {atrasada && <AlertTriangle className="size-3.5" aria-hidden />}
                      {atrasada ? "Atrasada · " : "Prazo "}
                      {formatarData(t.prazo)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="lista" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="lista" className="font-heading text-lg font-bold">
            {escopo === "proprio" ? "Meu onboarding" : "Onboardings"}
          </h2>
          <form className="flex items-end gap-2">
            {pode(ctx, "onboarding", "exportar") && <LinkExportar href="/onboarding/exportar" />}
            <FiltroSelect nome="status" rotulo="Situação" valor={status} opcoes={Object.entries(STATUS).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <button type="submit" className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Filtrar</button>
          </form>
        </div>
        {onboardings.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum onboarding nesta situação"
            descricao={podeIniciar ? "Inicie um onboarding abaixo ou pela conversão de um candidato no CRM." : "Quando houver um onboarding em que você participa, ele aparecerá aqui."}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {onboardings.map((o) => {
              const fechadas = o.tarefas.filter((t) => t.status !== "pendente").length;
              const pct = o.tarefas.length ? Math.round((fechadas / o.tarefas.length) * 100) : 0;
              const atrasadas = o.tarefas.filter((t) => t.status === "pendente" && t.prazo < hoje).length;
              return (
                <li key={o.id}>
                  <Link href={`/onboarding/${o.id}`} className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-surface transition-shadow hover:shadow-hover">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{o.colaborador.nome}</p>
                        <p className="text-sm text-muted-foreground">{o.colaborador.cargo ?? "—"} · {o.modeloNome}</p>
                      </div>
                      {atrasadas > 0 ? <Selo tom="perigo">{atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</Selo> : <Selo tom={o.status === "concluido" ? "sucesso" : "info"}>{STATUS[o.status]}</Selo>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Início {formatarData(o.inicio)}</span>
                        <span className="tabular-nums">{fechadas}/{o.tarefas.length} tarefas · {pct}%</span>
                      </div>
                      <BarraProgresso valor={pct} rotulo={`Progresso do onboarding de ${o.colaborador.nome}`} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Paginacao pagina={pagina} total={total} params={{ status }} />
      </section>

      {podeIniciar && (
        <section aria-labelledby="iniciar" className="rounded-lg border border-border bg-card p-5">
          <h2 id="iniciar" className="mb-3 font-heading text-lg font-bold">Iniciar onboarding</h2>
          {modelos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crie um modelo primeiro em <Link href="/onboarding/modelos" className="text-teal-strong underline">Modelos</Link>.
            </p>
          ) : (
            <FormAcao action={iniciarOnboarding} textoBotao="Iniciar">
              <div className="grid gap-3 md:grid-cols-3">
                <Selecao nome="colaboradorId" rotulo="Pessoa" opcoes={[{ valor: "", rotulo: "Selecione…" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))]} required />
                <Selecao nome="modeloId" rotulo="Modelo" opcoes={modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))} />
                <Campo nome="inicio" rotulo="Data de início" type="date" required />
              </div>
            </FormAcao>
          )}
        </section>
      )}
    </>
  );
}
