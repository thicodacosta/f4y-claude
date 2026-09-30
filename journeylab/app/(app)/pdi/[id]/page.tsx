import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, ExternalLink, MessagesSquare, Pencil } from "lucide-react";
import { exigirModulo, pode } from "@/lib/contexto";
import { hoje } from "@/lib/datas";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { acaoVencida, calcularFoco, calcularPdi, formatarBRL, progressoAcao, RESPONSAVEL_ACAO, STATUS_ACAO, STATUS_PDI, TIPO_ACAO, type StatusAcao } from "@/lib/pdi/calculo";
import { nomeFoco } from "@/lib/pdi/focos";
import { cobrePdi, filtroPdis } from "@/lib/pdi/regras";
import { filtroAvaliacoes } from "@/lib/feedback/regras";
import { SEMAFORO, umaCasa } from "@/lib/feedback/avaliacao";
import { BarraProgresso } from "@/components/secao";
import { Iniciais, Selo } from "@/components/app/lista";
import { Cartao, CabecalhoCartao, LinkExportar } from "@/components/app/painel";
import { AtualizarAcao, ComentarAcao, ExcluirPdi, RegistrarRevisao } from "@/components/pdi/acoes-detalhe";

export const metadata: Metadata = { title: "PDI" };

const ICONE = { nao_iniciada: Circle, em_andamento: CircleDot, concluida: CheckCircle2 } as const;
const REGISTRO = { comentario: "Comentário", revisao: "Revisão", evento: "Atualização" } as const;

