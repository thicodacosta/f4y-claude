import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Circle, EyeOff, Lock, MinusCircle, Target, Trash2, Users } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { filtroReunioes, participa, podeConcluirCompromisso, podeEditarReuniao, STATUS_COMPROMISSO, STATUS_REUNIAO } from "@/lib/feedback/regras";
import { adicionarCompromisso, alterarCompromisso, alterarReuniao, excluirAnotacao, levarAoPdi, salvarAnotacao } from "@/lib/feedback/actions";
import { escopoCobre } from "@/lib/escopo";
import { PDI_ABERTO } from "@/lib/pdi/regras";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { Iniciais, Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "1:1" };

export default async function ReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("feedback");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await db.reuniao.findFirst({
    where: { AND: [{ id }, filtroReunioes(ctx, escopo)] },
    include: {
      colaborador: { select: { id: true, nome: true, cargo: true, gestorId: true } },
      gestor: { select: { id: true, nome: true, gestorId: true } },
      compromissos: {
        include: { responsavel: { select: { id: true, nome: true, gestorId: true } }, acaoPdi: { select: { id: true, pdiId: true, status: true } } },
        orderBy: { criadoEm: "asc" },
      },
    },
  });
  if (!r) notFound();

  const souParticipante = participa(ctx, r);
  // O banco só devolve as anotações que esta conta pode ler (policy de privacidade).
  const anotacoes = souParticipante ? await db.anotacaoReuniao.findMany({ where: { reuniaoId: r.id }, orderBy: { criadoEm: "asc" } }) : [];
  const escopoEditar = pode(ctx, "feedback", "editar");
  const escopoConcluir = pode(ctx, "feedback", "concluir");
  const gestao = podeEditarReuniao(ctx, escopoEditar, r);
  const agendada = r.status === "agendada";

  // Integração com PDI: objetivos do PDI aberto de cada responsável (se contratado e permitido).
  const escopoPdi = pode(ctx, "pdi", "editar");
  const responsaveisPdi = gestao && escopoPdi ? [r.colaborador, r.gestor].filter((p) => escopoCobre(ctx, escopoPdi, p)) : [];
  const pdis = responsaveisPdi.length
    ? await db.pdi.findMany({
        where: { colaboradorId: { in: responsaveisPdi.map((p) => p.id) }, status: { in: [...PDI_ABERTO] } },
        select: { id: true, colaboradorId: true, objetivos: { where: { status: "em_andamento" }, select: { id: true, titulo: true }, orderBy: { ordem: "asc" } } },
      })
    : [];
  const pdiDe = (pessoaId: string) => pdis.find((p) => p.colaboradorId === pessoaId);

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/feedback" className="text-sm text-muted-foreground hover:text-foreground">
          ← Reuniões
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">1:1 · {r.colaborador.nome}</h2>
          <Selo tom={STATUS_REUNIAO[r.status].tom}>{STATUS_REUNIAO[r.status].nome}</Selo>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden /> {r.colaborador.nome} ({r.colaborador.cargo ?? "cargo não informado"}) com {r.gestor.nome} ·{" "}
          {formatarDataHora(r.dataHora.toISOString())}
          {r.modeloNome && ` · Pauta “${r.modeloNome}”`}
          {r.canceladaMotivo && ` · Cancelada: ${r.canceladaMotivo}`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao aria-labelledby="pauta">
            <CabecalhoCartao id="pauta" titulo="Pauta" />
            <div className="px-5 pb-5">
              {r.pauta.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem tópicos definidos.</p>
              ) : (
                <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                  {r.pauta.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              )}
              {gestao && r.status !== "cancelada" && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Editar pauta…</summary>
                  <FormAcao action={alterarReuniao} textoBotao="Salvar pauta" variante="outline" className="mt-3">
                    <input type="hidden" name="reuniaoId" value={r.id} />
                    <input type="hidden" name="acao" value="pauta" />
                    <Area nome="pauta" rotulo="Tópicos (um por linha)" defaultValue={r.pauta.join("\n")} rows={5} />
                  </FormAcao>
                </details>
              )}
            </div>
          </Cartao>

          <Cartao aria-labelledby="anotacoes">
            <CabecalhoCartao id="anotacoes" titulo="Anotações" descricao="Compartilhadas: os dois participantes. Privadas: só quem escreveu." />
            <div className="flex flex-col gap-4 px-5 pb-5">
              {!souParticipante ? (
                <p className="flex items-start gap-2 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                  As anotações deste 1:1 são visíveis apenas aos participantes. Você vê a data, a situação e os compromissos.
                </p>
              ) : (
                <>
                  {anotacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {anotacoes.map((a) => {
                        const minha = a.autorUsuarioId === ctx.usuario.id;
                        return (
                          <li key={a.id} className={`rounded-md border p-4 ${a.visibilidade === "privada" ? "border-dashed border-input bg-muted/40" : "border-border"}`}>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-2">
                                <strong className="text-foreground">{a.autorNome}</strong> · {formatarDataHora(a.criadoEm.toISOString())}
                              </span>
                              {a.visibilidade === "privada" ? (
                                <span className="flex items-center gap-1 font-medium">
                                  <Lock className="size-3.5" aria-hidden /> Privada — só você vê
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 font-medium text-teal-strong">
                                  <Users className="size-3.5" aria-hidden /> Compartilhada
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-line">{a.texto}</p>
                            {minha && !ctx.suporte && (
                              <form action={excluirAnotacao.bind(null, a.id)} className="mt-2">
                                <button type="submit" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                                  <Trash2 className="size-3.5" aria-hidden /> Excluir
                                </button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!ctx.suporte && (
                    <FormAcao action={salvarAnotacao} textoBotao="Salvar anotação" limparAoConcluir className="border-t border-border pt-4">
                      <input type="hidden" name="reuniaoId" value={r.id} />
                      <Area nome="texto" rotulo="Nova anotação" rows={4} required />
                      <fieldset className="flex flex-wrap gap-4 text-sm">
                        <legend className="sr-only">Visibilidade</legend>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="visibilidade" value="compartilhada" defaultChecked className="accent-[var(--primary)]" /> Compartilhada com o outro participante
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="visibilidade" value="privada" className="accent-[var(--primary)]" /> Privada (só eu)
                        </label>
                      </fieldset>
                    </FormAcao>
                  )}
                </>
              )}
            </div>
          </Cartao>
        </div>

        <div className="flex flex-col gap-4">
          <Cartao aria-labelledby="compromissos">
            <CabecalhoCartao id="compromissos" titulo="Compromissos" descricao="Acordos com responsável e prazo." />
            <div className="flex flex-col gap-3 px-5 pb-5">
              {r.compromissos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum compromisso registrado.</p>}
              <ul className="flex flex-col divide-y divide-border">
                {r.compromissos.map((c) => {
                  const Icone = c.status === "concluido" ? CheckCircle2 : c.status === "cancelado" ? MinusCircle : Circle;
                  const pdi = pdiDe(c.responsavelId);
                  return (
                    <li key={c.id} id={`compromisso-${c.id}`} className="flex flex-col gap-2 py-3">
                      <div className="flex gap-2.5">
                        <Icone className={`mt-0.5 size-4 shrink-0 ${c.status === "concluido" ? "text-success" : "text-muted-foreground"}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${c.status === "cancelado" ? "text-muted-foreground line-through" : ""}`}>{c.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.responsavel.nome}
                            {c.prazo && ` · prazo ${formatarData(c.prazo)}`}
                            {c.concluidoPor && ` · concluído por ${c.concluidoPor}`}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Selo tom={STATUS_COMPROMISSO[c.status].tom}>{STATUS_COMPROMISSO[c.status].nome}</Selo>
                            {c.acaoPdi && (
                              <Link href={`/pdi/${c.acaoPdi.pdiId}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-strong hover:underline">
                                <Target className="size-3.5" aria-hidden /> No PDI
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-6">
                        {c.status === "aberto" && podeConcluirCompromisso(ctx, escopoConcluir, c, r) && (
                          <FormAcao action={alterarCompromisso} textoBotao="Concluir" variante="outline">
                            <input type="hidden" name="compromissoId" value={c.id} />
                            <input type="hidden" name="acao" value="concluir" />
                          </FormAcao>
                        )}
                        {gestao && c.status === "aberto" && (
                          <FormAcao action={alterarCompromisso} textoBotao="Cancelar" variante="outline">
                            <input type="hidden" name="compromissoId" value={c.id} />
                            <input type="hidden" name="acao" value="cancelar" />
                          </FormAcao>
                        )}
                        {gestao && c.status !== "aberto" && (
                          <FormAcao action={alterarCompromisso} textoBotao="Reabrir" variante="outline">
                            <input type="hidden" name="compromissoId" value={c.id} />
                            <input type="hidden" name="acao" value="reabrir" />
                          </FormAcao>
                        )}
                      </div>
                      {gestao && c.status === "aberto" && !c.acaoPdi && escopoPdi && escopoCobre(ctx, escopoPdi, c.responsavel) && (
                        <details className="pl-6 text-sm">
                          <summary className="cursor-pointer text-teal-strong hover:underline">Levar ao PDI…</summary>
                          {pdi ? (
                            <FormAcao action={levarAoPdi} textoBotao="Incluir no PDI" variante="outline" className="mt-2">
                              <input type="hidden" name="compromissoId" value={c.id} />
                              <Selecao
                                nome="objetivoId"
                                idCampo={`objetivo-${c.id}`}
                                rotulo={`Objetivo no PDI de ${c.responsavel.nome.split(" ")[0]}`}
                                opcoes={[...pdi.objetivos.map((o) => ({ valor: o.id, rotulo: o.titulo })), { valor: "novo", rotulo: "Novo objetivo: Compromissos de 1:1" }]}
                              />
                            </FormAcao>
                          ) : (
                            <p className="mt-2 text-muted-foreground">
                              {c.responsavel.nome} não tem PDI em rascunho ou ativo.{" "}
                              {pode(ctx, "pdi", "criar") && (
                                <Link href="/pdi" className="text-teal-strong underline">
                                  Criar PDI
                                </Link>
                              )}
                            </p>
                          )}
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
              {gestao && r.status !== "cancelada" && (
                <FormAcao action={adicionarCompromisso} textoBotao="Registrar compromisso" limparAoConcluir className="border-t border-border pt-4">
                  <input type="hidden" name="reuniaoId" value={r.id} />
                  <Campo nome="descricao" rotulo="Compromisso" required maxLength={500} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Selecao
                      nome="responsavelId"
                      rotulo="Responsável"
                      opcoes={[
                        { valor: r.colaborador.id, rotulo: r.colaborador.nome },
                        { valor: r.gestor.id, rotulo: r.gestor.nome },
                      ]}
                    />
                    <Campo nome="prazo" rotulo="Prazo" type="date" />
                  </div>
                </FormAcao>
              )}
            </div>
          </Cartao>

          {gestao && (
            <Cartao aria-labelledby="gestao" className="p-5">
              <h3 id="gestao" className="mb-3 font-heading text-base font-bold">
                Gestão da reunião
              </h3>
              {agendada ? (
                <div className="flex flex-col gap-4">
                  <FormAcao action={alterarReuniao} textoBotao="Marcar como realizada">
                    <input type="hidden" name="reuniaoId" value={r.id} />
                    <input type="hidden" name="acao" value="realizada" />
                  </FormAcao>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Reagendar…</summary>
                    <FormAcao action={alterarReuniao} textoBotao="Reagendar" variante="outline" className="mt-2">
                      <input type="hidden" name="reuniaoId" value={r.id} />
                      <input type="hidden" name="acao" value="reagendar" />
                      <Campo nome="dataHora" idCampo="reagendar-data" rotulo="Nova data e hora" type="datetime-local" required />
                    </FormAcao>
                  </details>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Cancelar…</summary>
                    <FormAcao action={alterarReuniao} textoBotao="Cancelar reunião" variante="destructive" className="mt-2">
                      <input type="hidden" name="reuniaoId" value={r.id} />
                      <input type="hidden" name="acao" value="cancelar" />
                      <Campo nome="motivo" rotulo="Motivo" required />
                    </FormAcao>
                  </details>
                </div>
              ) : (
                <FormAcao action={alterarReuniao} textoBotao="Reabrir como agendada" variante="outline">
                  <input type="hidden" name="reuniaoId" value={r.id} />
                  <input type="hidden" name="acao" value="reabrir" />
                </FormAcao>
              )}
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
