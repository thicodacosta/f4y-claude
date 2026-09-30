import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { carregarRelatorioNr1 } from "@/lib/nr1/relatorio";
import { faixaDe, LIMITACOES, MOTIVO_OCULTO } from "@/lib/nr1/calculo";
import { AUDIENCIA_NR1, PRIORIDADE, STATUS_ACAO_NR1, STATUS_RISCO } from "@/lib/nr1/regras";
import { ESCALA_NR1, TIPO_DIAGNOSTICO } from "@/lib/nr1/questionario";
import { BarrasFatores, LegendaFaixas, MatrizIndicativa } from "@/components/nr1/graficos";
import { BotaoImprimir } from "@/components/nr1/imprimir";

export const metadata: Metadata = { title: "Relatório · NR-1" };

/**
 * Relatório para PDF (impressão do navegador). Usa exatamente os mesmos dados e
 * ocultações da tela (carregarRelatorioNr1). Auditado.
 */
export default async function RelatorioNr1({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, db } = await exigirModulo("nr1");
  if (!pode(ctx, "nr1", "exportar")) redirect(`/nr1/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const rel = await carregarRelatorioNr1(ctx, id);
  if (!rel) notFound();
  const { ciclo: c, organizacao, departamentos } = rel;
  if (c.status !== "encerrado") redirect(`/nr1/${id}`);
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "nr1.relatorio", entidade: "ciclo_nr1", entidadeId: c.id });
  const acoes = c.riscos.flatMap((r) => r.acoes);
  const revisadas = acoes.filter((a) => a.revisadoPor).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/nr1/${c.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {c.titulo}
        </Link>
        <BotaoImprimir />
      </div>
      <article className="relatorio-folha flex flex-col gap-5 rounded-lg border border-border bg-card p-6 text-sm shadow-surface">
        <header>
          <p className="text-xs text-muted-foreground">
            {ctx.org.nome} · Diagnóstico NR-1 · gerado em {formatarDataHora(new Date().toISOString())} por {ctx.usuario.nome}
          </p>
          <h1 className="font-heading text-2xl font-bold">{c.titulo}</h1>
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Período: </dt>
              <dd className="inline">
                {c.dataInicio ? formatarData(c.dataInicio) : "—"} a {c.encerradoEm ? formatarData(c.encerradoEm) : c.encerraEm ? formatarData(c.encerraEm) : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Questionário: </dt>
              <dd className="inline">
                {c.metodologiaVersao === "legado" ? "anterior" : TIPO_DIAGNOSTICO[c.tipo].nome} · metodologia {c.metodologiaVersao}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Audiência: </dt>
              <dd className="inline">
                {AUDIENCIA_NR1[c.audienciaTipo as keyof typeof AUDIENCIA_NR1] ?? c.audienciaTipo} · {c.publicoTotal} elegíveis
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Respostas consideradas: </dt>
              <dd className="inline">{organizacao?.resumo?.liberado ? organizacao.resumo.respondentes : "dados insuficientes para exibição segura"}</dd>
            </div>
          </dl>
        </header>

        <section>
          <h2 className="mb-2 font-heading text-lg font-bold">Método de pontuação</h2>
          <p className="text-muted-foreground">
            Escala: {ESCALA_NR1.map((e) => `${e.valor} = ${e.rotulo}`).join(", ")}. Itens positivos com pontuação reversa (6 − resposta). Score do fator = arredondar(((média − 1) ÷ 4) × 100); maior
            score = mais exposição relatada. Respostas “prefiro não responder” não entram no cálculo. Fatores e recortes com menos de {ctx.org.minimoRecorte} respostas não são exibidos.
          </p>
          <div className="mt-2">
            <LegendaFaixas faixas={c.faixas} />
          </div>
        </section>

        {organizacao && (
          <section>
            <h2 className="mb-2 font-heading text-lg font-bold">Resultados agregados da organização</h2>
            {organizacao.resumo?.liberado ? (
              <>
                <p className="mb-3">
                  Score indicativo geral: <strong>{organizacao.geral ?? "—"}</strong>
                  {organizacao.geral !== null && ` (${faixaDe(organizacao.geral, c.faixas).nome})`}
                </p>
                <BarrasFatores fatores={organizacao.fatores} faixas={c.faixas} />
              </>
            ) : (
              <p className="text-muted-foreground">{MOTIVO_OCULTO[organizacao.resumo?.motivo ?? "minimo"]}</p>
            )}
          </section>
        )}

        {departamentos.length > 0 && (
          <section>
            <h2 className="mb-2 font-heading text-lg font-bold">Departamentos</h2>
            <ul className="flex flex-col gap-1">
              {departamentos.map((d) => (
                <li key={d.id}>
                  <strong>{d.nome}:</strong>{" "}
                  {d.resumo?.liberado ? `score geral ${d.geral ?? "—"} · amostra ${d.resumo.respondentes}` : MOTIVO_OCULTO[d.resumo?.motivo ?? "minimo"]}
                </li>
              ))}
            </ul>
          </section>
        )}

        {organizacao?.resumo?.liberado && (
          <section>
            <h2 className="mb-2 font-heading text-lg font-bold">Matriz indicativa da pesquisa</h2>
            <p className="mb-2 text-muted-foreground">
              Referência do produto, {c.matrizRevisadaEm ? `revisada por ${c.matrizRevisadaPor} em ${formatarData(c.matrizRevisadaEm)}` : "ainda não revisada pela organização"}. Não é a matriz de risco oficial
              até validação conforme a metodologia do GRO/PGR.
            </p>
            <MatrizIndicativa fatores={organizacao.fatores} faixas={c.faixas} />
          </section>
        )}

        <section>
          <h2 className="mb-2 font-heading text-lg font-bold">Plano de ação</h2>
          <p className="mb-2 text-muted-foreground">
            Status de revisão: {revisadas} de {acoes.length} ação(ões) com revisão humana registrada.
          </p>
          {c.riscos.length === 0 && <p className="text-muted-foreground">Nenhum item registrado.</p>}
          {c.riscos.map((r) => (
            <div key={r.id} className="mb-3">
              <p className="font-semibold">
                {r.titulo} · {r.dimensao?.nome ?? "Geral"} · prioridade {PRIORIDADE[r.prioridade].nome.toLowerCase()} · {STATUS_RISCO[r.status]}
              </p>
              <ul className="list-disc pl-5">
                {r.acoes.map((a) => (
                  <li key={a.id}>
                    {a.titulo} — {a.responsavelNome}, prazo {a.prazo ? formatarData(a.prazo) : "—"}, {STATUS_ACAO_NR1[a.status].nome.toLowerCase()}; origem {a.origem === "ia" ? "IA (revisada)" : "humana"}
                    {a.revisadoPor ? `, revisada por ${a.revisadoPor}` : ""}
                    {a.evidencia ? `; evidência: ${a.evidencia}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-bold">Limitações de interpretação</h2>
          <p className="text-muted-foreground">{LIMITACOES}</p>
        </section>
      </article>
    </>
  );
}
