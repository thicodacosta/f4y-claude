import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_CRM, PAPEIS_ATS, PAPEIS_INTERNOS } from "@/lib/roles";

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// --- Comercial ---------------------------------------------------------

export async function getKpisComercial() {
  await requirePapel(PAPEIS_CRM);
  const desde = inicioDoMes();

  const [abertas, ganhasMes, perdidasMes, todasFechadas] = await Promise.all([
    prisma.oportunidade.aggregate({
      where: { etapa: { isGanho: false, isPerdido: false } },
      _count: true,
      _sum: { valorEstimado: true },
    }),
    prisma.oportunidade.aggregate({
      where: { etapa: { isGanho: true }, fechadoEm: { gte: desde } },
      _count: true,
      _sum: { valorEstimado: true },
    }),
    prisma.oportunidade.aggregate({
      where: { etapa: { isPerdido: true }, fechadoEm: { gte: desde } },
      _count: true,
      _sum: { valorEstimado: true },
    }),
    prisma.oportunidade.aggregate({
      where: { OR: [{ etapa: { isGanho: true } }, { etapa: { isPerdido: true } }] },
      _count: true,
    }),
  ]);

  const totalFechadas = todasFechadas._count;
  const ganhasTotal = await prisma.oportunidade.count({ where: { etapa: { isGanho: true } } });
  const taxaConversao = totalFechadas > 0 ? (ganhasTotal / totalFechadas) * 100 : 0;
  const ticketMedio = ganhasTotal > 0 ? Number((await prisma.oportunidade.aggregate({ where: { etapa: { isGanho: true } }, _sum: { valorEstimado: true } }))._sum.valorEstimado ?? 0) / ganhasTotal : 0;

  return {
    oportunidadesAbertas: abertas._count,
    valorEmAberto: Number(abertas._sum.valorEstimado ?? 0),
    ganhasNoMes: ganhasMes._count,
    valorGanhoNoMes: Number(ganhasMes._sum.valorEstimado ?? 0),
    perdidasNoMes: perdidasMes._count,
    valorPerdidoNoMes: Number(perdidasMes._sum.valorEstimado ?? 0),
    taxaConversao,
    ticketMedio,
  };
}

export async function getFunilComercial() {
  await requirePapel(PAPEIS_CRM);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "comercial" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!pipeline) return [];

  const grupos = await prisma.oportunidade.groupBy({
    by: ["etapaId"],
    _count: true,
    _sum: { valorEstimado: true },
  });
  const porEtapa = new Map(grupos.map((g) => [g.etapaId, g]));

  return pipeline.etapas.map((etapa) => ({
    id: etapa.id,
    nome: etapa.nome,
    cor: etapa.cor,
    total: porEtapa.get(etapa.id)?._count ?? 0,
    valor: Number(porEtapa.get(etapa.id)?._sum.valorEstimado ?? 0),
  }));
}

/** Forecast ponderado pela probabilidade da etapa — mesmo modelo do Salesforce
 * citado em wireframes.md#5. Sem `metas` modelada ainda (ver backlog-moscow.md
 * "Módulo de metas e gamificação"), por isso não há Meta/Gap/Pipeline Coverage
 * aqui — só o que dá pra calcular com dado real hoje. */
export async function getForecast() {
  await requirePapel(PAPEIS_CRM);
  const desde = inicioDoMes();

  const abertas = await prisma.oportunidade.findMany({
    where: { etapa: { isGanho: false, isPerdido: false } },
    select: { valorEstimado: true, probabilidade: true },
  });
  const receitaPonderada = abertas.reduce(
    (acc, o) => acc + Number(o.valorEstimado) * (o.probabilidade ? Number(o.probabilidade) / 100 : 0),
    0,
  );
  const valorEmAberto = abertas.reduce((acc, o) => acc + Number(o.valorEstimado), 0);

  const [confirmada, perdida] = await Promise.all([
    prisma.oportunidade.aggregate({
      where: { etapa: { isGanho: true }, fechadoEm: { gte: desde } },
      _sum: { valorEstimado: true },
    }),
    prisma.oportunidade.aggregate({
      where: { etapa: { isPerdido: true }, fechadoEm: { gte: desde } },
      _sum: { valorEstimado: true },
    }),
  ]);

  return {
    valorEmAberto,
    receitaPonderada,
    confirmadaNoMes: Number(confirmada._sum.valorEstimado ?? 0),
    perdidaNoMes: Number(perdida._sum.valorEstimado ?? 0),
  };
}

