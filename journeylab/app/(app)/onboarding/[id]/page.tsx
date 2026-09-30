import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Ban, CalendarDays, CheckCircle2, Circle, CircleDot, Clock, Gauge, MailWarning, MinusCircle, Paperclip, Target, Trash2, TriangleAlert } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje as hojeCivil, somarDias, textoDeData } from "@/lib/datas";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { emailValido } from "@/lib/email";
import { calcularProgresso, diaDoOnboarding, faseAtual, RESPONSAVEL, ritmo, SITUACAO, situacao, STATUS_TAREFA, TIPO_TAREFA, type StatusTarefa } from "@/lib/onboarding/calculo";
import { filtroOnboardings } from "@/lib/onboarding/regras";
import { serializarTarefa } from "@/lib/onboarding/consultas";
import { alterarInicio, cancelarOnboarding, concluirOnboarding, editarTarefa, enviarAnexoTarefa, enviarLembreteGestor, removerAnexoTarefa } from "@/lib/onboarding/actions";
import { BarraProgresso } from "@/components/secao";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Campo, Selecao } from "@/components/admin/campos";
import { AcoesRapidas, KanbanTarefas, SinaisTarefa } from "@/components/onboarding/tarefas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

const ICONE: Record<StatusTarefa, typeof Circle> = { nao_iniciada: Circle, em_andamento: CircleDot, bloqueada: Ban, concluida: CheckCircle2, dispensada: MinusCircle };
const COR: Record<StatusTarefa, string> = {
  nao_iniciada: "text-muted-foreground",
  em_andamento: "text-teal-strong",
  bloqueada: "text-destructive",
  concluida: "text-success",
  dispensada: "text-muted-foreground",
};

