import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import { getReceitaMensalConsolidada, getReceitaConsolidada } from "@/modules/intelligence/metrics";
import type { categoriaMetaValues } from "@/modules/metas/schemas";

/**
 * Forecast Engine (Fase 2/Intelligence) — regra 36 do pedido: sem dado
 * suficiente pra modelo estatístico de verdade, então usa só o que é
 * honesto de calcular hoje: pipeline ponderado por probabilidade da etapa
 * (dado real) + tendência da média histórica recente (dado real). Cada
 * banda tem fórmula explícita, auditável em `componentes` — nada de
 * "confiança 87%" saído do nada.
 */
export async function getForecast(dias: number) {
  await requirePapel(PAPEIS_GESTAO);

  const hoje = new Date();
  const fimJanela = new Date(hoje.getTime() + dias * 86_400_000);

  const [oportunidadesComPrevisao, vagasComLimite] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { etapa: { isGanho: false, isPerdido: false }, previsaoFechamento: { gte: hoje, lte: fimJanela } },
      select: { valorEstimado: true, probabilidade: true, etapa: { select: { probabilidadePadrao: true } } },
    }),
    prisma.vaga.findMany({
      where: { status: { notIn: ["fechada", "perdida"] }, dataLimite: { gte: hoje, lte: fimJanela } },
      select: { valor: true, etapa: { select: { probabilidadePadrao: true } } },
    }),
  ]);

  let pipelineNaJanela = 0;
  let pipelineNaJanelaPonderado = 0;
  for (const o of oportunidadesComPrevisao) {
    const valor = Number(o.valorEstimado);
    const prob = o.probabilidade != null ? Number(o.probabilidade) : Number(o.etapa.probabilidadePadrao ?? 0);
    pipelineNaJanela += valor;
    pipelineNaJanelaPonderado += valor * (prob / 100);
  }
  for (const v of vagasComLimite) {
    const valor = v.valor ? Number(v.valor) : 0;
    const prob = Number(v.etapa.probabilidadePadrao ?? 0);
    pipelineNaJanela += valor;
    pipelineNaJanelaPonderado += valor * (prob / 100);
  }

  // Tendência = média dos últimos 3 meses de receita real, prorrateada pros
  // dias da janela — capta receita que ainda não tem data prevista de
  // fechamento (a maioria dos negócios reais hoje), sem fingir que sabe qual.
  const historico = await getReceitaMensalConsolidada(3);
  const mediaHistoricaMensal =
    historico.length > 0 ? historico.reduce((acc, d) => acc + d.valor, 0) / historico.length : 0;
  const tendenciaNaJanela = mediaHistoricaMensal * (dias / 30);

  const temHistorico = historico.some((d) => d.valor > 0);
  const temPipelineComData = oportunidadesComPrevisao.length > 0 || vagasComLimite.length > 0;

  return {
    dias,
    conservador: pipelineNaJanelaPonderado,
    provavel: pipelineNaJanelaPonderado + tendenciaNaJanela,
    agressivo: pipelineNaJanela + tendenciaNaJanela,
    componentes: {
      pipelineNaJanela,
      pipelineNaJanelaPonderado,
      mediaHistoricaMensal,
      tendenciaNaJanela,
      oportunidadesComPrevisao: oportunidadesComPrevisao.length,
      vagasComLimite: vagasComLimite.length,
    },
    dadosInsuficientes: !temHistorico && !temPipelineComData,
  };
}

export const JANELAS_FORECAST = [7, 30, 60, 90, 180, 365] as const;

/** Mesma fórmula de getForecast, mas pras 6 janelas padrão de uma vez só —
 * busca o pipeline uma única vez (janela máxima) e reaproveita em cada
 * janela menor, em vez de repetir a query 6x (seção 43 do pedido: queries
 * otimizadas). Alimenta o seletor de janela em /intelligence/forecast. */
