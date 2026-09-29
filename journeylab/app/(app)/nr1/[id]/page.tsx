import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Download, EyeOff, Trash2, Users } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { equipesLideradas } from "@/lib/pulse/regras";
import { AVISO_NR1, faixa, filtroCiclos, PRIORIDADE, STATUS_ACAO_NR1, STATUS_CICLO, STATUS_RISCO } from "@/lib/nr1/regras";
import { adesaoNr1, indicesPorDimensao, resultadoNr1 } from "@/lib/nr1/consultas";
import {
  adicionarAcaoNr1,
  adicionarDimensao,
  adicionarPerguntaNr1,
  alterarAcaoNr1,
  alterarRisco,
  alterarStatusCiclo,
  excluirItemNr1,
  registrarRisco,
  salvarCiclo,
} from "@/lib/nr1/actions";
import { formatarData } from "@/lib/formato";
import { BarraProgresso } from "@/components/secao";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Interruptor, Marcadores, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Ciclo NR-1" };

const MOTIVO = {
  aberta: "Os resultados ficam disponíveis após o encerramento do ciclo.",
  minimo: "Este recorte não atingiu o mínimo de participantes para preservar o anonimato.",
  complemento: "Este recorte não pode ser exibido: combinado ao total, permitiria deduzir respostas de um grupo pequeno.",
} as const;

