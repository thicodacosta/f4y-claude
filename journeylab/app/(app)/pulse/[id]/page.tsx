import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { EyeOff, Trash2, Users } from "lucide-react";
import { exigirContexto, pode } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { calcularEnps, equipesLideradas, filtroPesquisas, STATUS_PESQUISA, TIPO_PERGUNTA } from "@/lib/pulse/regras";
import { adesaoPulse, resultadoPulse } from "@/lib/pulse/consultas";
import { adicionarPergunta, alterarStatusPesquisa, duplicarPesquisa, excluirPergunta, salvarPesquisa } from "@/lib/pulse/actions";
import { formatarData } from "@/lib/formato";
import { BarraProgresso } from "@/components/secao";
import { Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao, LinkExportar } from "@/components/app/painel";
import { FormAcao } from "@/components/admin/form-acao";
import { Area, Campo, Interruptor, Marcadores, Selecao } from "@/components/admin/campos";

export const metadata: Metadata = { title: "Pesquisa Pulse" };

const MOTIVO = {
  aberta: "Os resultados ficam disponíveis após o encerramento da pesquisa.",
  minimo: "Este recorte ainda não atingiu o mínimo de respondentes para preservar o anonimato.",
  complemento: "Este recorte não pode ser exibido: combinado ao total, permitiria deduzir respostas de um grupo pequeno.",
} as const;

function Barra({ rotulo, valor, total }: { rotulo: string; valor: number; total: number }) {
  const pct = total ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3 text-xs">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right tabular-nums">{pct}%</span>
    </div>
  );
}