export async function getForecastMultiplasJanelas(diasList: readonly number[] = JANELAS_FORECAST) {
  await requirePapel(PAPEIS_GESTAO);

  const hoje = new Date();
  const maiorJanela = Math.max(...diasList);
  const fimMaiorJanela = new Date(hoje.getTime() + maiorJanela * 86_400_000);

  const [oportunidades, vagas, historico] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { etapa: { isGanho: false, isPerdido: false }, previsaoFechamento: { gte: hoje, lte: fimMaiorJanela } },
      select: {
        valorEstimado: true,
        probabilidade: true,
        previsaoFechamento: true,
        etapa: { select: { probabilidadePadrao: true } },
      },
    }),
    prisma.vaga.findMany({
      where: { status: { notIn: ["fechada", "perdida"] }, dataLimite: { gte: hoje, lte: fimMaiorJanela } },
      select: { valor: true, dataLimite: true, etapa: { select: { probabilidadePadrao: true } } },
    }),
    getReceitaMensalConsolidada(3),
  ]);

  const mediaHistoricaMensal =
    historico.length > 0 ? historico.reduce((acc, d) => acc + d.valor, 0) / historico.length : 0;
  const temHistorico = historico.some((d) => d.valor > 0);

  return diasList.map((dias) => {
    const fimJanela = new Date(hoje.getTime() + dias * 86_400_000);
    let pipelineNaJanela = 0;
    let pipelineNaJanelaPonderado = 0;
    let qtdOportunidades = 0;
    let qtdVagas = 0;

    for (const o of oportunidades) {
      if (!o.previsaoFechamento || o.previsaoFechamento > fimJanela) continue;
      const valor = Number(o.valorEstimado);
      const prob = o.probabilidade != null ? Number(o.probabilidade) : Number(o.etapa.probabilidadePadrao ?? 0);
      pipelineNaJanela += valor;
      pipelineNaJanelaPonderado += valor * (prob / 100);
      qtdOportunidades += 1;
    }
    for (const v of vagas) {
      if (!v.dataLimite || v.dataLimite > fimJanela) continue;
      const valor = v.valor ? Number(v.valor) : 0;
      const prob = Number(v.etapa.probabilidadePadrao ?? 0);
      pipelineNaJanela += valor;
      pipelineNaJanelaPonderado += valor * (prob / 100);
      qtdVagas += 1;
    }

    const tendenciaNaJanela = mediaHistoricaMensal * (dias / 30);

    return {
      dias,
      conservador: pipelineNaJanelaPonderado,
      provavel: pipelineNaJanelaPonderado + tendenciaNaJanela,
      agressivo: pipelineNaJanela + tendenciaNaJanela,
      componentes: {
        pipelineNaJanela,
        pipelineNaJanelaPonderado,
        mediaHistoricaMensal,
        tendenciaNaJanela,
        oportunidadesComPrevisao: qtdOportunidades,
        vagasComLimite: qtdVagas,
      },
      dadosInsuficientes: !temHistorico && qtdOportunidades === 0 && qtdVagas === 0,
    };
  });
}

/** Gap-to-Goal — só existe quando há MetaOrganizacional configurada
 * (Goal Center, /configuracoes/metas) pra essa categoria no mês atual.
 * "Probabilidade de atingir" é uma razão simples forecast/meta, não um
 * modelo estatístico — rotulada como tal na UI. */
export async function getGapToGoal(categoria: (typeof categoriaMetaValues)[number] = "todas") {
  await requirePapel(PAPEIS_GESTAO);

  const hoje = new Date();
  const meta = await prisma.metaOrganizacional.findUnique({
    where: { categoria_ano_mes: { categoria, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 } },
  });
  if (!meta) return null;

  const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const diasRestantes = Math.max(0, Math.ceil((fimDoMes.getTime() - hoje.getTime()) / 86_400_000));

  const [receita, forecastRestante] = await Promise.all([getReceitaConsolidada(), getForecast(diasRestantes)]);

  const valorAlvo = Number(meta.valorAlvo);
  const realizado = receita.receitaMes;
  const gap = Math.max(0, valorAlvo - realizado);
  const forecastTotal = realizado + forecastRestante.provavel;
  const gapProjetado = Math.max(0, valorAlvo - forecastTotal);
  const probabilidadeAtingir = valorAlvo > 0 ? Math.min(100, Math.round((forecastTotal / valorAlvo) * 100)) : null;

  return { categoria, valorAlvo, realizado, gap, forecastTotal, gapProjetado, probabilidadeAtingir, diasRestantes };
}
