import { NextResponse } from "next/server";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { data } from "@/lib/exportar";
import { carregarRelatorioNr1 } from "@/lib/nr1/relatorio";
import { faixaDe, LIMITACOES, MOTIVO_OCULTO } from "@/lib/nr1/calculo";
import { PRIORIDADE, STATUS_ACAO_NR1, STATUS_RISCO } from "@/lib/nr1/regras";

/**
 * CSV com os MESMOS dados e ocultações da tela e do relatório (carregarRelatorioNr1):
 * scores agregados por fator e recorte liberado, e o plano de ação. Nunca contém
 * respostas individuais. Auditado.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let acesso;
  try {
    acesso = await exigirPermissaoAcao("nr1", "exportar");
  } catch (e) {
    return NextResponse.json({ erro: e instanceof ErroAcesso ? e.message : "Não autorizado" }, { status: 403 });
  }
  const { ctx, db } = acesso;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const rel = await carregarRelatorioNr1(ctx, id);
  if (!rel || rel.ciclo.status !== "encerrado") return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const { ciclo: c, organizacao, departamentos } = rel;

  const linhas: unknown[][] = [
    ["Diagnóstico", c.titulo],
    ["Período", `${data(c.dataInicio)} a ${data(c.encerradoEm ?? c.encerraEm)}`],
    ["Metodologia", c.metodologiaVersao],
    ["Gerado em", new Date().toISOString().slice(0, 10)],
    ["Limitações", LIMITACOES],
    [],
    ["Recorte", "Respostas consideradas", "Fator", "Score indicativo (0–100)", "Faixa", "Observação"],
  ];
  for (const r of [...(organizacao ? [organizacao] : []), ...departamentos]) {
    if (!r.resumo?.liberado) {
      linhas.push([r.nome, "", "", "", "", MOTIVO_OCULTO[r.resumo?.motivo ?? "minimo"]]);
      continue;
    }
    for (const f of r.fatores)
      linhas.push([r.nome, r.resumo.respondentes, f.nome, f.score ?? "", f.score !== null ? faixaDe(f.score, c.faixas).nome : "", f.score === null ? "Dados insuficientes para exibição segura" : ""]);
  }
  linhas.push([], ["Plano de ação"], ["Fator priorizado", "Fator", "Prioridade", "Status", "Ação", "Responsável", "Prazo", "Status da ação", "Origem", "Revisado por", "Revisado em", "Evidência"]);
  for (const r of c.riscos)
    for (const a of r.acoes.length ? r.acoes : [null])
      linhas.push([
        r.titulo,
        r.dimensao?.nome ?? "Geral",
        PRIORIDADE[r.prioridade].nome,
        STATUS_RISCO[r.status],
        a?.titulo ?? "",
        a?.responsavelNome ?? "",
        data(a?.prazo),
        a ? STATUS_ACAO_NR1[a.status].nome : "",
        a ? (a.origem === "ia" ? "IA (revisada)" : "Humana") : r.origem === "ia" ? "IA (revisada)" : "Humana",
        a?.revisadoPor ?? r.revisadoPor ?? "",
        data(a?.revisadoEm ?? r.revisadoEm),
        a?.evidencia ?? "",
      ]);
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "nr1.exportar", entidade: "ciclo_nr1", entidadeId: c.id });
  return respostaCsv(linhas, "diagnostico-nr1");
}
