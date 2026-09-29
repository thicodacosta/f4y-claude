import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, FileCheck2, MinusCircle } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroOnboardings, hojeSemHora, podeConcluirTarefa, RESPONSAVEL, TIPO_TAREFA } from "@/lib/onboarding/regras";
import { alterarTarefa, cancelarOnboarding, concluirOnboarding } from "@/lib/onboarding/actions";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { BarraProgresso } from "@/components/secao";
import { Selo } from "@/components/app/lista";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Onboarding" };

type Tarefa = {
  id: string;
  etapa: string;
  titulo: string;
  descricao: string | null;
  tipo: "tarefa" | "documento" | "material";
  responsavelTipo: "rh" | "gestor" | "colaborador";
  responsavelId: string | null;
  responsavel: { nome: string } | null;
  prazo: Date;
  status: "pendente" | "concluida" | "dispensada";
  concluidaEm: Date | null;
  concluidaPor: string | null;
  observacao: string | null;
  materialUrl: string | null;
};

function IconeStatus({ t, atrasada }: { t: Tarefa; atrasada: boolean }) {
  if (t.status === "concluida") return <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Concluída" />;
  if (t.status === "dispensada") return <MinusCircle className="size-5 shrink-0 text-muted-foreground" aria-label="Dispensada" />;
  if (atrasada) return <AlertTriangle className="size-5 shrink-0 text-destructive" aria-label="Atrasada" />;
  return <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="Pendente" />;
}

