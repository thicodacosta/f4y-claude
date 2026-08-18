import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";

/**
 * Metrics Engine (Fase 1 do Find4You Intelligence) — fonte única para
 * qualquer métrica consolidada entre verticais. Regra de ouro: só computa
 * o que dá pra sustentar com dado real hoje (Faturamento/Oportunidade/Vaga/
 * ContratoAlocacao) — nada de série histórica de verdade ainda, porque não
 * existe snapshot nem job agendado no sistema (ver auditoria). Funções que
 * dependeriam disso (MRR/ARR real, cohort, CAC/LTV) ficam para Fase 3+.
 */

function inicioDoMes(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function inicioDoAno(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

/** Receita — soma de Faturamento.valor. "Mês"/"YTD" usam Faturamento.criadoEm
 * (o momento do fechamento, mesma âncora que modules/financeiro/queries.ts
 * já usa) — não é caixa recebido, é negócio fechado/contratado. "Recebida"
 * filtra status=pago por dataEfetiva à parte, essa sim é caixa de verdade. */
export async function getReceitaConsolidada() {
  await requirePapel(PAPEIS_GESTAO);
  const desdeMes = inicioDoMes();
  const desdeAno = inicioDoAno();

  const [mesAtual, ytd, recebidaMes, geral] = await Promise.all([
    prisma.faturamento.aggregate({ where: { criadoEm: { gte: desdeMes } }, _sum: { valor: true }, _count: true }),
    prisma.faturamento.aggregate({ where: { criadoEm: { gte: desdeAno } }, _sum: { valor: true } }),
    prisma.faturamento.aggregate({
      where: { status: "pago", dataEfetiva: { gte: desdeMes } },
      _sum: { valor: true },
    }),
    prisma.faturamento.aggregate({ _sum: { valor: true }, _count: true }),
  ]);

  return {
    receitaMes: Number(mesAtual._sum.valor ?? 0),
    negociosFechadosMes: mesAtual._count,
    receitaYtd: Number(ytd._sum.valor ?? 0),
    receitaRecebidaMes: Number(recebidaMes._sum.valor ?? 0),
    receitaContratadaTotal: Number(geral._sum.valor ?? 0),
    negociosFechadosTotal: geral._count,
  };
}

/** Série mensal consolidada (CRM + ATS, via Faturamento — que já cobre as
 * duas origens) — usa RevenueLineChart existente. Diferente de
 * modules/dashboard/queries.ts#getReceitaMensal (que só olha Oportunidade
 * Ganha, sem Vaga) — essa versão é a "verdade" cross-vertical. */
export async function getReceitaMensalConsolidada(meses = 6) {
  await requirePapel(PAPEIS_GESTAO);

  const desde = new Date();
  desde.setMonth(desde.getMonth() - (meses - 1));
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const faturamentos = await prisma.faturamento.findMany({
    where: { criadoEm: { gte: desde } },
    select: { valor: true, criadoEm: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const f of faturamentos) {
    const key = `${f.criadoEm.getFullYear()}-${String(f.criadoEm.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(f.valor));
  }

  return [...buckets.entries()].map(([mes, valor]) => ({ mes, valor }));
}

/** Crescimento mês a mês — função pura sobre a série já buscada, não bate no
 * banco de novo (evita recalcular a mesma métrica de formas diferentes). */
export function calcularCrescimentoMoM(serieMensal: { mes: string; valor: number }[]) {
  if (serieMensal.length < 2) return null;
  const atual = serieMensal[serieMensal.length - 1].valor;
  const anterior = serieMensal[serieMensal.length - 2].valor;
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

/** Pipeline consolidado (Comercial + Vagas), bruto e ponderado. A ponderação
 * usa Oportunidade.probabilidade quando setada manualmente, senão o
 * PipelineEtapa.probabilidadePadrao da etapa atual — mesmo dado que já
 * alimenta modules/dashboard/queries.ts#getForecast, só que também somando
 * o lado de Vagas (que hoje não tem pipeline ponderado em lugar nenhum). */
export async function getPipelineConsolidado() {
  await requirePapel(PAPEIS_GESTAO);

  const [oportunidadesAbertas, vagasAbertas] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { etapa: { isGanho: false, isPerdido: false } },
      select: { valorEstimado: true, probabilidade: true, etapa: { select: { probabilidadePadrao: true } } },
    }),
    prisma.vaga.findMany({
      where: { status: { notIn: ["fechada", "perdida"] } },
      select: { valor: true, etapa: { select: { probabilidadePadrao: true } } },
    }),
  ]);

  let pipelineComercial = 0;
  let pipelineComercialPonderado = 0;
  for (const o of oportunidadesAbertas) {
    const valor = Number(o.valorEstimado);
    const prob = o.probabilidade != null ? Number(o.probabilidade) : Number(o.etapa.probabilidadePadrao ?? 0);
    pipelineComercial += valor;
    pipelineComercialPonderado += valor * (prob / 100);
  }

  let pipelineVagas = 0;
  let pipelineVagasPonderado = 0;
  for (const v of vagasAbertas) {
    const valor = v.valor ? Number(v.valor) : 0;
    const prob = Number(v.etapa.probabilidadePadrao ?? 0);
    pipelineVagas += valor;
    pipelineVagasPonderado += valor * (prob / 100);
  }

  return {
    pipelineTotal: pipelineComercial + pipelineVagas,
    pipelinePonderado: pipelineComercialPonderado + pipelineVagasPonderado,
    pipelineComercial,
    pipelineComercialPonderado,
    pipelineVagas,
    pipelineVagasPonderado,
  };
}

/** Capacidade de Alocação — real, direto de Vaga.quantidadePosicoes vs.
 * posicoesPreenchidas nas vagas de Categoria Alocação (vertical=alocacao_tech)
 * não perdidas. Não inventa um "limite máximo" que não existe no sistema —
 * a demanda contratada (quantidadePosicoes) é o teto real hoje. */
export async function getCapacidadeAlocacao() {
  await requirePapel(PAPEIS_GESTAO);

  const agregada = await prisma.vaga.aggregate({
    where: { vertical: "alocacao_tech", status: { not: "perdida" } },
    _sum: { quantidadePosicoes: true, posicoesPreenchidas: true },
  });

  const posicoesTotal = agregada._sum.quantidadePosicoes ?? 0;
  const posicoesPreenchidas = agregada._sum.posicoesPreenchidas ?? 0;

  return {
    posicoesTotal,
    posicoesPreenchidas,
    posicoesDisponiveis: Math.max(0, posicoesTotal - posicoesPreenchidas),
    utilizacao: posicoesTotal > 0 ? (posicoesPreenchidas / posicoesTotal) * 100 : null,
  };
}

/** Concentração de receita — top N clientes por Faturamento.valor. Base
 * direta da regra 21 do pedido (dependência excessiva de cliente). */
export async function getConcentracaoReceita(topN = 5) {
  await requirePapel(PAPEIS_GESTAO);

  const porEmpresa = await prisma.faturamento.groupBy({
    by: ["empresaId"],
    _sum: { valor: true },
    orderBy: { _sum: { valor: "desc" } },
  });
  if (porEmpresa.length === 0) return null;

  const total = porEmpresa.reduce((acc, e) => acc + Number(e._sum.valor ?? 0), 0);
  const top = porEmpresa.slice(0, topN);
  const empresas = await prisma.empresa.findMany({
    where: { id: { in: top.map((e) => e.empresaId) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(empresas.map((e) => [e.id, e.nome]));
  const somaTop = top.reduce((acc, e) => acc + Number(e._sum.valor ?? 0), 0);

  return {
    total,
    topN,
    somaTop,
    percentual: total > 0 ? (somaTop / total) * 100 : 0,
    clientes: top.map((e) => ({ nome: nomePorId.get(e.empresaId) ?? "—", valor: Number(e._sum.valor ?? 0) })),
  };
}

/** Receita por vertical de negócio (Alocação / Recrutamento & Seleção /
 * Executive Search) — as 3 verticais reais da Find4You, derivadas de
 * Vaga/Oportunidade.vertical + .executiveSearch (mesma regra de categoria
 * usada em nova-vaga-dialog.tsx e no relatório de pipeline de vagas). Junta
 * Faturamento (polimórfico) de volta em Vaga/Oportunidade pra classificar. */
export async function getReceitaPorVerticalNegocio(periodo?: { desde: Date; ate: Date }) {
  const classificados = await classificarFaturamentosPorCategoria(periodo);
  if (!classificados) return null;

  const totais: Record<CategoriaVertical, number> = { alocacao: 0, recrutamento: 0, executive_search: 0 };
  for (const f of classificados) totais[f.categoria] += f.valor;
  return totais;
}

export type CategoriaVertical = "alocacao" | "recrutamento" | "executive_search";

/** Regra de categoria de negócio — mesma usada em nova-vaga-dialog.tsx e no
 * relatório de pipeline de vagas. Exportada porque o Forecast Engine
 * (modules/intelligence/forecast.ts) precisa classificar pipeline em aberto
 * (Oportunidade/Vaga) pela mesma regra, não só Faturamento já fechado. */
export function categoriaDeVerticalNegocio(vertical: string, executiveSearch: boolean): CategoriaVertical {
  if (executiveSearch) return "executive_search";
  return vertical === "alocacao_tech" ? "alocacao" : "recrutamento";
}

/** Junta Faturamento (polimórfico) de volta em Vaga/Oportunidade pra
 * classificar por categoria — compartilhado por getReceitaPorVerticalNegocio,
 * getTicketMedioPorVertical e getReceitaMensalPorCategoria, pra não
 * reimplementar a mesma junção várias vezes (regra 34 do pedido: uma
 * métrica, um lugar só que sabe calculá-la). */
async function classificarFaturamentosPorCategoria(periodo?: { desde: Date; ate: Date }) {
  await requirePapel(PAPEIS_GESTAO);

  const faturamentos = await prisma.faturamento.findMany({
    where: periodo ? { criadoEm: { gte: periodo.desde, lt: periodo.ate } } : undefined,
    select: { valor: true, origemTipo: true, origemId: true, criadoEm: true },
  });
  if (faturamentos.length === 0) return null;

  const idsVaga = faturamentos.filter((f) => f.origemTipo === "vaga").map((f) => f.origemId);
  const idsOportunidade = faturamentos.filter((f) => f.origemTipo === "oportunidade").map((f) => f.origemId);

  const [vagas, oportunidades] = await Promise.all([
    idsVaga.length
      ? prisma.vaga.findMany({ where: { id: { in: idsVaga } }, select: { id: true, vertical: true, executiveSearch: true } })
      : [],
    idsOportunidade.length
      ? prisma.oportunidade.findMany({
          where: { id: { in: idsOportunidade } },
          select: { id: true, vertical: true, executiveSearch: true },
        })
      : [],
  ]);

  const categoriaPorId = new Map<string, CategoriaVertical>();
  for (const v of vagas) categoriaPorId.set(v.id, categoriaDeVerticalNegocio(v.vertical, v.executiveSearch));
  for (const o of oportunidades) categoriaPorId.set(o.id, categoriaDeVerticalNegocio(o.vertical, o.executiveSearch));

  return faturamentos
    .map((f) => ({ valor: Number(f.valor), categoria: categoriaPorId.get(f.origemId), criadoEm: f.criadoEm }))
    .filter((f): f is { valor: number; categoria: CategoriaVertical; criadoEm: Date } => !!f.categoria);
}

/** Série mensal por categoria — mesma base de getReceitaMensalConsolidada,
 * só que sem somar as 3 verticais juntas. Alimenta a tendência histórica do
 * Forecast Engine por categoria (getGapToGoal), que antes usava a série
 * consolidada da empresa inteira mesmo pedindo o forecast de uma vertical
 * só (bug: meta de Alocação e de Recrutamento comparadas com o mesmo
 * número). */
export async function getReceitaMensalPorCategoria(meses: number) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - (meses - 1));
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);
  const ate = new Date();
  ate.setMonth(ate.getMonth() + 1);
  ate.setDate(1);
  ate.setHours(0, 0, 0, 0);

  const classificados = await classificarFaturamentosPorCategoria({ desde, ate });

  const buckets = new Map<string, Record<CategoriaVertical, number>>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, {
      alocacao: 0,
      recrutamento: 0,
      executive_search: 0,
    });
  }
  for (const f of classificados ?? []) {
    const key = `${f.criadoEm.getFullYear()}-${String(f.criadoEm.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket[f.categoria] += f.valor;
  }

  return [...buckets.entries()].map(([mes, valores]) => ({ mes, ...valores }));
}

/** Ticket médio por vertical = receita da categoria / número de fechamentos
 * — base real pro Reverse Planning ("quero faturar X, quantos contratos/
 * vagas/mandatos preciso"). Categoria sem nenhum fechamento retorna
 * ticketMedio null (não divide por zero, não inventa um número). */
export async function getTicketMedioPorVertical() {
  const classificados = await classificarFaturamentosPorCategoria();
  if (!classificados) return null;

  const acumulado: Record<CategoriaVertical, { receita: number; contagem: number }> = {
    alocacao: { receita: 0, contagem: 0 },
    recrutamento: { receita: 0, contagem: 0 },
    executive_search: { receita: 0, contagem: 0 },
  };
  for (const f of classificados) {
    acumulado[f.categoria].receita += f.valor;
    acumulado[f.categoria].contagem += 1;
  }

  const resultado = {} as Record<CategoriaVertical, { receita: number; contagem: number; ticketMedio: number | null }>;
  for (const categoria of Object.keys(acumulado) as CategoriaVertical[]) {
    const { receita, contagem } = acumulado[categoria];
    resultado[categoria] = { receita, contagem, ticketMedio: contagem > 0 ? receita / contagem : null };
  }
  return resultado;
}

/** Base real pro Business Simulator (What-If) — clientes ativos, ticket
 * médio geral e capacidade de recrutamento por cabeça. Tudo real; qualquer
 * campo sem dado suficiente vem null, nunca um número inventado. */
export async function getBaselineSimulador() {
  await requirePapel(PAPEIS_GESTAO);

  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const [clientesAtivos, faturamentoGeral, recrutadoresAtivos, vagasFechadas3Meses] = await Promise.all([
    prisma.empresa.count({ where: { status: "ativo" } }),
    prisma.faturamento.aggregate({ _sum: { valor: true }, _count: true }),
    prisma.usuario.count({ where: { papel: "recrutador", ativo: true } }),
    prisma.vaga.count({ where: { status: "fechada", fechadoEm: { gte: tresMesesAtras } } }),
  ]);

  const ticketMedioGeral = faturamentoGeral._count > 0 ? Number(faturamentoGeral._sum.valor ?? 0) / faturamentoGeral._count : null;
  const vagasFechadasPorRecrutadorMes = recrutadoresAtivos > 0 ? vagasFechadas3Meses / recrutadoresAtivos / 3 : null;

  return {
    clientesAtivos,
    ticketMedioGeral,
    recrutadoresAtivos,
    vagasFechadasPorRecrutadorMes,
  };
}

/** Margem estimada = receita contratada − comissões geradas. Não é margem
 * contábil de verdade (o sistema não modela nenhum outro custo — sem
 * folha, sem despesa fixa), por isso o nome é explícito "estimada" em toda
 * a UI que consome isso. É o único dado de custo que o sistema tem. */
export async function getMargemEstimada() {
  await requirePapel(PAPEIS_GESTAO);

  const [receita, comissoes] = await Promise.all([
    prisma.faturamento.aggregate({ _sum: { valor: true } }),
    prisma.comissao.aggregate({ _sum: { valor: true } }),
  ]);

  const receitaTotal = Number(receita._sum.valor ?? 0);
  const comissoesTotal = Number(comissoes._sum.valor ?? 0);

  return {
    receitaTotal,
    comissoesTotal,
    margemEstimada: receitaTotal - comissoesTotal,
    margemPercentual: receitaTotal > 0 ? ((receitaTotal - comissoesTotal) / receitaTotal) * 100 : null,
  };
}
