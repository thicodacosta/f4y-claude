import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Circle, CircleDot, ExternalLink, MessagesSquare, MinusCircle } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { escopoCobre } from "@/lib/escopo";
import { filtroPdis, PDI_ABERTO, progressoPdi, STATUS_ACAO, STATUS_PDI, TIPO_ACAO } from "@/lib/pdi/regras";
import { adicionarAcao, adicionarObjetivo, alterarAcao, alterarObjetivo, alterarStatusPdi, editarPdi, registrarNoPdi } from "@/lib/pdi/actions";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { hojeSemHora } from "@/lib/onboarding/regras";
import { BarraProgresso } from "@/components/secao";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "PDI" };

const ICONE_ACAO = { pendente: Circle, em_andamento: CircleDot, concluida: CheckCircle2, cancelada: MinusCircle } as const;
const REGISTRO = { comentario: "Comentário", revisao: "Revisão", evento: "Atualização" } as const;

export default async function PdiDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("pdi");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.pdi.findFirst({
    where: { AND: [{ id }, filtroPdis(ctx, escopo)] },
    include: {
      colaborador: { select: { id: true, nome: true, cargo: true, gestorId: true, gestor: { select: { nome: true } } } },
      objetivos: {
        orderBy: { ordem: "asc" },
        include: { acoes: { orderBy: { criadoEm: "asc" }, include: { compromissoOrigem: { select: { reuniaoId: true } } } } },
      },
      registros: { orderBy: { criadoEm: "desc" }, take: 60 },
    },
  });
  if (!p) notFound();

  const acoes = p.objetivos.flatMap((o) => o.acoes);
  const pct = progressoPdi(acoes);
  const aberto = (PDI_ABERTO as readonly string[]).includes(p.status);
  const podeEditar = aberto && escopoCobre(ctx, pode(ctx, "pdi", "editar"), p.colaborador);
  const escopoConcluir = pode(ctx, "pdi", "concluir");
  const podeCiclo = escopoCobre(ctx, escopoConcluir, p.colaborador);
  const escopoEditar = pode(ctx, "pdi", "editar");
  const podeRevisar = !!escopoEditar && escopoEditar !== "proprio" && escopoCobre(ctx, escopoEditar, p.colaborador);
  const podeComentar = !ctx.suporte;
  const hoje = hojeSemHora();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/pdi" className="text-sm text-muted-foreground hover:text-foreground">
          ← Planos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{p.titulo}</h2>
          <Selo tom={STATUS_PDI[p.status].tom}>{STATUS_PDI[p.status].nome}</Selo>
        </div>
        <p className="text-sm text-muted-foreground">
          {p.colaborador.nome} · {p.colaborador.cargo ?? "cargo não informado"} · Gestor: {p.colaborador.gestor?.nome ?? "—"} · {formatarData(p.inicio)} a {formatarData(p.fim)}
        </p>
        <div className="max-w-xl">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progresso (ações concluídas)</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <BarraProgresso valor={pct} rotulo="Progresso do PDI" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
        <div className="flex min-w-0 flex-col gap-4">
          {p.objetivos.length === 0 && (
            <Cartao className="p-6 text-sm text-muted-foreground">
              Nenhum objetivo ainda. {podeEditar ? "Inclua o primeiro objetivo abaixo — o PDI pode ser ativado quando houver ao menos uma ação." : ""}
            </Cartao>
          )}
          {p.objetivos.map((o, n) => (
            <Cartao key={o.id} aria-labelledby={`obj-${o.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Objetivo {n + 1}</p>
                  <h3 id={`obj-${o.id}`} className={`font-heading text-base font-bold ${o.status === "cancelado" ? "text-muted-foreground line-through" : ""}`}>
                    {o.titulo}
                  </h3>
                  {o.competencia && <p className="text-xs font-medium text-teal-strong">Competência: {o.competencia}</p>}
                  {o.descricao && <p className="mt-1 text-sm text-muted-foreground">{o.descricao}</p>}
                </div>
                {podeEditar ? (
                  <FormAcao action={alterarObjetivo} textoBotao="Atualizar" variante="outline" className="flex-row items-end gap-2">
                    <input type="hidden" name="objetivoId" value={o.id} />
                    <Selecao
                      nome="status"
                      idCampo={`status-obj-${o.id}`}
                      rotulo="Situação"
                      defaultValue={o.status}
                      opcoes={[
                        { valor: "em_andamento", rotulo: "Em andamento" },
                        { valor: "concluido", rotulo: "Concluído" },
                        { valor: "cancelado", rotulo: "Cancelado" },
                      ]}
                    />
                  </FormAcao>
                ) : (
                  <Selo tom={o.status === "concluido" ? "sucesso" : o.status === "cancelado" ? "neutro" : "info"}>
                    {o.status === "concluido" ? "Concluído" : o.status === "cancelado" ? "Cancelado" : "Em andamento"}
                  </Selo>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-border border-t border-border">
                {o.acoes.map((a) => {
                  const Icone = ICONE_ACAO[a.status];
                  const atrasada = a.prazo && a.prazo < hoje && (a.status === "pendente" || a.status === "em_andamento");
                  return (
                    <li key={a.id} id={`acao-${a.id}`} className="flex flex-col gap-3 px-5 py-4">
                      <div className="flex gap-3">
                        <Icone className={`mt-0.5 size-5 shrink-0 ${a.status === "concluida" ? "text-success" : a.status === "em_andamento" ? "text-teal-strong" : "text-muted-foreground"}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium ${a.status === "cancelada" ? "text-muted-foreground line-through" : ""}`}>{a.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {TIPO_ACAO[a.tipo]}
                            {a.prazo && (
                              <span className={atrasada ? "font-semibold text-destructive" : ""}> · {atrasada ? "atrasada, prazo " : "prazo "}{formatarData(a.prazo)}</span>
                            )}
                            {a.concluidaEm && ` · concluída em ${formatarData(a.concluidaEm)}`}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Selo tom={STATUS_ACAO[a.status].tom}>{STATUS_ACAO[a.status].nome}</Selo>
                            {a.compromissoOrigem && (
                              <Link href={`/feedback/${a.compromissoOrigem.reuniaoId}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-strong hover:underline">
                                <MessagesSquare className="size-3.5" aria-hidden /> Veio de um 1:1
                              </Link>
                            )}
                          </div>
                          {(a.evidencia || a.evidenciaUrl) && (
                            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                              <span className="font-medium">Evidência: </span>
                              {a.evidencia}
                              {a.evidenciaUrl && (
                                <a href={a.evidenciaUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-1 text-teal-strong hover:underline">
                                  link <ExternalLink className="size-3" aria-hidden />
                                </a>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      {podeEditar && (
                        <details className="pl-8 text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Atualizar progresso…</summary>
                          <FormAcao action={alterarAcao} textoBotao="Salvar" variante="outline" className="mt-2">
                            <input type="hidden" name="acaoId" value={a.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Selecao
                                nome="status"
                                idCampo={`status-acao-${a.id}`}
                                rotulo="Situação"
                                defaultValue={a.status}
                                opcoes={Object.entries(STATUS_ACAO).map(([valor, s]) => ({ valor, rotulo: s.nome }))}
                              />
                              <Campo nome="evidenciaUrl" idCampo={`url-${a.id}`} rotulo="Link da evidência" type="url" placeholder="https://" defaultValue={a.evidenciaUrl ?? ""} />
                            </div>
                            <Area nome="evidencia" idCampo={`ev-${a.id}`} rotulo="Evidência" ajuda="Obrigatória para concluir: o que foi feito e o resultado." defaultValue={a.evidencia ?? ""} rows={2} />
                          </FormAcao>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
              {podeEditar && o.status === "em_andamento" && (
                <details className="border-t border-border px-5 py-3 text-sm">
                  <summary className="cursor-pointer font-medium text-teal-strong">+ Incluir ação</summary>
                  <FormAcao action={adicionarAcao} textoBotao="Incluir ação" limparAoConcluir className="mt-3">
                    <input type="hidden" name="objetivoId" value={o.id} />
                    <Campo nome="titulo" idCampo={`titulo-acao-${o.id}`} rotulo="Ação" required />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Selecao nome="tipo" idCampo={`tipo-${o.id}`} rotulo="Tipo" opcoes={Object.entries(TIPO_ACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
                      <Campo nome="prazo" idCampo={`prazo-${o.id}`} rotulo="Prazo" type="date" min={iso(p.inicio)} max={iso(p.fim)} />
                    </div>
                  </FormAcao>
                </details>
              )}
            </Cartao>
          ))}

          {podeEditar && (
            <Cartao aria-labelledby="novo-obj">
              <CabecalhoCartao id="novo-obj" titulo="Novo objetivo" />
              <div className="px-5 pb-5">
                <FormAcao action={adicionarObjetivo} textoBotao="Incluir objetivo" limparAoConcluir>
                  <input type="hidden" name="pdiId" value={p.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo nome="titulo" rotulo="Objetivo" required placeholder="Ex.: Liderar reuniões de planejamento" />
                    <Campo nome="competencia" rotulo="Competência" placeholder="Ex.: Comunicação" />
                  </div>
                  <Area nome="descricao" rotulo="Como saberemos que foi atingido?" rows={2} />
                </FormAcao>
              </div>
            </Cartao>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {(podeCiclo || podeEditar) && !ctx.suporte && (
            <Cartao aria-labelledby="ciclo" className="p-5">
              <h3 id="ciclo" className="mb-3 font-heading text-base font-bold">
                Ciclo do plano
              </h3>
              <div className="flex flex-col gap-3">
                {podeCiclo && p.status === "rascunho" && (
                  <FormAcao action={alterarStatusPdi} textoBotao="Ativar PDI">
                    <input type="hidden" name="pdiId" value={p.id} />
                    <input type="hidden" name="acao" value="ativar" />
                  </FormAcao>
                )}
                {podeCiclo && p.status === "ativo" && (
                  <FormAcao action={alterarStatusPdi} textoBotao="Concluir PDI">
                    <input type="hidden" name="pdiId" value={p.id} />
                    <input type="hidden" name="acao" value="concluir" />
                  </FormAcao>
                )}
                {podeCiclo && !aberto && (
                  <FormAcao action={alterarStatusPdi} textoBotao="Reabrir PDI" variante="outline">
                    <input type="hidden" name="pdiId" value={p.id} />
                    <input type="hidden" name="acao" value="reabrir" />
                  </FormAcao>
                )}
                {podeEditar && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Editar título e período…</summary>
                    <FormAcao action={editarPdi} textoBotao="Salvar" variante="outline" className="mt-2">
                      <input type="hidden" name="pdiId" value={p.id} />
                      <Campo nome="titulo" idCampo="titulo-pdi" rotulo="Título" defaultValue={p.titulo} required />
                      <div className="grid grid-cols-2 gap-3">
                        <Campo nome="inicio" rotulo="Início" type="date" defaultValue={iso(p.inicio)} required />
                        <Campo nome="fim" rotulo="Fim" type="date" defaultValue={iso(p.fim)} required />
                      </div>
                    </FormAcao>
                  </details>
                )}
                {podeCiclo && p.status !== "arquivado" && (
                  <FormAcao action={alterarStatusPdi} textoBotao="Arquivar" variante="outline">
                    <input type="hidden" name="pdiId" value={p.id} />
                    <input type="hidden" name="acao" value="arquivar" />
                  </FormAcao>
                )}
              </div>
            </Cartao>
          )}

          <Cartao aria-labelledby="registros">
            <CabecalhoCartao id="registros" titulo="Acompanhamento" descricao="Comentários, revisões e histórico do plano." />
            <div className="flex flex-col gap-4 px-5 pb-5">
              {podeComentar && (
                <FormAcao action={registrarNoPdi} textoBotao="Registrar" limparAoConcluir>
                  <input type="hidden" name="pdiId" value={p.id} />
                  <Area nome="texto" rotulo="Novo registro" rows={3} required />
                  {podeRevisar ? (
                    <Selecao
                      nome="tipo"
                      rotulo="Tipo"
                      opcoes={[
                        { valor: "comentario", rotulo: "Comentário" },
                        { valor: "revisao", rotulo: "Revisão formal" },
                      ]}
                    />
                  ) : (
                    <input type="hidden" name="tipo" value="comentario" />
                  )}
                </FormAcao>
              )}
              <ol className="flex flex-col gap-3 border-t border-border pt-4">
                {p.registros.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      <span className={r.tipo === "revisao" ? "font-semibold text-teal-strong" : "font-medium"}>{REGISTRO[r.tipo]}</span> · {r.autorNome} ·{" "}
                      {formatarDataHora(r.criadoEm.toISOString())}
                    </p>
                    <p className={`whitespace-pre-line ${r.tipo === "evento" ? "text-muted-foreground" : ""}`}>{r.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Cartao>
        </div>
      </div>
    </>
  );
}