export async function getReceitaMensal(meses = 6) {
  await requirePapel(PAPEIS_CRM);

  const desde = new Date();
  desde.setMonth(desde.getMonth() - (meses - 1));
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const ganhas = await prisma.oportunidade.findMany({
    where: { etapa: { isGanho: true }, fechadoEm: { gte: desde } },
    select: { valorEstimado: true, fechadoEm: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const o of ganhas) {
    if (!o.fechadoEm) continue;
    const key = `${o.fechadoEm.getFullYear()}-${String(o.fechadoEm.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(o.valorEstimado));
  }

  return [...buckets.entries()].map(([mes, valor]) => ({ mes, valor }));
}

export async function getTopEmpresas(limit = 5) {
  await requirePapel(PAPEIS_CRM);

  const grupos = await prisma.oportunidade.groupBy({
    by: ["empresaId"],
    where: { etapa: { isGanho: true } },
    _sum: { valorEstimado: true },
    orderBy: { _sum: { valorEstimado: "desc" } },
    take: limit,
  });
  const empresas = await prisma.empresa.findMany({
    where: { id: { in: grupos.map((g) => g.empresaId) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(empresas.map((e) => [e.id, e.nome]));

  return grupos.map((g) => ({
    id: g.empresaId,
    nome: nomePorId.get(g.empresaId) ?? "—",
    valor: Number(g._sum.valorEstimado ?? 0),
  }));
}

export async function getTopConsultores(limit = 5) {
  await requirePapel(PAPEIS_CRM);

  const grupos = await prisma.oportunidade.groupBy({
    by: ["responsavelId"],
    where: { etapa: { isGanho: true }, responsavelId: { not: null } },
    _sum: { valorEstimado: true },
    orderBy: { _sum: { valorEstimado: "desc" } },
    take: limit,
  });
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: grupos.map((g) => g.responsavelId).filter((id): id is string => !!id) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));

  return grupos.map((g) => ({
    id: g.responsavelId as string,
    nome: nomePorId.get(g.responsavelId as string) ?? "—",
    valor: Number(g._sum.valorEstimado ?? 0),
  }));
}

// --- Recrutamento (ATS) -------------------------------------------------

export async function getKpisRecrutamento() {
  await requirePapel(PAPEIS_ATS);
  const desde = inicioDoMes();

  const [abertas, fechadasMes, perdidasMes, finalizadasTotal, fechadasComDatas] = await Promise.all([
    prisma.vaga.count({ where: { status: "aberta" } }),
    prisma.vaga.count({ where: { status: "fechada", fechadoEm: { gte: desde } } }),
    prisma.vaga.count({ where: { status: "perdida", fechadoEm: { gte: desde } } }),
    prisma.vaga.count({ where: { OR: [{ status: "fechada" }, { status: "perdida" }] } }),
    prisma.vaga.findMany({
      where: { status: "fechada", fechadoEm: { not: null }, dataAbertura: { not: null } },
      select: { dataAbertura: true, fechadoEm: true },
    }),
  ]);

  const fechadasTotal = await prisma.vaga.count({ where: { status: "fechada" } });
  const taxaConversao = finalizadasTotal > 0 ? (fechadasTotal / finalizadasTotal) * 100 : 0;

  const dias = fechadasComDatas.map(
    (v) => (v.fechadoEm!.getTime() - v.dataAbertura!.getTime()) / (1000 * 60 * 60 * 24),
  );
  const tempoMedioFechamento = dias.length > 0 ? dias.reduce((a, b) => a + b, 0) / dias.length : null;

  return {
    vagasAbertas: abertas,
    fechadasNoMes: fechadasMes,
    perdidasNoMes: perdidasMes,
    taxaConversao,
    tempoMedioFechamentoDias: tempoMedioFechamento,
  };
}

export async function getFunilVagas() {
  await requirePapel(PAPEIS_ATS);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "vagas" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!pipeline) return [];

  const grupos = await prisma.vaga.groupBy({ by: ["etapaId"], _count: true });
  const porEtapa = new Map(grupos.map((g) => [g.etapaId, g._count]));

  return pipeline.etapas.map((etapa) => ({
    id: etapa.id,
    nome: etapa.nome,
    cor: etapa.cor,
    total: porEtapa.get(etapa.id) ?? 0,
  }));
}

const ETAPA_CANDIDATO_ORDEM = [
  "abertas",
  "analise_rh",
  "cv_enviado",
  "entrevista_cliente",
  "forecast",
  "fechada",
  "perdida",
] as const;

export async function getFunilCandidatos() {
  await requirePapel(PAPEIS_ATS);

  const grupos = await prisma.vagaCandidato.groupBy({ by: ["etapa"], _count: true });
  const porEtapa = new Map(grupos.map((g) => [g.etapa, g._count]));

  return ETAPA_CANDIDATO_ORDEM.map((etapa) => ({ etapa, total: porEtapa.get(etapa) ?? 0 }));
}

export async function getTopTecnologias(limit = 8) {
  await requirePapel(PAPEIS_ATS);

  const vagas = await prisma.vaga.findMany({
    where: { status: { in: ["aberta", "pausada"] } },
    select: { stackTecnologica: true },
  });

  const contagem = new Map<string, number>();
  for (const v of vagas) {
    for (const tech of v.stackTecnologica) {
      contagem.set(tech, (contagem.get(tech) ?? 0) + 1);
    }
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tecnologia, total]) => ({ tecnologia, total }));
}

export async function getTopRecrutadores(limit = 5) {
  await requirePapel(PAPEIS_ATS);

  const grupos = await prisma.vaga.groupBy({
    by: ["recrutadorId"],
    where: { status: "fechada", recrutadorId: { not: null } },
    _count: true,
    orderBy: { _count: { recrutadorId: "desc" } },
    take: limit,
  });
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: grupos.map((g) => g.recrutadorId).filter((id): id is string => !!id) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));

  return grupos.map((g) => ({
    id: g.recrutadorId as string,
    nome: nomePorId.get(g.recrutadorId as string) ?? "—",
    total: g._count,
  }));
}

// --- Geral (combina Comercial + Recrutamento, papéis internos) ---------

export async function getKpisGerais() {
  await requirePapel(PAPEIS_INTERNOS);

  const [clientesAtivos, empresasProspect, vagasAbertas, candidatosAtivos] = await Promise.all([
    prisma.empresa.count({ where: { status: "ativo" } }),
    prisma.empresa.count({ where: { status: "prospect" } }),
    prisma.vaga.count({ where: { status: "aberta" } }),
    prisma.candidato.count({ where: { status: { in: ["ativo", "em_processo"] } } }),
  ]);

  return { clientesAtivos, empresasProspect, vagasAbertas, candidatosAtivos };
}

// --- Fase 8 — Alertas executivos (detecção de gargalo, baseada em regra) --
// Deliberadamente sem IA aqui: são dois limiares fixos e explicáveis, não
// julgamento que se beneficie de um LLM — ver critério "Could Have" de
// backlog-moscow.md e nota de escopo no relatório da fase.

const DIAS_SEM_SOURCING = 15;
const DIAS_VAGA_ABERTA_SEM_FECHAR = 45;

export async function getAlertasExecutivos() {
  await requirePapel(PAPEIS_INTERNOS);

  const vagasAbertas = await prisma.vaga.findMany({
    where: { status: "aberta" },
    include: { empresa: true, _count: { select: { candidatos: true } } },
  });

  const agora = Date.now();
  const umDiaMs = 86_400_000;

  const semSourcing = vagasAbertas.filter((v) => {
    const diasAberta = (agora - v.criadoEm.getTime()) / umDiaMs;
    return v._count.candidatos === 0 && diasAberta > DIAS_SEM_SOURCING;
  });

  const semFecharHaMuitoTempo = vagasAbertas.filter((v) => {
    const diasAberta = (agora - v.criadoEm.getTime()) / umDiaMs;
    return v.posicoesPreenchidas < v.quantidadePosicoes && diasAberta > DIAS_VAGA_ABERTA_SEM_FECHAR;
  });

  return {
    semSourcing: semSourcing.map((v) => ({
      id: v.id,
      cargo: v.cargo,
      empresaNome: v.empresa.nome,
      diasAberta: Math.floor((agora - v.criadoEm.getTime()) / umDiaMs),
    })),
    semFecharHaMuitoTempo: semFecharHaMuitoTempo.map((v) => ({
      id: v.id,
      cargo: v.cargo,
      empresaNome: v.empresa.nome,
      diasAberta: Math.floor((agora - v.criadoEm.getTime()) / umDiaMs),
    })),
  };
}