export default async function PdiDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, escopo, db } = await exigirModulo("pdi");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.pdi.findFirst({
    where: { AND: [{ id }, filtroPdis(ctx, escopo)] },
    include: {
      colaborador: { select: { id: true, nome: true, cargo: true, gestorId: true, gestor: { select: { nome: true } }, equipe: { select: { nome: true, area: { select: { nome: true } } } } } },
      focos: {
        orderBy: { ordem: "asc" },
        include: {
          acoes: {
            orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
            include: { comentarios: { orderBy: { criadoEm: "asc" } }, compromissoOrigem: { select: { reuniaoId: true } } },
          },
        },
      },
      registros: { orderBy: { criadoEm: "desc" }, take: 60 },
    },
  });
  if (!p) notFound();

  const h = hoje();
  const c = calcularPdi(p.focos, h);
  const acoes = p.focos.flatMap((f) => f.acoes);
  const vencidas = acoes.filter((a) => acaoVencida(a, h));
  const investimento = acoes.reduce((s, a) => s + (a.investimento ? Number(a.investimento.toString()) : 0), 0);
  const podeEditar = !ctx.suporte && cobrePdi(ctx, pode(ctx, "pdi", "editar"), p.colaborador);
  const podeExcluir = !ctx.suporte && pode(ctx, "pdi", "editar") === "todos";

  // Contexto de Feedback 1:1 só se a empresa contrata o módulo e o usuário o acessa.
  const escopoFeedback = ctx.modulos.has("feedback") ? pode(ctx, "feedback", "visualizar") : null;
  const feedbacks = escopoFeedback
    ? await db.avaliacaoFeedback.findMany({
        where: { AND: [{ colaboradorId: p.colaborador.id }, filtroAvaliacoes(ctx, escopoFeedback)] },
        select: { id: true, data: true, mediaGeral: true, semaforo: true },
        orderBy: { data: "desc" },
        take: 3,
      })
    : [];

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/pdi" className="text-sm text-muted-foreground hover:text-foreground">
          ← PDIs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Iniciais nome={p.colaborador.nome} className="size-12 text-base" />
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-bold">
                {p.titulo} <Selo tom={STATUS_PDI[c.status].tom}>{STATUS_PDI[c.status].nome}</Selo>
              </h2>
              <p className="text-sm text-muted-foreground">
                {p.colaborador.nome} · {p.colaborador.cargo ?? "cargo não informado"} · {p.colaborador.equipe?.area?.nome ?? p.colaborador.equipe?.nome ?? "sem departamento"} · Gestor: {p.colaborador.gestor?.nome ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {podeEditar && (
              <Link href={`/pdi/${p.id}/editar`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                <Pencil className="size-4" aria-hidden /> Editar
              </Link>
            )}
            {pode(ctx, "pdi", "exportar") && <LinkExportar href={`/pdi/exportar?pdi=${p.id}`} />}
            {podeExcluir && <ExcluirPdi id={p.id} titulo={p.titulo} />}
          </div>
        </div>
        {p.descricao && <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{p.descricao}</p>}
      </div>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Progresso</p>
          <p className="font-heading text-[28px] font-bold tabular-nums">{c.progresso}%</p>
          <BarraProgresso valor={c.progresso} rotulo="Progresso do PDI" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Período</p>
          <p className="mt-1 font-semibold tabular-nums">
            {formatarData(p.inicio)} – {formatarData(p.fim)}
          </p>
          <p className="text-xs text-muted-foreground">Criado por {p.criadoPor}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Ações por status</p>
          <ul className="mt-1 flex flex-col text-sm tabular-nums">
            {(Object.keys(STATUS_ACAO) as StatusAcao[]).map((s) => (
              <li key={s}>
                {STATUS_ACAO[s].nome}: <strong>{c.porStatus[s] ?? 0}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-surface">
          <p className="text-[13px] font-medium text-muted-foreground">Investimento estimado total</p>
          <p className="font-heading text-[28px] font-bold tabular-nums">{formatarBRL(investimento)}</p>
        </div>
      </section>

      {vencidas.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-semibold">
              {vencidas.length} ação(ões) vencida(s) — o plano está em risco.
            </p>
            <ul className="mt-1 list-disc pl-5">
              {vencidas.map((a) => (
                <li key={a.id}>
                  <a href={`#acao-${a.id}`} className="hover:underline">
                    {a.descricao}
                  </a>{" "}
                  · prazo {formatarData(a.prazo!)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {c.incompleto && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {p.focos.length === 0 ? "Este plano ainda não tem focos." : "Há foco(s) sem ações."} O PDI só é concluído quando cada foco tem ações e todas estão concluídas.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,360px)]">
        <div className="flex min-w-0 flex-col gap-3">
          {p.focos.map((f, n) => {
            const cf = calcularFoco(f);
            return (
              <details key={f.id} open className="group rounded-lg border border-border bg-card shadow-surface">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-muted-foreground">Foco {n + 1}</span>
                    <span className="font-heading text-lg font-bold">{nomeFoco(f.focoChave, f.nomePersonalizado)}</span>
                  </span>
                  <span className="flex w-48 flex-col gap-1">
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      {cf.progresso}% · {f.acoes.length} ação(ões)
                    </span>
                    <BarraProgresso valor={cf.progresso} rotulo={`Progresso do foco ${nomeFoco(f.focoChave, f.nomePersonalizado)}`} />
                  </span>
                </summary>
                <div className="flex flex-col gap-4 border-t border-border px-5 py-4">
                  <dl className="grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold text-muted-foreground">Descrição</dt>
                      <dd className="whitespace-pre-line">{f.descricao || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-muted-foreground">Por que desenvolver</dt>
                      <dd className="whitespace-pre-line">{f.importancia || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-muted-foreground">Objetivo</dt>
                      <dd className="whitespace-pre-line">{f.objetivo || "—"}</dd>
                    </div>
                  </dl>
                  {cf.vazio && <p className="text-sm text-muted-foreground">Nenhuma ação neste foco.{podeEditar && " Use “Editar” para incluir."}</p>}
                  <ul className="flex flex-col gap-3">
                    {f.acoes.map((a) => {
                      const Icone = ICONE[a.status];
                      const vencida = acaoVencida(a, h);
                      return (
                        <li key={a.id} id={`acao-${a.id}`} className={`scroll-mt-24 rounded-md border p-4 ${vencida ? "border-destructive/50" : "border-border"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="flex min-w-0 items-start gap-2 font-medium">
                              <Icone className={`mt-0.5 size-4 shrink-0 ${a.status === "concluida" ? "text-success" : "text-muted-foreground"}`} aria-hidden />
                              {a.descricao}
                            </p>
                            <span className="flex items-center gap-2">
                              <Selo tom={STATUS_ACAO[a.status].tom}>{STATUS_ACAO[a.status].nome}</Selo>
                              <span className="text-sm font-semibold tabular-nums">{progressoAcao(a)}%</span>
                            </span>
                          </div>
                          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <dt className="inline text-muted-foreground">Tipo: </dt>
                              <dd className="inline">{TIPO_ACAO[a.tipo]}</dd>
                            </div>
                            <div>
                              <dt className="inline text-muted-foreground">Responsável: </dt>
                              <dd className="inline">{RESPONSAVEL_ACAO[a.responsavel]}</dd>
                            </div>
                            <div>
                              <dt className="inline text-muted-foreground">Período: </dt>
                              <dd className={`inline tabular-nums ${vencida ? "font-semibold text-destructive" : ""}`}>
                                {a.inicio ? `${formatarData(a.inicio)} – ` : ""}
                                {a.prazo ? formatarData(a.prazo) : "sem prazo"}
                                {vencida && " · vencida"}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline text-muted-foreground">Investimento estimado: </dt>
                              <dd className="inline tabular-nums">{formatarBRL(a.investimento)}</dd>
                            </div>
                            {a.impacto && (
                              <div className="sm:col-span-2">
                                <dt className="inline text-muted-foreground">Impacto esperado (estimativa): </dt>
                                <dd className="inline">{a.impacto}</dd>
                              </div>
                            )}
                            {a.mentor && (
                              <div>
                                <dt className="inline text-muted-foreground">Mentor: </dt>
                                <dd className="inline">{a.mentor}</dd>
                              </div>
                            )}
                          </dl>
                          {a.compromissoOrigem && (
                            <Link href={`/feedback/${a.compromissoOrigem.reuniaoId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-strong hover:underline">
                              <MessagesSquare className="size-3.5" aria-hidden /> Origem: compromisso de 1:1
                            </Link>
                          )}
                          {(a.evidencia || a.evidenciaUrl) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Evidência: {a.evidencia}{" "}
                              {a.evidenciaUrl && (
                                <a href={a.evidenciaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-teal-strong hover:underline">
                                  link <ExternalLink className="size-3" aria-hidden />
                                </a>
                              )}
                            </p>
                          )}
                          {a.comentarios.length > 0 && (
                            <ul className="mt-3 flex flex-col gap-2 border-l-2 border-border pl-3">
                              {a.comentarios.map((cm) => (
                                <li key={cm.id} className="text-sm">
                                  <p className="whitespace-pre-line">{cm.tipo === "fala_colaborador" ? `“${cm.texto}”` : cm.texto}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {cm.tipo === "fala_colaborador" ? `Fala de ${p.colaborador.nome}, registrada por ${cm.autorNome}` : cm.autorNome} · {formatarDataHora(cm.criadoEm.toISOString())}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                          {podeEditar && (
                            <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                              <AtualizarAcao id={a.id} status={a.status} progresso={a.progresso} rotulo={a.descricao} />
                              <ComentarAcao id={a.id} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          {feedbacks.length > 0 && (
            <Cartao aria-labelledby="feedback">
              <CabecalhoCartao id="feedback" titulo="Contexto do Feedback 1:1" descricao="Últimos feedbacks registrados (escala 1–5)." />
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {feedbacks.map((fb) => (
                  <li key={fb.id}>
                    <Link href={`/feedback/avaliacoes/${fb.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                      <span>{formatarData(fb.data)}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">Geral {umaCasa(fb.mediaGeral)}</span>
                        <Selo tom={SEMAFORO[fb.semaforo].tom}>{SEMAFORO[fb.semaforo].nome.split(" · ")[0]}</Selo>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
          {podeEditar && (
            <Cartao className="p-5">
              <RegistrarRevisao id={p.id} />
            </Cartao>
          )}
          <Cartao aria-labelledby="historico">
            <CabecalhoCartao id="historico" titulo="Histórico" />
            <ol className="flex flex-col gap-3 px-5 pb-5">
              {p.registros.length === 0 && <li className="text-sm text-muted-foreground">Sem registros.</li>}
              {p.registros.map((r) => (
                <li key={r.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">
                    {REGISTRO[r.tipo]} · {r.autorNome} · {formatarDataHora(r.criadoEm.toISOString())}
                  </p>
                  <p className="whitespace-pre-line">{r.texto}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </>
  );
}