export default async function PesquisaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await exigirContexto();
  const escopo = pode(ctx, "pulse", "visualizar");
  if (!escopo) redirect("/pulse");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const minhas = escopo === "equipe" ? await equipesLideradas(ctx) : [];
  const p = await db.pesquisaPulse.findFirst({
    where: { AND: [{ id }, filtroPesquisas(escopo, minhas.map((e) => e.id))] },
    include: { perguntas: { orderBy: { ordem: "asc" } } },
  });
  if (!p) notFound();

  const gestao = escopo === "todos" && !ctx.suporte;
  const podeEditar = gestao && pode(ctx, "pulse", "editar") === "todos" && p.status === "rascunho";
  const podeEncerrar = gestao && pode(ctx, "pulse", "concluir") === "todos" && p.status === "aberta";
  const podeDuplicar = gestao && pode(ctx, "pulse", "criar") === "todos";
  const todasEquipes = await db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });

  // Recortes permitidos: organização inteira (escopo todos) + equipes do público (todos) ou lideradas (equipe).
  const doPublico = (e: { id: string }) => p.publicoTodos || p.equipeIds.includes(e.id);
  const recortes = escopo === "todos" ? todasEquipes.filter(doPublico) : minhas.filter(doPublico);
  const equipeSel = recortes.find((e) => e.id === sp.equipe)?.id ?? (escopo === "todos" ? null : (recortes[0]?.id ?? null));
  const podeVerRecorte = escopo === "todos" || !!equipeSel;

  const adesao = p.status !== "rascunho" && escopo === "todos" ? await adesaoPulse(ctx, p.id) : null;
  const resultado = p.status === "encerrada" && podeVerRecorte ? await resultadoPulse(ctx, p.id, equipeSel) : null;
  const linha = (qid: string) => resultado?.linhas.find((l) => l.pergunta_id === qid);
  const comentariosDe = (qid: string) => resultado?.comentarios.filter((c) => c.pergunta_id === qid) ?? [];

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/pulse" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pesquisas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-bold">{p.titulo}</h2>
          <Selo tom={STATUS_PESQUISA[p.status].tom}>{STATUS_PESQUISA[p.status].nome}</Selo>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          {p.publicoTodos ? "Toda a organização" : todasEquipes.filter((e) => p.equipeIds.includes(e.id)).map((e) => e.nome).join(", ")}
          {p.encerraEm && ` · encerramento previsto ${formatarData(p.encerraEm)}`}
          {p.encerradaEm && ` · encerrada em ${formatarData(p.encerradaEm)}`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          {p.status === "encerrada" && (
            <Cartao aria-labelledby="resultados">
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-3">
                <div>
                  <h3 id="resultados" className="font-heading text-base font-bold">
                    Resultados
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {resultado?.resumo ? `${resultado.resumo.respondentes} respondente(s) neste recorte · mínimo ${resultado.resumo.minimo}` : "Escolha um recorte."}
                  </p>
                </div>
                {gestao && pode(ctx, "pulse", "exportar") === "todos" && <LinkExportar href={`/pulse/${p.id}/exportar`}>Resultados CSV</LinkExportar>}
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
              </div>
              <div className="flex flex-col gap-5 px-5 pb-5">
                {!resultado?.resumo?.liberado ? (
                  <p className="flex items-start gap-2 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {resultado?.resumo?.motivo ? MOTIVO[resultado.resumo.motivo] : "Nenhum recorte disponível para você nesta pesquisa."}
                  </p>
                ) : (
                  p.perguntas.map((q, n) => {
                    const l = linha(q.id);
                    const dist = l?.distribuicao ?? {};
                    const total = l?.respostas ?? 0;
                    return (
                      <div key={q.id} className="flex flex-col gap-2 border-t border-border pt-4 first:border-0 first:pt-0">
                        <p className="text-sm font-medium">
                          {n + 1}. {q.texto}
                        </p>
                        {q.tipo === "escala" && (
                          <>
                            <p className="font-heading text-2xl font-bold tabular-nums">
                              {l?.media ? Number(l.media).toFixed(1).replace(".", ",") : "—"}
                              <span className="ml-1 text-sm font-normal text-muted-foreground">de 5 · {total} respostas</span>
                            </p>
                            {[5, 4, 3, 2, 1].map((v) => (
                              <Barra key={v} rotulo={`${v}`} valor={dist[v] ?? 0} total={total} />
                            ))}
                          </>
                        )}
                        {q.tipo === "enps" &&
                          (() => {
                            const e = calcularEnps(dist);
                            return e ? (
                              <>
                                <p className="font-heading text-2xl font-bold tabular-nums">
                                  {e.enps > 0 ? `+${e.enps}` : e.enps}
                                  <span className="ml-1 text-sm font-normal text-muted-foreground">eNPS · {e.total} respostas</span>
                                </p>
                                <Barra rotulo="Prom." valor={e.promotores} total={e.total} />
                                <Barra rotulo="Neutros" valor={e.neutros} total={e.total} />
                                <Barra rotulo="Detrat." valor={e.detratores} total={e.total} />
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Sem respostas.</p>
                            );
                          })()}
                        {q.tipo === "sim_nao" && (
                          <>
                            <Barra rotulo="Sim" valor={dist[1] ?? 0} total={total} />
                            <Barra rotulo="Não" valor={dist[0] ?? 0} total={total} />
                          </>
                        )}
                        {q.tipo === "texto" &&
                          (comentariosDe(q.id).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
                          ) : (
                            <ul className="flex flex-col gap-2">
                              {comentariosDe(q.id).map((c, i) => (
                                <li key={i} className="rounded-md bg-muted px-3 py-2 text-sm">
                                  “{c.texto}”
                                </li>
                              ))}
                            </ul>
                          ))}
                      </div>
                    );
                  })
                )}
              </div>
            </Cartao>
          )}

          <Cartao aria-labelledby="perguntas">
            <CabecalhoCartao id="perguntas" titulo="Perguntas" descricao={podeEditar ? "Editáveis até a abertura." : "Fixas desde a abertura."} />
            <ol className="flex flex-col divide-y divide-border border-t border-border">
              {p.perguntas.map((q, n) => (
                <li key={q.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {n + 1}. {q.texto}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_PERGUNTA[q.tipo]} · {q.obrigatoria ? "obrigatória" : "opcional"}
                    </p>
                  </div>
                  {podeEditar && (
                    <form action={excluirPergunta.bind(null, q.id)}>
                      <button type="submit" aria-label={`Excluir pergunta ${n + 1}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {p.perguntas.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nenhuma pergunta ainda.</li>}
            </ol>
            {podeEditar && (
              <div className="border-t border-border px-5 py-4">
                <FormAcao action={adicionarPergunta} textoBotao="Incluir pergunta" limparAoConcluir>
                  <input type="hidden" name="pesquisaId" value={p.id} />
                  <Campo nome="texto" rotulo="Pergunta" required maxLength={300} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Selecao nome="tipo" rotulo="Tipo" opcoes={Object.entries(TIPO_PERGUNTA).map(([valor, rotulo]) => ({ valor, rotulo }))} />
                    <div className="flex items-end pb-2">
                      <Interruptor nome="obrigatoria" rotulo="Obrigatória" marcado ajuda="Comentários livres são sempre opcionais." />
                    </div>
                  </div>
                </FormAcao>
              </div>
            )}
          </Cartao>
        </div>

        <div className="flex flex-col gap-4">
          {adesao && (
            <Cartao className="p-5">
              <p className="text-[13px] font-medium text-muted-foreground">Adesão</p>
              <p className="font-heading text-[28px] font-bold tabular-nums">
                {adesao.publico ? Math.round((adesao.respondentes / adesao.publico) * 100) : 0}%
              </p>
              <BarraProgresso valor={adesao.publico ? Math.round((adesao.respondentes / adesao.publico) * 100) : 0} rotulo="Adesão à pesquisa" />
              <p className="mt-2 text-xs text-muted-foreground">
                {adesao.respondentes} de {adesao.publico} pessoas do público. Não mostramos quem respondeu.
              </p>
            </Cartao>
          )}

          {podeEditar && (
            <Cartao aria-labelledby="config">
              <CabecalhoCartao id="config" titulo="Configuração" />
              <div className="px-5 pb-5">
                <FormAcao action={salvarPesquisa} textoBotao="Salvar">
                  <input type="hidden" name="pesquisaId" value={p.id} />
                  <Campo nome="titulo" rotulo="Título" defaultValue={p.titulo} required />
                  <Area nome="descricao" rotulo="Mensagem aos participantes" defaultValue={p.descricao ?? ""} rows={2} />
                  <fieldset className="flex flex-col gap-2 text-sm">
                    <legend className="mb-1 text-[13px] font-semibold text-foreground/85">Público</legend>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="publico" value="todos" defaultChecked={p.publicoTodos} className="accent-[var(--primary)]" /> Toda a organização
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="publico" value="equipes" defaultChecked={!p.publicoTodos} className="accent-[var(--primary)]" /> Equipes selecionadas
                    </label>
                  </fieldset>
                  <Marcadores nome="equipeIds" rotulo="Equipes" opcoes={todasEquipes.map((e) => ({ valor: e.id, rotulo: e.nome }))} marcados={p.equipeIds} />
                  <Campo nome="encerraEm" rotulo="Encerramento previsto" type="date" defaultValue={p.encerraEm ? p.encerraEm.toISOString().slice(0, 10) : ""} ajuda="Após essa data não aceita respostas. O encerramento formal libera os resultados." />
                </FormAcao>
              </div>
            </Cartao>
          )}

          {(podeEditar || podeEncerrar || podeDuplicar) && (
            <Cartao className="flex flex-col gap-3 p-5">
              <h3 className="font-heading text-base font-bold">Ciclo da pesquisa</h3>
              {podeEditar && (
                <FormAcao action={alterarStatusPesquisa} textoBotao="Abrir para respostas">
                  <input type="hidden" name="pesquisaId" value={p.id} />
                  <input type="hidden" name="acao" value="abrir" />
                  <p className="text-xs text-muted-foreground">Ao abrir, perguntas e público ficam fixos.</p>
                </FormAcao>
              )}
              {podeEncerrar && (
                <FormAcao action={alterarStatusPesquisa} textoBotao="Encerrar e liberar resultados">
                  <input type="hidden" name="pesquisaId" value={p.id} />
                  <input type="hidden" name="acao" value="encerrar" />
                </FormAcao>
              )}
              {podeDuplicar && p.status !== "rascunho" && (
                <FormAcao action={duplicarPesquisa} textoBotao="Nova rodada (duplicar)" variante="outline">
                  <input type="hidden" name="pesquisaId" value={p.id} />
                </FormAcao>
              )}
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
