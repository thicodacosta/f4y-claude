import type { NextRequest } from "next/server";
import { acessoExportacao } from "@/lib/exportar";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { hoje } from "@/lib/datas";
import { uuidOuNada } from "@/lib/validacao";
import { carregarPeopleAnalytics } from "@/lib/analytics/indicadores";
import { resolverPeriodo } from "@/lib/analytics/calculo";
import { comparativo, gerarInsights } from "@/lib/analytics/insights";
import { nomeMotivo } from "@/lib/offboarding/motivos";

/** Indicadores agregados do filtro atual (nenhum dado individual). Permissão própria e auditada. */
export async function GET(request: NextRequest) {
  const { acesso, negado } = await acessoExportacao("analytics");
  if (negado) return negado;
  const { ctx, db } = acesso;
  const sp = Object.fromEntries(request.nextUrl.searchParams) as Record<string, string>;
  const periodo = resolverPeriodo(sp, hoje());
  const areaId = uuidOuNada(sp.area) ?? null;
  const d = await carregarPeopleAnalytics(ctx, periodo, areaId);
  const t = d.turnover;
  const linhas: unknown[][] = [
    ["Seção", "Indicador", "Valor"],
    ["Filtro", "Período", periodo.rotulo],
    ["Filtro", "Área", areaId ? (d.areas.find((a) => a.id === areaId)?.nome ?? "") : "Organização inteira"],
    ["Pessoas", "Headcount", d.pessoas.headcount],
    ["Pessoas", "Admissões", d.pessoas.admissoes],
    ["Pessoas", "Retenção 12 meses (%)", d.pessoas.retencao12m],
    ["Pessoas", "Tempo médio de casa (meses)", d.pessoas.tempoMedioCasaMeses],
    ["Turnover", "Saídas", t.saidas],
    ["Turnover", "Voluntárias", t.voluntarias],
    ["Turnover", "Involuntárias", t.involuntarias],
    ["Turnover", "Perdas lamentadas", t.lamentadas],
    ["Turnover", "Saídas com menos de 90 dias", t.precoces],
    ["Turnover", "Turnover no período (%)", t.turnover],
    ["Turnover", "Turnover anualizado (%)", t.turnoverAnualizado],
    ["Turnover", "Turnover voluntário anualizado (%)", t.turnoverVoluntarioAnualizado],
    ["Turnover", "Rotatividade geral (%)", t.rotatividadeGeral],
    ...d.serie.map((p) => ["Série mensal", p.rotulo, `headcount ${p.headcount}; admissões ${p.admissoes}; saídas ${p.saidas}; turnover ${p.turnover ?? ""}%`]),
    ...d.porArea.map((a) => ["Turnover por área", a.nome, `${a.turnoverAnualizado ?? ""}% (${a.saidas} saídas; ${a.headcount} pessoas)`]),
    ...(d.saida?.motivosReais ?? []).map((m) => ["Motivos reais", nomeMotivo(m.chave), m.n]),
    ...(d.projecao ? [["Projeção 90 dias", "Saídas esperadas", `${d.projecao.esperado} (${d.projecao.minimo}–${d.projecao.maximo})`]] : []),
    ...comparativo(d).map((c) => ["Comparativo", c.nome, `${c.valor ?? ""} (referência ${c.referencia}${c.unidade ? ` ${c.unidade}` : ""})`]),
    ...gerarInsights(d).map((i) => ["Insight", i.titulo, i.recomendacao]),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "analytics.exportar", entidade: "people_analytics", detalhes: { periodo: periodo.rotulo, area: areaId } });
  return respostaCsv(linhas, "people-analytics");
}
