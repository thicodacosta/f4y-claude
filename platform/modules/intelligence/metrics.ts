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

/** Receita — soma de Vaga.valor nas etapas de Ganho (Fechada R&S + Fechada
 * Alocação, ambas isGanho=true), por Vaga.fechadoEm — a mesma fonte que já
 * alimenta o Pipeline de Vagas ("Fechadas em X/2026"), pra Receita nunca
 * divergir do que está fechado lá (regra do pedido: YTD deve ser a soma de
 * R&S e Alocação). Faturamento continua sendo o ledger fiscal (NFs,
 * emitida/não emitida, pago/pendente) — pode ter lançamento sem vaga
 * (histórico solto) ou vaga sem lançamento ainda, então não é mais a fonte
 * de "quanto fechamos". "Recebida" é exceção: cash de verdade (status=pago
 * + dataEfetiva) não tem equivalente em Vaga, continua vindo de Faturamento. */
export async function getReceitaConsolidada() {
  await requirePapel(PAPEIS_GESTAO);
  const desdeMes = inicioDoMes();
  const desdeAno = inicioDoAno();

  const [vagasFechadas, recebidaMes] = await Promise.all([
    prisma.vaga.findMany({
      where: { etapa: { isGanho: true }, fechadoEm: { not: null } },
      select: { valor: true, fechadoEm: true },
    }),
    prisma.faturamento.aggregate({
      where: { status: "pago", dataEfetiva: { gte: desdeMes } },
      _sum: { valor: true },
    }),
  ]);

  let receitaMes = 0;
  let negociosFechadosMes = 0;
  let receitaYtd = 0;
  let receitaContratadaTotal = 0;

  for (const v of vagasFechadas) {
    const valor = v.valor ? Number(v.valor) : 0;
    receitaContratadaTotal += valor;
    if (v.fechadoEm! >= desdeAno) receitaYtd += valor;
    if (v.fechadoEm! >= desdeMes) {
      receitaMes += valor;
      negociosFechadosMes += 1;
    }
  }

  return {
    receitaMes,
    negociosFechadosMes,
    receitaYtd,
    receitaRecebidaMes: Number(recebidaMes._sum.valor ?? 0),
    receitaContratadaTotal,
    negociosFechadosTotal: vagasFechadas.length,
  };
}

/** Série mensal consolidada — mesma fonte de getReceitaConsolidada (Vaga nas
 * etapas de Ganho, por fechadoEm), pra "Receita — últimos 6 meses" nunca
 * divergir do card de Receita do mês/YTD logo acima. Diferente de
 * modules/dashboard/queries.ts#getReceitaMensal (que só olha Oportunidade
 * Ganha, sem Vaga). */
