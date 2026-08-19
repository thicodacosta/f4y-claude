import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import {
  getReceitaMensalConsolidada,
  getReceitaConsolidada,
  getReceitaPorVerticalNegocio,
  categoriaDeVerticalNegocio,
} from "@/modules/intelligence/metrics";
import type { categoriaMetaValues } from "@/modules/metas/schemas";

type CategoriaMeta = (typeof categoriaMetaValues)[number];

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

/** Gap-to-Goal — só existe quando há meta pra essa categoria no mês atual
 * (Goal Center, /configuracoes/metas) — "todas" é exceção: se não houver
 * uma MetaOrganizacional("todas") explícita, deriva somando as metas de
 * categoria já cadastradas no mês, pra não exigir cadastro duplicado do
 * total. "Probabilidade de atingir" é uma razão simples forecast/meta, não
 * um modelo estatístico — rotulada como tal na UI. */
export async function getGapToGoal(categoria: (typeof categoriaMetaValues)[number] = "todas") {
  await requirePapel(PAPEIS_GESTAO);

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const valorAlvo = await getValorAlvoDaCategoria(categoria, ano, mes);
  if (valorAlvo == null) return null;

  const fimDoMes = new Date(ano, mes, 1);
  const diasRestantes = Math.max(0, Math.ceil((fimDoMes.getTime() - hoje.getTime()) / 86_400_000));
  const inicioDoMes = new Date(ano, mes - 1, 1);

  const [realizado, pipelineVagas] = await Promise.all([
    getRealizadoMesDaCategoria(categoria, inicioDoMes, fimDoMes),
    getPipelineVagasEntrevistaForecast(categoria),
  ]);

  const gap = Math.max(0, valorAlvo - realizado);
  const forecastTotal = realizado + pipelineVagas.ponderado;
  const gapProjetado = Math.max(0, valorAlvo - forecastTotal);
  const probabilidadeAtingir = valorAlvo > 0 ? Math.min(100, Math.round((forecastTotal / valorAlvo) * 100)) : null;

  return { categoria, valorAlvo, realizado, gap, forecastTotal, gapProjetado, probabilidadeAtingir, diasRestantes };
}

async function getValorAlvoDaCategoria(categoria: CategoriaMeta, ano: number, mes: number) {
  const meta = await prisma.metaOrganizacional.findUnique({ where: { categoria_ano_mes: { categoria, ano, mes } } });
  if (meta) return Number(meta.valorAlvo);
  if (categoria !== "todas") return null;

  const outras = await prisma.metaOrganizacional.findMany({ where: { ano, mes, categoria: { not: "todas" } } });
  if (outras.length === 0) return null;
  return outras.reduce((acc, m) => acc + Number(m.valorAlvo), 0);
}

/** Forecast do Gap-to-Goal — soma o valor das Vagas em aberto nos estágios
 * "Entrevista Cliente" e "Forecast" do Pipeline de Vagas, ponderado pela
 * probabilidade padrão de cada etapa (65%/85%, ver seed). Reflete
 * diretamente o Kanban do ATS em vez de uma janela de dias com data de
 * fechamento prevista (que a maioria das vagas não preenche). */
async function getPipelineVagasEntrevistaForecast(categoria: CategoriaMeta) {
  const vagas = await prisma.vaga.findMany({
    where: {
      status: { notIn: ["fechada", "perdida"] },
      etapa: { nome: { in: ["Entrevista Cliente", "Forecast"] } },
    },
    select: { valor: true, vertical: true, executiveSearch: true, etapa: { select: { probabilidadePadrao: true } } },
  });

  const pertenceACategoria = (vertical: string, executiveSearch: boolean) =>
    categoria === "todas" || categoriaDeVerticalNegocio(vertical, executiveSearch) === categoria;

  let bruto = 0;
  let ponderado = 0;
  for (const v of vagas) {
    if (!pertenceACategoria(v.vertical, v.executiveSearch)) continue;
    const valor = v.valor ? Number(v.valor) : 0;
    const prob = Number(v.etapa.probabilidadePadrao ?? 0);
    bruto += valor;
    ponderado += valor * (prob / 100);
  }
  return { bruto, ponderado };
}

/** Realizado do mês por categoria — "todas" usa getReceitaConsolidada
 * (soma bruta de Faturamento, mesma métrica de sempre), categorias
 * específicas usam getReceitaPorVerticalNegocio (só conta Faturamento
 * classificável em Vaga/Oportunidade). Antes o Gap-to-Goal usava
 * receita.receitaMes (empresa inteira) pra QUALQUER categoria — bug que
 * comparava a meta de Alocação e a de Recrutamento com o mesmo número. */
async function getRealizadoMesDaCategoria(categoria: CategoriaMeta, desde: Date, ate: Date) {
  if (categoria === "todas") {
    const receita = await getReceitaConsolidada();
    return receita.receitaMes;
  }
  const porVertical = await getReceitaPorVerticalNegocio({ desde, ate });
  return porVertical?.[categoria] ?? 0;
}