function Indicador({ rotulo, valor, detalhe, icone: Icone, children }: { rotulo: string; valor: string; detalhe?: string; icone: typeof Circle; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-surface">
      <span className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
        {rotulo} <Icone className="size-4" aria-hidden />
      </span>
      <span className="font-heading text-xl leading-tight font-bold">{valor}</span>
      {children}
      {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
    </div>
  );
}

export default async function OnboardingDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, escopo, db } = await exigirModulo("onboarding");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const o = await db.onboarding.findFirst({
    where: { AND: [{ id }, filtroOnboardings(ctx, escopo)] },
    include: {
      colaborador: {
        select: {
          id: true,
          nome: true,
          cargo: true,
          dataAdmissao: true,
          equipe: { select: { nome: true, area: { select: { nome: true } } } },
          gestor: { select: { nome: true, email: true, associacao: { select: { status: true, usuario: { select: { email: true } } } } } },
        },
      },
      fases: { orderBy: { ordem: "asc" } },
      tarefas: {
        orderBy: { ordem: "asc" },
        include: { responsavel: { select: { nome: true } }, fase: { select: { nome: true } }, anexos: { orderBy: { criadoEm: "asc" } } },
      },
      eventos: { orderBy: { criadoEm: "desc" }, take: 60 },
    },
  });
  if (!o) notFound();

  const hoje = hojeCivil();
  const sit = situacao(o, hoje);
  const emAndamento = o.status === "em_andamento";
  const escopoConcluir = pode(ctx, "onboarding", "concluir");
  const rh = escopoConcluir === "todos";
  const podeEditarRh = pode(ctx, "onboarding", "editar") === "todos";
  const tarefas = o.tarefas.map((t) => ({ ...t, cliente: serializarTarefa(t, hoje, escopoConcluir, emAndamento && o.inicio <= hoje) }));
  const r = ritmo(o.tarefas, o.inicio, hoje);
  const fase = faseAtual(o.fases, o.inicio, hoje);
  const dia = diaDoOnboarding(o.inicio, hoje);
  const visao = sp.visao === "kanban" ? "kanban" : "timeline";
  const atrasadas = tarefas.filter((t) => t.cliente.sinais.atrasada);
  const proximas = tarefas.filter((t) => t.cliente.sinais.venceHoje || t.cliente.sinais.proxima);
  const bloqueadas = tarefas.filter((t) => t.status === "bloqueada");
  const gestor = o.colaborador.gestor;
  const emailGestor = gestor ? (gestor.associacao?.status === "ativa" ? gestor.associacao.usuario.email : gestor.email) : null;
  const lembreteOk = !!gestor && emailValido(emailGestor);
  const pessoas = rh ? await db.colaborador.findMany({ where: { status: { not: "desligado" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];
  const porResponsavel = (["rh", "gestor", "colaborador"] as const).map((resp) => {
    const lista = tarefas.filter((t) => t.responsavelTipo === resp && t.status !== "dispensada");
    return { resp, total: lista.length, concluidas: lista.filter((t) => t.status === "concluida").length, atrasadas: lista.filter((t) => t.cliente.sinais.atrasada).length, bloqueadas: lista.filter((t) => t.status === "bloqueada").length };
  });
  const link = (v: string) => `/onboarding/${o.id}${v === "timeline" ? "" : `?visao=${v}`}`;
  // Integração opcional com Feedback 1:1 (só se contratado e permitido): sugere agendar o primeiro 1:1 — nunca cria feedback.
  const sugerir1a1 =
    emAndamento && ctx.modulos.has("feedback") && !!pode(ctx, "feedback", "criar") && !ctx.suporte
      ? !(await db.reuniao.findFirst({ where: { colaboradorId: o.colaborador.id, status: { not: "cancelada" } }, select: { id: true } }))
      : false;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/onboarding" className="text-sm text-muted-foreground hover:text-foreground">
          ← Onboardings
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{o.colaborador.nome}</h2>
          <Selo tom={SITUACAO[sit].tom}>{SITUACAO[sit].nome}</Selo>
          {o.origem !== "manual" && <Selo tom="neutro">{o.origem === "cadastro" ? "Criado no cadastro" : "Criado na conversão do CRM"}</Selo>}
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Cargo</dt>
            <dd className="font-medium">{o.colaborador.cargo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Departamento · equipe</dt>
            <dd className="font-medium">{[o.colaborador.equipe?.area?.nome, o.colaborador.equipe?.nome].filter(Boolean).join(" · ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Gestor</dt>
            <dd className="font-medium">{gestor?.nome ?? "Não definido"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Entrada · template</dt>
            <dd className="font-medium">
              {formatarData(o.inicio)} · {o.modeloNome}
            </dd>
          </div>
        </dl>
      </div>

      <section aria-label="Indicadores do onboarding" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Progresso" valor={`${o.progresso}%`} icone={Target} detalhe={`${r.concluidas} de ${r.total} tarefas concluídas`}>
          <BarraProgresso valor={o.progresso} rotulo="Progresso do onboarding" />
        </Indicador>
        <Indicador
          rotulo="Fase atual"
          valor={sit === "nao_iniciado" ? "Antes do início" : fase?.nome ?? "—"}
          icone={CalendarDays}
          detalhe={sit === "nao_iniciado" ? `Começa em ${formatarData(o.inicio)}` : emAndamento ? `Dia ${dia}${fase ? ` · fase até o dia ${fase.marcoDias}` : ""}` : SITUACAO[sit].nome}
        />
        <Indicador
          rotulo="Ritmo × prazo esperado"
          valor={r.estado === "inicio" ? "Sem prazos vencidos" : r.estado === "em_dia" ? "Em dia" : `${-r.diferenca} tarefa(s) atrás`}
          icone={Gauge}
          detalhe={`Esperado até hoje: ${r.esperadas} · concluídas: ${r.concluidas}`}
        />
        <Indicador
          rotulo="Previsão de conclusão"
          valor={o.status === "concluido" ? formatarData(o.concluidoEm ?? hoje) : r.previsao ? formatarData(r.previsao) : "—"}
          icone={Clock}
          detalhe={o.status === "concluido" ? "Concluído" : r.previsao ? "No ritmo atual deste onboarding" : "Aparece após a primeira tarefa concluída"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-heading text-lg font-bold">Tarefas</h3>
            <nav aria-label="Visualização das tarefas" className="flex w-max gap-1 rounded-md border border-border bg-card p-1 shadow-surface">
              {[
                ["timeline", "Linha do tempo"],
                ["kanban", "Kanban"],
              ].map(([v, rotulo]) => (
                <Link
                  key={v}
                  href={link(v)}
                  aria-current={visao === v ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-sm px-3.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                    visao === v && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  {rotulo}
                </Link>
              ))}
            </nav>
          </div>

          {visao === "kanban" ? (
            <KanbanTarefas tarefas={tarefas.filter((t) => t.status !== "dispensada").map((t) => t.cliente)} podeDispensar={rh} />
          ) : (
            <ol className="flex flex-col">
              {o.fases.map((f, i) => {
                const daFase = tarefas.filter((t) => t.faseId === f.id);
                const pctFase = calcularProgresso(daFase);
                const marco = somarDias(o.inicio, f.marcoDias);
                const atual = fase?.id === f.id && emAndamento;
                return (
                  <li key={f.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < o.fases.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden />}
                    <span
                      className={cn(
                        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        pctFase === 100 ? "border-success bg-success text-white" : atual ? "border-teal bg-teal-soft text-teal-strong" : "border-border bg-card text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {pctFase === 100 ? <CheckCircle2 className="size-4" /> : i + 1}
                    </span>
                    <Cartao className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
                        <div>
                          <p className="font-heading font-bold">
                            {f.nome} {atual && <span className="ml-1 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal-strong">Fase atual</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {f.descricao ?? `Até o dia ${f.marcoDias}`} · marco em {formatarData(marco)}
                          </p>
                        </div>
                        <div className="w-40">
                          <p className="mb-1 text-right text-xs tabular-nums text-muted-foreground">{pctFase}% da fase</p>
                          <BarraProgresso valor={pctFase} rotulo={`Progresso da fase ${f.nome}`} />
                        </div>
                      </div>
                      <ul className="flex flex-col divide-y divide-border border-t border-border">
                        {daFase.map((t) => {
                          const Icone = ICONE[t.status];
                          return (
                            <li key={t.id} id={`tarefa-${t.id}`} className="flex flex-col gap-2 px-5 py-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 gap-3">
                                  <Icone className={cn("mt-0.5 size-5 shrink-0", COR[t.status])} aria-label={STATUS_TAREFA[t.status].nome} />
                                  <div className="min-w-0">
                                    <p className={cn("font-medium", t.status === "dispensada" && "text-muted-foreground line-through")}>
                                      {t.titulo}
                                      {!t.obrigatoria && <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>}
                                    </p>
                                    {t.descricao && <p className="text-sm text-muted-foreground">{t.descricao}</p>}
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {STATUS_TAREFA[t.status].nome} · {TIPO_TAREFA[t.tipo]} · {RESPONSAVEL[t.responsavelTipo]}
                                      {t.responsavel ? ` (${t.responsavel.nome})` : ""} · prazo {formatarData(t.prazo)}
                                      {t.prazoFixo ? " (específico)" : ""}
                                      {t.concluidaEm && ` · ${t.status === "concluida" ? "concluída" : "encerrada"} por ${t.concluidaPor} em ${formatarData(t.concluidaEm)}`}
                                      {t.observacao && ` · ${t.observacao}`}
                                    </p>
                                    {t.bloqueioMotivo && <p className="mt-1 text-xs font-medium text-destructive">Bloqueio: {t.bloqueioMotivo}</p>}
                                    <SinaisTarefa sinais={t.cliente.sinais} className="mt-1.5" />
                                  </div>
                                </div>
                                {o.status !== "cancelado" && <AcoesRapidas tarefa={t.cliente} podeDispensar={rh} />}
                              </div>
                              {(t.anexos.length > 0 || (t.cliente.podeAtualizar && o.status !== "cancelado")) && (
                                <details className="pl-8 text-sm">
                                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                    Detalhes{t.anexos.length ? ` · ${t.anexos.length} anexo(s)` : ""}
                                  </summary>
                                  <div className="mt-2 flex flex-col gap-3">
                                    {t.anexos.length > 0 && (
                                      <ul className="flex flex-col gap-1">
                                        {t.anexos.map((a) => (
                                          <li key={a.id} className="flex items-center gap-2 text-xs">
                                            <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
                                            <a href={`/onboarding/anexos/${a.id}`} className="font-medium text-teal-strong hover:underline">
                                              {a.nomeArquivo}
                                            </a>
                                            <span className="text-muted-foreground">· {a.enviadoPor}</span>
                                            {t.cliente.podeAtualizar && (
                                              <form action={removerAnexoTarefa.bind(null, a.id)}>
                                                <button type="submit" aria-label={`Remover ${a.nomeArquivo}`} className="rounded p-1 text-muted-foreground hover:text-destructive">
                                                  <Trash2 className="size-3.5" aria-hidden />
                                                </button>
                                              </form>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {t.cliente.podeAtualizar && o.status !== "cancelado" && (
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <FormAcao action={editarTarefa} textoBotao="Salvar prazo" variante="outline">
                                          <input type="hidden" name="tarefaId" value={t.id} />
                                          <Campo
                                            nome="prazo"
                                            idCampo={`prazo-${t.id}`}
                                            rotulo="Prazo específico"
                                            type="date"
                                            defaultValue={t.prazoFixo ? textoDeData(t.prazo) : ""}
                                            ajuda="Vazio = calculado pela data de início e pela fase."
                                          />
                                          {rh && (
                                            <Selecao
                                              nome="responsavelId"
                                              idCampo={`designado-${t.id}`}
                                              rotulo="Pessoa designada"
                                              defaultValue={t.responsavelId ?? "nenhum"}
                                              opcoes={[{ valor: "nenhum", rotulo: "Ninguém em específico" }, ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))]}
                                            />
                                          )}
                                        </FormAcao>
                                        <FormAcao action={enviarAnexoTarefa} textoBotao="Anexar" variante="outline">
                                          <input type="hidden" name="tarefaId" value={t.id} />
                                          <div className="flex flex-col gap-1.5">
                                            <label htmlFor={`arquivo-${t.id}`} className="text-[13px] font-semibold text-foreground/85">
                                              Anexo (PDF, DOC, DOCX, PNG ou JPG · até 10 MB)
                                            </label>
                                            <input id={`arquivo-${t.id}`} name="arquivo" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="text-sm" />
                                          </div>
                                        </FormAcao>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </li>
                          );
                        })}
                        {daFase.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Sem tarefas nesta fase.</li>}
                      </ul>
                    </Cartao>
                  </li>
                );
              })}
              {o.fases.length === 0 && <p className="text-sm text-muted-foreground">Este onboarding não tem fases nem tarefas.</p>}
            </ol>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Cartao aria-labelledby="alertas">
            <CabecalhoCartao id="alertas" titulo="Alertas" descricao={sit === "nao_iniciado" ? "Os alertas começam na data de início." : undefined} />
            <div className="flex flex-col gap-3 px-5 pb-5 text-sm">
              {[
                { titulo: "Atrasadas", lista: atrasadas, icone: TriangleAlert, cor: "text-destructive" },
                { titulo: "Vencendo hoje ou em até 3 dias", lista: proximas, icone: Clock, cor: "text-warning-foreground dark:text-warning" },
                { titulo: "Bloqueadas", lista: bloqueadas, icone: Ban, cor: "text-destructive" },
              ].map((g) => (
                <div key={g.titulo}>
                  <p className={cn("flex items-center gap-1.5 font-semibold", g.lista.length ? g.cor : "text-muted-foreground")}>
                    <g.icone className="size-4" aria-hidden /> {g.titulo} ({g.lista.length})
                  </p>
                  {g.lista.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5 pl-6">
                      {g.lista.map((t) => (
                        <li key={t.id}>
                          <a href={`#tarefa-${t.id}`} className="hover:text-teal-strong">
                            {t.titulo}
                          </a>
                          <span className="text-xs text-muted-foreground"> · {formatarData(t.prazo)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Cartao>

          <Cartao aria-labelledby="responsaveis">
            <CabecalhoCartao id="responsaveis" titulo="Por responsável" />
            <ul className="flex flex-col gap-3 px-5 pb-5">
              {porResponsavel.map((p) => (
                <li key={p.resp} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <span className="font-medium">{RESPONSAVEL[p.resp]}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {p.concluidas}/{p.total}
                      {p.atrasadas ? ` · ${p.atrasadas} atrasada(s)` : ""}
                      {p.bloqueadas ? ` · ${p.bloqueadas} bloqueada(s)` : ""}
                    </span>
                  </div>
                  <BarraProgresso valor={p.total ? Math.round((p.concluidas / p.total) * 100) : 0} rotulo={`Tarefas de ${RESPONSAVEL[p.resp]}`} />
                </li>
              ))}
            </ul>
          </Cartao>

          {emAndamento && escopoConcluir && !ctx.suporte && (
            <Cartao aria-labelledby="lembrete" className="p-5">
              <h3 id="lembrete" className="font-heading text-base font-bold">
                Lembrete ao gestor
              </h3>
              {lembreteOk ? (
                <FormAcao action={enviarLembreteGestor} textoBotao="Enviar lembrete por e-mail" variante="outline" className="mt-2">
                  <input type="hidden" name="onboardingId" value={o.id} />
                  <p className="text-sm text-muted-foreground">
                    Para {gestor!.nome} ({emailGestor}), com o progresso e as tarefas pendentes.
                    {o.lembreteEm && ` Último envio: ${formatarDataHora(o.lembreteEm.toISOString())}.`}
                  </p>
                </FormAcao>
              ) : (
                <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                  <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {!gestor ? "Defina o gestor no cadastro da pessoa para enviar lembretes." : `${gestor.nome} não tem e-mail válido cadastrado.`}
                </p>
              )}
            </Cartao>
          )}

          {sugerir1a1 && (
            <Cartao className="p-5">
              <h3 className="font-heading text-base font-bold">Primeiro 1:1</h3>
              <p className="mt-1 text-sm text-muted-foreground">{o.colaborador.nome.split(" ")[0]} ainda não tem conversa 1:1 agendada com o gestor.</p>
              <Link href={`/feedback/agendar?colaborador=${o.colaborador.id}`} className="mt-3 inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                Agendar primeiro 1:1
              </Link>
            </Cartao>
          )}

          {podeEditarRh && o.status !== "cancelado" && !ctx.suporte && (
            <Cartao aria-labelledby="gestao" className="flex flex-col gap-4 p-5">
              <h3 id="gestao" className="font-heading text-base font-bold">
                Gestão
              </h3>
              <FormAcao action={alterarInicio} textoBotao="Alterar data de início" variante="outline">
                <input type="hidden" name="onboardingId" value={o.id} />
                <Campo nome="inicio" rotulo="Data de início" type="date" defaultValue={textoDeData(o.inicio)} required ajuda="Prazos sem data específica são recalculados." />
              </FormAcao>
              {emAndamento && rh && (
                <FormAcao action={concluirOnboarding} textoBotao="Concluir manualmente" variante="outline">
                  <input type="hidden" name="onboardingId" value={o.id} />
                  <p className="text-xs text-muted-foreground">A conclusão é automática quando todas as tarefas obrigatórias são concluídas.</p>
                </FormAcao>
              )}
              {emAndamento && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Cancelar onboarding…</summary>
                  <FormAcao action={cancelarOnboarding} textoBotao="Cancelar onboarding" variante="destructive" className="mt-2">
                    <input type="hidden" name="onboardingId" value={o.id} />
                    <Campo nome="motivo" rotulo="Motivo" required />
                  </FormAcao>
                </details>
              )}
            </Cartao>
          )}

          {o.boasVindas && (
            <Cartao className="p-5">
              <h3 className="font-heading text-base font-bold">Mensagem de boas-vindas</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{o.boasVindas}</p>
            </Cartao>
          )}

          <Cartao aria-labelledby="historico">
            <CabecalhoCartao id="historico" titulo="Histórico" />
            <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto px-5 pb-5 text-sm">
              {o.eventos.map((e) => (
                <li key={e.id}>
                  <p className="text-xs text-muted-foreground">
                    {formatarDataHora(e.criadoEm.toISOString())} · {e.autorNome}
                  </p>
                  <p>{e.texto}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </>
  );
}