export async function getReceitaMensalConsolidada(meses = 6) {
  await requirePapel(PAPEIS_GESTAO);

  const desde = new Date();
  desde.setMonth(desde.getMonth() - (meses - 1));
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const vagasFechadas = await prisma.vaga.findMany({
    where: { etapa: { isGanho: true }, fechadoEm: { gte: desde } },
    select: { valor: true, fechadoEm: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const v of vagasFechadas) {
    if (!v.fechadoEm) continue;
    const key = `${v.fechadoEm.getFullYear()}-${String(v.fechadoEm.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (v.valor ? Number(v.valor) : 0));
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

/** Concentração de vagas fechadas — mesma lógica de getConcentracaoReceita,
 * mas contando Vaga.status="fechada" por cliente em vez de R$ faturado.
 * Substituiu o card "Alertas inteligentes" em /intelligence (getAlertasInteligentes
 * segue alimentando os insights, só não tem mais card dedicado). */
export async function getConcentracaoVagasFechadas(topN = 5) {
  await requirePapel(PAPEIS_GESTAO);

  const porEmpresa = await prisma.vaga.groupBy({
    by: ["empresaId"],
    where: { status: "fechada" },
    _count: true,
    orderBy: { _count: { empresaId: "desc" } },
  });
  if (porEmpresa.length === 0) return null;

  const total = porEmpresa.reduce((acc, e) => acc + e._count, 0);
  const top = porEmpresa.slice(0, topN);
  const empresas = await prisma.empresa.findMany({
    where: { id: { in: top.map((e) => e.empresaId) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(empresas.map((e) => [e.id, e.nome]));
  const somaTop = top.reduce((acc, e) => acc + e._count, 0);

  return {
    total,
    topN,
    somaTop,
    percentual: total > 0 ? (somaTop / total) * 100 : 0,
    clientes: top.map((e) => ({ nome: nomePorId.get(e.empresaId) ?? "—", quantidade: e._count })),
  };
}

/** Receita por vertical de negócio (Alocação / Recrutamento & Seleção /
 * Executive Search) — as 3 verticais reais da Find4You, derivadas de
 * Vaga.vertical + .executiveSearch (mesma regra de categoria usada em
 * nova-vaga-dialog.tsx e no relatório de pipeline de vagas). Mesma fonte de
 * getReceitaConsolidada (Vaga nas etapas de Ganho) — sem isso, a soma das 3
 * verticais aqui divergia do card de Receita do mês/YTD logo acima. */
export async function getReceitaPorVerticalNegocio(periodo?: { desde: Date; ate: Date }) {
  const classificados = await classificarVagasFechadasPorCategoria(periodo);
  if (!classificados) return null;

  const totais: Record<CategoriaVertical, number> = { alocacao: 0, recrutamento: 0, executive_search: 0 };
  for (const v of classificados) totais[v.categoria] += v.valor;
  return totais;
}

export type CategoriaVertical = "alocacao" | "recrutamento" | "executive_search";

/** Regra de categoria de negócio — mesma usada em nova-vaga-dialog.tsx e no
 * relatório de pipeline de vagas. Exportada porque o Forecast Engine
 * (modules/intelligence/forecast.ts) precisa classificar pipeline em aberto
 * (Oportunidade/Vaga) pela mesma regra, não só vagas já fechadas. */
export function categoriaDeVerticalNegocio(vertical: string, executiveSearch: boolean): CategoriaVertical {
  if (executiveSearch) return "executive_search";
  return vertical === "alocacao_tech" ? "alocacao" : "recrutamento";
}

/** Vagas fechadas (etapa isGanho — Fechada R&S + Fechada Alocação) por
 * categoria de negócio — compartilhado por getReceitaPorVerticalNegocio e
 * getTicketMedioPorVertical, pra não reimplementar a mesma classificação
 * várias vezes (regra 34 do pedido: uma métrica, um lugar só que sabe
 * calculá-la). */
async function classificarVagasFechadasPorCategoria(periodo?: { desde: Date; ate: Date }) {
  await requirePapel(PAPEIS_GESTAO);

  const vagas = await prisma.vaga.findMany({
    where: {
      etapa: { isGanho: true },
      fechadoEm: periodo ? { gte: periodo.desde, lt: periodo.ate } : { not: null },
    },
    select: { valor: true, vertical: true, executiveSearch: true },
  });
  if (vagas.length === 0) return null;

  return vagas.map((v) => ({
    valor: v.valor ? Number(v.valor) : 0,
    categoria: categoriaDeVerticalNegocio(v.vertical, v.executiveSearch),
  }));
}

/** Ticket médio por vertical = receita da categoria / número de fechamentos
 * — base real pro Reverse Planning ("quero faturar X, quantos contratos/
 * vagas/mandatos preciso"). Categoria sem nenhum fechamento retorna
 * ticketMedio null (não divide por zero, não inventa um número). */
export async function getTicketMedioPorVertical() {
  const classificados = await classificarVagasFechadasPorCategoria();
  if (!classificados) return null;

  const acumulado: Record<CategoriaVertical, { receita: number; contagem: number }> = {
    alocacao: { receita: 0, contagem: 0 },
    recrutamento: { receita: 0, contagem: 0 },
    executive_search: { receita: 0, contagem: 0 },
  };
  for (const v of classificados) {
    acumulado[v.categoria].receita += v.valor;
    acumulado[v.categoria].contagem += 1;
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

/** Pipeline em aberto (CRM + Vagas), bruto, agrupado por categoria de
 * negócio — base do "Pipeline ponderado" em /intelligence, que passou a
 * usar uma estimativa fixa de 20% do valor total em vez de ponderar por
 * probabilidade de etapa (essa fórmula com probabilidade continua existindo
 * em getPipelineConsolidado, usada pelo Simulador). */
export async function getPipelineTotalPorCategoria() {
  await requirePapel(PAPEIS_GESTAO);

  const [oportunidadesAbertas, vagasAbertas] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { etapa: { isGanho: false, isPerdido: false } },
      select: { valorEstimado: true, vertical: true, executiveSearch: true },
    }),
    prisma.vaga.findMany({
      where: { status: { notIn: ["fechada", "perdida"] } },
      select: { valor: true, vertical: true, executiveSearch: true },
    }),
  ]);

  const totais: Record<CategoriaVertical, number> = { alocacao: 0, recrutamento: 0, executive_search: 0 };
  for (const o of oportunidadesAbertas) {
    totais[categoriaDeVerticalNegocio(o.vertical, o.executiveSearch)] += Number(o.valorEstimado);
  }
  for (const v of vagasAbertas) {
    totais[categoriaDeVerticalNegocio(v.vertical, v.executiveSearch)] += v.valor ? Number(v.valor) : 0;
  }

  return totais;
}

/** Total de vagas por categoria de negócio (todos os status) — base do
 * card de "vagas por unidade de negócio" em /intelligence, que troca entre
 * Recrutamento & Seleção e Alocação. */
export async function getTotalVagasPorCategoria() {
  await requirePapel(PAPEIS_GESTAO);

  const vagas = await prisma.vaga.findMany({ select: { vertical: true, executiveSearch: true } });

  const totais: Record<CategoriaVertical, number> = { alocacao: 0, recrutamento: 0, executive_search: 0 };
  for (const v of vagas) totais[categoriaDeVerticalNegocio(v.vertical, v.executiveSearch)] += 1;

  return totais;
}

/** Valor total (R$) de vagas perdidas/canceladas por categoria de negócio —
 * base do card "Vagas $$$ (valor)" em /intelligence: quanto se perdeu em
 * valor de mandato por cancelamento, separado por unidade de negócio (mesmo
 * padrão de toggle do card "Vagas", que conta quantidade em vez de valor). */
export async function getValorVagasPerdidasPorCategoria() {
  await requirePapel(PAPEIS_GESTAO);

  const vagasPerdidas = await prisma.vaga.findMany({
    where: { status: "perdida" },
    select: { valor: true, vertical: true, executiveSearch: true },
  });

  const totais: Record<CategoriaVertical, number> = { alocacao: 0, recrutamento: 0, executive_search: 0 };
  for (const v of vagasPerdidas) {
    totais[categoriaDeVerticalNegocio(v.vertical, v.executiveSearch)] += v.valor ? Number(v.valor) : 0;
  }

  return totais;
}

/** Média por vaga fechada de Recrutamento & Seleção = soma de Vaga.valor
 * (preenchido no fechamento, ver fecharVaga) dividido pela contagem de
 * vagas fechadas dessa categoria — substituiu Margem Estimada no Executive
 * Intelligence (getMargemEstimada segue existindo, só não é mais chamada
 * ali). Sem vaga fechada com valor, retorna null (não divide por zero). */
export async function getMediaPorVagaRecrutamento() {
  await requirePapel(PAPEIS_GESTAO);

  const vagasFechadas = await prisma.vaga.findMany({
    where: { status: "fechada", vertical: { not: "alocacao_tech" }, executiveSearch: false },
    select: { valor: true },
  });

  const valorTotal = vagasFechadas.reduce((acc, v) => acc + (v.valor ? Number(v.valor) : 0), 0);
  const contagem = vagasFechadas.length;

  return { valorTotal, contagem, media: contagem > 0 ? valorTotal / contagem : null };
}