export default async function CicloPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "nr1", "visualizar");
  if (!escopo) redirect("/nr1");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const minhas = escopo === "equipe" ? await equipesLideradas(ctx) : [];
  const c = await db.cicloNr1.findFirst({
    where: { AND: [{ id }, filtroCiclos(escopo, minhas.map((e) => e.id))] },
    include: {
      dimensoes: { orderBy: { ordem: "asc" }, include: { perguntas: { orderBy: { ordem: "asc" } } } },
      riscos: { orderBy: [{ prioridade: "asc" }, { criadoEm: "asc" }], include: { dimensao: { select: { nome: true } }, acoes: { orderBy: { criadoEm: "asc" } } } },
    },
  });
  if (!c) notFound();

  const gestao = escopo === "todos" && !ctx.suporte;
  const podeEditar = gestao && pode(ctx, "nr1", "editar") === "todos";
  const rascunho = c.status === "rascunho";
  const todasEquipes = await db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const doPublico = (e: { id: string }) => c.publicoTodos || c.equipeIds.includes(e.id);
  const recortes = escopo === "todos" ? todasEquipes.filter(doPublico) : minhas.filter(doPublico);
  const equipeSel = recortes.find((e) => e.id === sp.equipe)?.id ?? (escopo === "todos" ? null : (recortes[0]?.id ?? null));

  const adesao = !rascunho && escopo === "todos" ? await adesaoNr1(ctx, c.id) : null;
  const resultado = c.status === "encerrado" && (escopo === "todos" || equipeSel) ? await resultadoNr1(ctx, c.id, equipeSel) : null;
  const indices = resultado ? indicesPorDimensao(resultado.linhas) : new Map<string, number>();
  if (resultado?.resumo?.liberado) {
    // Dado sensível: cada visualização de resultado fica registrada na auditoria.
    await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "nr1.resultado.visualizar", entidade: "ciclo_nr1", entidadeId: c.id, detalhes: { recorte: equipeSel ?? "organizacao" }, suporte: !!ctx.suporte });
  }
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/nr1" className="text-sm text-muted-foreground hover:text-foreground">
          ← Ciclos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{c.titulo}</h2>
          <Selo tom={STATUS_CICLO[c.status].tom}>{STATUS_CICLO[c.status].nome}</Selo>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          {c.publicoTodos ? "Toda a organização" : todasEquipes.filter((e) => c.equipeIds.includes(e.id)).map((e) => e.nome).join(", ")}
          {c.encerraEm && !c.encerradoEm && ` · encerramento previsto ${formatarData(c.encerraEm)}`}
          {c.encerradoEm && ` · encerrado em ${formatarData(c.encerradoEm)}`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          {c.status === "encerrado" && (
            <Cartao aria-labelledby="resultados">
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-3">
                <div>
                  <h3 id="resultados" className="font-heading text-base font-bold">
                    Resultados por dimensão
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    Índice de favorabilidade de 0 (desfavorável) a 100 (favorável)
                    {resultado?.resumo && ` · ${resultado.resumo.respondentes} participante(s) · mínimo ${resultado.resumo.minimo}`}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  {recortes.length > 0 && (
                    <form className="flex items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="recorte" className="text-xs font-semibold text-muted-foreground">
                          Recorte
                        </label>
                        <select id="recorte" name="equipe" defaultValue={equipeSel ?? ""} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                          {escopo === "todos" && <option value="">Toda a organização</option>}
                          {recortes.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Ver
                      </button>
                    </form>
                  )}
                  {pode(ctx, "nr1", "exportar") === "todos" && (
                    <a href={`/nr1/${c.id}/exportar`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                      <Download className="size-4" aria-hidden /> Relatório CSV
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4 px-5 pb-5">
                {!resultado?.resumo?.liberado ? (
                  <p className="flex items-start gap-2 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {resultado?.resumo?.motivo ? MOTIVO[resultado.resumo.motivo] : "Nenhum recorte disponível para você neste ciclo."}
                  </p>
                ) : (
                  c.dimensoes.map((d) => {
                    const ind = indices.get(d.id);
                    const f = ind !== undefined ? faixa(ind) : null;
                    return (
                      <details key={d.id} className="group rounded-md border border-border p-4">
                        <summary className="flex cursor-pointer list-none flex-col gap-2 [&::-webkit-details-marker]:hidden">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{d.nome}</span>
                            <span className="flex items-center gap-2">
                              <span className="font-heading text-lg font-bold tabular-nums">{ind !== undefined ? ind.toFixed(0) : "—"}</span>
                              {f && <Selo tom={f.tom}>{f.nome}</Selo>}
                            </span>
                          </span>
                          <BarraProgresso valor={ind ?? 0} rotulo={`Índice de ${d.nome}`} />
                          <span className="text-xs text-muted-foreground group-open:hidden">Ver perguntas</span>
                        </summary>
                        <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-sm">
                          {d.perguntas.map((q) => {
                            const l = resultado.linhas.find((x) => x.pergunta_id === q.id);
                            return (
                              <li key={q.id} className="flex items-start justify-between gap-3">
                                <span>
                                  {q.texto}
                                  {q.invertida && <span className="ml-1 text-xs text-muted-foreground">(frequência alta é desfavorável)</span>}
                                </span>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                  índice {l ? Number(l.indice).toFixed(0) : "—"} · média {l ? Number(l.media).toFixed(1).replace(".", ",") : "—"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    );
                  })
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">{AVISO_NR1}</p>
              </div>
            </Cartao>
          )}

          {c.status === "encerrado" && escopo === "todos" && (
            <Cartao aria-labelledby="riscos">
              <CabecalhoCartao id="riscos" titulo="Fatores de risco e plano de ação" descricao="Registrados pela gestão a partir dos resultados agregados." />
              <div className="flex flex-col gap-4 px-5 pb-5">
                {c.riscos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum fator de risco registrado.</p>}
                {c.riscos.map((r) => (
                  <div key={r.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{r.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.dimensao?.nome ?? "Sem dimensão"} · {STATUS_RISCO[r.status]} · registrado por {r.criadoPor}
                        </p>
                        {r.descricao && <p className="mt-1 text-sm text-muted-foreground">{r.descricao}</p>}
                      </div>
                      <Selo tom={PRIORIDADE[r.prioridade].tom}>Prioridade {PRIORIDADE[r.prioridade].nome.toLowerCase()}</Selo>
                    </div>
                    <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border">
                      {r.acoes.map((a) => (
                        <li key={a.id} className="flex flex-col gap-2 py-2.5 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={a.status === "cancelada" ? "text-muted-foreground line-through" : ""}>{a.titulo}</span>
                            <Selo tom={STATUS_ACAO_NR1[a.status].tom}>{STATUS_ACAO_NR1[a.status].nome}</Selo>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Responsável: {a.responsavelNome}
                            {a.prazo && ` · prazo ${formatarData(a.prazo)}`}
                            {a.evidencia && ` · evidência: ${a.evidencia}`}
                          </p>
                          {podeEditar && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Atualizar…</summary>
                              <FormAcao action={alterarAcaoNr1} textoBotao="Salvar" variante="outline" className="mt-2">
                                <input type="hidden" name="acaoId" value={a.id} />
                                <Selecao nome="status" idCampo={`st-${a.id}`} rotulo="Situação" defaultValue={a.status} opcoes={Object.entries(STATUS_ACAO_NR1).map(([valor, s]) => ({ valor, rotulo: s.nome }))} />
                                <Area nome="evidencia" idCampo={`ev-${a.id}`} rotulo="Evidência" ajuda="Obrigatória para concluir." defaultValue={a.evidencia ?? ""} rows={2} />
                              </FormAcao>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                    {podeEditar && (
                      <div className="mt-2 flex flex-col gap-3">
                        <details className="text-sm">
                          <summary className="cursor-pointer font-medium text-teal-strong">+ Incluir medida</summary>
                          <FormAcao action={adicionarAcaoNr1} textoBotao="Incluir medida" limparAoConcluir className="mt-2">
                            <input type="hidden" name="riscoId" value={r.id} />
                            <Campo nome="titulo" idCampo={`med-${r.id}`} rotulo="Medida" required />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Campo nome="responsavelNome" idCampo={`resp-${r.id}`} rotulo="Responsável" required />
                              <Campo nome="prazo" idCampo={`prazo-${r.id}`} rotulo="Prazo" type="date" />
                            </div>
                          </FormAcao>
                        </details>
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Alterar situação/prioridade…</summary>
                          <FormAcao action={alterarRisco} textoBotao="Salvar" variante="outline" className="mt-2">
                            <input type="hidden" name="riscoId" value={r.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Selecao nome="status" idCampo={`sr-${r.id}`} rotulo="Situação" defaultValue={r.status} opcoes={Object.entries(STATUS_RISCO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
                              <Selecao nome="prioridade" idCampo={`pr-${r.id}`} rotulo="Prioridade" defaultValue={r.prioridade} opcoes={Object.entries(PRIORIDADE).map(([valor, p]) => ({ valor, rotulo: p.nome }))} />
                            </div>
                          </FormAcao>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
                {podeEditar && (
                  <FormAcao action={registrarRisco} textoBotao="Registrar fator de risco" limparAoConcluir className="border-t border-border pt-4">
                    <input type="hidden" name="cicloId" value={c.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo nome="titulo" rotulo="Fator de risco" required placeholder="Ex.: Sobrecarga recorrente no fechamento mensal" />
                      <Selecao nome="dimensaoId" rotulo="Dimensão" opcoes={[{ valor: "", rotulo: "Sem dimensão" }, ...c.dimensoes.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                      <Area nome="descricao" rotulo="Descrição" rows={2} />
                      <Selecao nome="prioridade" rotulo="Prioridade" opcoes={Object.entries(PRIORIDADE).map(([valor, p]) => ({ valor, rotulo: p.nome }))} />
                    </div>
                  </FormAcao>
                )}
              </div>
            </Cartao>
          )}

          <Cartao aria-labelledby="questionario">
            <CabecalhoCartao id="questionario" titulo="Questionário" descricao={rascunho ? "Editável até a abertura. Escala de frequência: nunca a sempre." : "Fixo desde a abertura."} />
            <div className="flex flex-col gap-4 px-5 pb-5">
              {c.dimensoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma dimensão ainda.</p>}
              {c.dimensoes.map((d) => (
                <div key={d.id} className="rounded-md border border-border">
                  <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
                    <div>
                      <p className="font-medium">{d.nome}</p>
                      {d.descricao && <p className="text-xs text-muted-foreground">{d.descricao}</p>}
                    </div>
                    {rascunho && podeEditar && (
                      <form action={excluirItemNr1.bind(null, "dimensao", d.id)}>
                        <button type="submit" aria-label={`Excluir dimensão ${d.nome}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    )}
                  </div>
                  <ol className="flex flex-col divide-y divide-border">
                    {d.perguntas.map((q) => (
                      <li key={q.id} className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm">
                        <span>
                          {q.texto}
                          {q.invertida && <span className="ml-1 text-xs text-muted-foreground">(invertida)</span>}
                        </span>
                        {rascunho && podeEditar && (
                          <form action={excluirItemNr1.bind(null, "pergunta", q.id)}>
                            <button type="submit" aria-label="Excluir pergunta" className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ol>
                  {rascunho && podeEditar && (
                    <details className="border-t border-border px-4 py-2.5 text-sm">
                      <summary className="cursor-pointer font-medium text-teal-strong">+ Incluir pergunta</summary>
                      <FormAcao action={adicionarPerguntaNr1} textoBotao="Incluir" limparAoConcluir className="mt-2">
                        <input type="hidden" name="dimensaoId" value={d.id} />
                        <Campo nome="texto" idCampo={`q-${d.id}`} rotulo="Pergunta (afirmação de frequência)" required />
                        <Interruptor nome="invertida" rotulo="Invertida" ajuda="Marque quando responder “sempre” indica situação desfavorável." />
                      </FormAcao>
                    </details>
                  )}
                </div>
              ))}
              {rascunho && podeEditar && (
                <FormAcao action={adicionarDimensao} textoBotao="Incluir dimensão" variante="outline" limparAoConcluir>
                  <input type="hidden" name="cicloId" value={c.id} />
                  <Campo nome="nome" rotulo="Nova dimensão" placeholder="Ex.: Equilíbrio entre trabalho e vida pessoal" />
                </FormAcao>
              )}
            </div>
          </Cartao>
        </div>

        <div className="flex flex-col gap-4">
          {adesao && (
            <Cartao className="p-5">
              <p className="text-[13px] font-medium text-muted-foreground">Participação</p>
              <p className="font-heading text-[28px] font-bold tabular-nums">{adesao.publico ? Math.round((adesao.respondentes / adesao.publico) * 100) : 0}%</p>
              <BarraProgresso valor={adesao.publico ? Math.round((adesao.respondentes / adesao.publico) * 100) : 0} rotulo="Participação no ciclo" />
              <p className="mt-2 text-xs text-muted-foreground">
                {adesao.respondentes} de {adesao.publico} pessoas do público. Não mostramos quem participou.
              </p>
            </Cartao>
          )}

          {rascunho && podeEditar && (
            <Cartao aria-labelledby="config">
              <CabecalhoCartao id="config" titulo="Configuração" />
              <div className="px-5 pb-5">
                <FormAcao action={salvarCiclo} textoBotao="Salvar">
                  <input type="hidden" name="cicloId" value={c.id} />
                  <Campo nome="titulo" rotulo="Título" defaultValue={c.titulo} required />
                  <Area nome="descricao" rotulo="Mensagem aos participantes" defaultValue={c.descricao ?? ""} rows={3} />
                  <fieldset className="flex flex-col gap-2 text-sm">
                    <legend className="mb-1 text-[13px] font-semibold text-foreground/85">Público</legend>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="publico" value="todos" defaultChecked={c.publicoTodos} className="accent-[var(--primary)]" /> Toda a organização
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="publico" value="equipes" defaultChecked={!c.publicoTodos} className="accent-[var(--primary)]" /> Equipes selecionadas
                    </label>
                  </fieldset>
                  <Marcadores nome="equipeIds" rotulo="Equipes" opcoes={todasEquipes.map((e) => ({ valor: e.id, rotulo: e.nome }))} marcados={c.equipeIds} />
                  <Campo nome="encerraEm" rotulo="Encerramento previsto" type="date" defaultValue={iso(c.encerraEm)} />
                </FormAcao>
              </div>
            </Cartao>
          )}

          {gestao && (rascunho ? podeEditar : c.status === "aberto" && pode(ctx, "nr1", "concluir") === "todos") && (
            <Cartao className="flex flex-col gap-3 p-5">
              <h3 className="font-heading text-base font-bold">Ciclo</h3>
              {rascunho ? (
                <FormAcao action={alterarStatusCiclo} textoBotao="Abrir para participação">
                  <input type="hidden" name="cicloId" value={c.id} />
                  <input type="hidden" name="acao" value="abrir" />
                  <p className="text-xs text-muted-foreground">Ao abrir, questionário e público ficam fixos.</p>
                </FormAcao>
              ) : (
                <FormAcao action={alterarStatusCiclo} textoBotao="Encerrar e liberar resultados">
                  <input type="hidden" name="cicloId" value={c.id} />
                  <input type="hidden" name="acao" value="encerrar" />
                </FormAcao>
              )}
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