export default async function OnboardingDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("onboarding");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const o = await db.onboarding.findFirst({
    where: { AND: [{ id }, filtroOnboardings(ctx, escopo)] },
    include: {
      colaborador: { select: { id: true, nome: true, cargo: true, status: true, gestor: { select: { nome: true } } } },
      tarefas: { include: { responsavel: { select: { nome: true } } }, orderBy: { ordem: "asc" } },
      eventos: { orderBy: { criadoEm: "desc" }, take: 50 },
    },
  });
  if (!o) notFound();

  const hoje = hojeSemHora();
  const escopoConcluir = pode(ctx, "onboarding", "concluir");
  const rh = escopoConcluir === "todos";
  const emAndamento = o.status === "em_andamento";
  const fechadas = o.tarefas.filter((t) => t.status !== "pendente").length;
  const pct = o.tarefas.length ? Math.round((fechadas / o.tarefas.length) * 100) : 0;
  const pendentes = o.tarefas.length - fechadas;
  const documentos = o.tarefas.filter((t) => t.tipo === "documento");
  const materiais = o.tarefas.filter((t) => t.tipo === "material");
  const etapas = [...new Set(o.tarefas.map((t) => t.etapa))];
  const souOColaborador = ctx.colaboradorId === o.colaborador.id;

  function Acoes({ t }: { t: Tarefa }) {
    if (!emAndamento) return null;
    const posso = podeConcluirTarefa(ctx, escopoConcluir, t);
    if (!posso) return null;
    if (t.status !== "pendente") {
      return rh ? (
        <FormAcao action={alterarTarefa} textoBotao="Reabrir" variante="outline">
          <input type="hidden" name="tarefaId" value={t.id} />
          <input type="hidden" name="acao" value="reabrir" />
        </FormAcao>
      ) : null;
    }
    return (
      <div className="flex flex-wrap items-start gap-3">
        <FormAcao action={alterarTarefa} textoBotao="Concluir">
          <input type="hidden" name="tarefaId" value={t.id} />
          <input type="hidden" name="acao" value="concluir" />
        </FormAcao>
        {rh && (
          <details className="text-sm">
            <summary className="cursor-pointer py-2 text-muted-foreground hover:text-foreground">Dispensar…</summary>
            <FormAcao action={alterarTarefa} textoBotao="Dispensar tarefa" variante="outline" className="mt-2">
              <input type="hidden" name="tarefaId" value={t.id} />
              <input type="hidden" name="acao" value="dispensar" />
              <Campo nome="observacao" rotulo="Motivo" required />
            </FormAcao>
          </details>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground">← Onboardings</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{o.colaborador.nome}</h2>
          <Selo tom={o.status === "concluido" ? "sucesso" : o.status === "cancelado" ? "neutro" : "info"}>
            {o.status === "concluido" ? "Concluído" : o.status === "cancelado" ? "Cancelado" : "Em andamento"}
          </Selo>
        </div>
        <p className="text-sm text-muted-foreground">
          {o.colaborador.cargo ?? "Cargo não informado"} · Gestor: {o.colaborador.gestor?.nome ?? "—"} · Modelo “{o.modeloNome}” · Início {formatarData(o.inicio)}
          {o.concluidoEm && ` · Encerrado em ${formatarData(o.concluidoEm)} por ${o.concluidoPor}`}
        </p>
        <div className="max-w-xl">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="tabular-nums">{fechadas}/{o.tarefas.length} · {pct}%</span>
          </div>
          <BarraProgresso valor={pct} rotulo="Progresso do onboarding" />
        </div>
      </div>

      {(o.boasVindas || materiais.length > 0) && (
        <section aria-labelledby="boas-vindas" className="flex flex-col gap-3 rounded-lg border border-teal/30 bg-teal-soft p-5">
          <h3 id="boas-vindas" className="font-heading text-lg font-bold">Boas-vindas{souOColaborador ? `, ${o.colaborador.nome.split(" ")[0]}` : ""}</h3>
          {o.boasVindas && <p className="whitespace-pre-line text-sm leading-relaxed">{o.boasVindas}</p>}
          {materiais.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {materiais.map((m) => (
                <li key={m.id}>
                  {m.materialUrl ? (
                    <a href={m.materialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-teal-strong hover:underline">
                      {m.titulo} <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    <span className="font-medium">{m.titulo}</span>
                  )}
                  {m.descricao && <span className="text-muted-foreground"> — {m.descricao}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {documentos.length > 0 && (
        <section aria-labelledby="documentos" className="flex flex-col gap-2">
          <h3 id="documentos" className="flex items-center gap-2 font-heading text-lg font-bold">
            <FileCheck2 className="size-5 text-teal-strong" aria-hidden /> Documentação de admissão
          </h3>
          <ul className="flex flex-wrap gap-2">
            {documentos.map((d) => (
              <li key={d.id} className={`rounded-full border px-3 py-1 text-sm ${d.status === "concluida" ? "border-success/40 bg-success/10" : d.status === "dispensada" ? "border-border text-muted-foreground line-through" : "border-border bg-card"}`}>
                {d.status === "concluida" ? "✓ " : ""}
                {d.titulo}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tarefas" className="flex flex-col gap-5">
        <h3 id="tarefas" className="font-heading text-lg font-bold">Tarefas</h3>
        {etapas.map((etapa) => (
          <div key={etapa} className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{etapa}</p>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
              {o.tarefas
                .filter((t) => t.etapa === etapa)
                .map((t) => {
                  const atrasada = t.status === "pendente" && t.prazo < hoje && emAndamento;
                  return (
                    <li key={t.id} id={`tarefa-${t.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <IconeStatus t={t} atrasada={atrasada} />
                        <div className="min-w-0">
                          <p className={`font-medium ${t.status === "dispensada" ? "text-muted-foreground line-through" : ""}`}>{t.titulo}</p>
                          {t.descricao && <p className="text-sm text-muted-foreground">{t.descricao}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {TIPO_TAREFA[t.tipo]} · {RESPONSAVEL[t.responsavelTipo]}
                            {t.responsavel ? ` (${t.responsavel.nome})` : ""} ·{" "}
                            <span className={atrasada ? "font-semibold text-destructive" : ""}>
                              {atrasada ? "atrasada, prazo " : "prazo "}
                              {formatarData(t.prazo)}
                            </span>
                            {t.concluidaEm && ` · ${t.status === "concluida" ? "concluída" : "dispensada"} por ${t.concluidaPor} em ${formatarData(t.concluidaEm)}`}
                            {t.observacao && ` · ${t.observacao}`}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Acoes t={t} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {o.tarefas.length === 0 && <p className="text-sm text-muted-foreground">Este onboarding não tem tarefas.</p>}
      </section>

      {emAndamento && rh && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
            <h3 className="font-heading text-lg font-bold">Concluir onboarding</h3>
            <p className="text-sm text-muted-foreground">
              {pendentes > 0
                ? `Ainda há ${pendentes} tarefa(s) pendente(s). Conclua ou dispense antes de encerrar.`
                : "Todas as tarefas foram encerradas. Ao concluir, a pessoa fica ativa para Feedback 1:1, Pulse e PDI."}
            </p>
            <FormAcao action={concluirOnboarding} textoBotao="Concluir onboarding">
              <input type="hidden" name="onboardingId" value={o.id} />
            </FormAcao>
          </div>
          {pode(ctx, "onboarding", "editar") === "todos" && (
            <details className="rounded-lg border border-border bg-card p-5">
              <summary className="cursor-pointer font-heading text-lg font-bold">Cancelar onboarding</summary>
              <FormAcao action={cancelarOnboarding} textoBotao="Cancelar onboarding" variante="destructive" className="mt-3">
                <input type="hidden" name="onboardingId" value={o.id} />
                <Campo nome="motivo" rotulo="Motivo" required />
              </FormAcao>
            </details>
          )}
        </section>
      )}

      <section aria-labelledby="historico" className="flex flex-col gap-2">
        <h3 id="historico" className="font-heading text-lg font-bold">Histórico</h3>
        <ol className="flex flex-col gap-1.5 text-sm">
          {o.eventos.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <span className="tabular-nums text-muted-foreground">{formatarDataHora(e.criadoEm.toISOString())}</span>
              <span>{e.texto}</span>
              <span className="text-muted-foreground">— {e.autorNome}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
