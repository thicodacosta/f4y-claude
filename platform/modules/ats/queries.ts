import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS, PAPEIS_EXECUTIVE_SEARCH } from "@/lib/roles";
import type { Prisma } from "@/lib/generated/prisma/client";

export function podeVerConfidencial(papel: string | null) {
  return !!papel && (PAPEIS_EXECUTIVE_SEARCH as string[]).includes(papel);
}

/** Defesa em profundidade pras Server Actions que recebem um `vagaId` direto
 * (não passam pela listagem, que já filtra) — ver modules/ats/actions.ts.
 * Mensagem genérica de propósito, pra não confirmar que a vaga existe. */
export async function assertPodeAcessarVaga(papel: string | null, vagaId: string) {
  const vaga = await prisma.vaga.findUnique({ where: { id: vagaId }, select: { confidencial: true } });
  if (!vaga || (vaga.confidencial && !podeVerConfidencial(papel))) {
    throw new Error("Vaga não encontrada.");
  }
}

export async function getPipelineVagas() {
  await requirePapel(PAPEIS_ATS);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "vagas" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });

  if (!pipeline) {
    throw new Error("Pipeline de Vagas não encontrado — rode prisma/seed.sql (ver platform/README.md).");
  }

  return pipeline;
}

export async function getVagas() {
  const usuario = await requirePapel(PAPEIS_ATS);

  // Confidencialidade (fluxos-usuario.md #3, passo 1): quem não tem papel de
  // Executive Search nem sequer vê que a vaga existe — não é só ocultar
  // detalhe, é excluir da listagem.
  return prisma.vaga.findMany({
    where: podeVerConfidencial(usuario.papel) ? undefined : { confidencial: false },
    include: {
      empresa: true,
      oportunidadeOrigem: true,
      consultor: true,
      recrutador: true,
      _count: { select: { candidatos: true } },
    },
    orderBy: { criadoEm: "desc" },
  });
}

/** Relatório informativo acima do Kanban de Vagas — vagas fechadas por mês,
 * com a soma do valor de fechamento (Vaga.valor). Mesma exclusão de
 * confidenciais que getVagas() — o agregado não pode vazar valor de vaga
 * confidencial pra quem não tem papel de Executive Search. */
export async function getVagasFechadasPorPeriodo(meses = 12) {
  const usuario = await requirePapel(PAPEIS_ATS);

  const desde = new Date();
  desde.setMonth(desde.getMonth() - (meses - 1));
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const vagas = await prisma.vaga.findMany({
    where: {
      status: "fechada",
      fechadoEm: { gte: desde },
      ...(podeVerConfidencial(usuario.papel) ? {} : { confidencial: false }),
    },
    select: { valor: true, fechadoEm: true },
  });

  const buckets = new Map<string, { quantidade: number; valorTotal: number }>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { quantidade: 0, valorTotal: 0 });
  }
  for (const v of vagas) {
    if (!v.fechadoEm) continue;
    const key = `${v.fechadoEm.getFullYear()}-${String(v.fechadoEm.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.quantidade += 1;
    bucket.valorTotal += v.valor ? Number(v.valor) : 0;
  }

  return [...buckets.entries()]
    .map(([mes, dados]) => ({ mes, ...dados }))
    .reverse();
}

/** Vagas ativas (nem fechada, nem perdida) agrupadas por vertical, com soma
 * de valor — mesmo gate de confidencialidade de getVagas(). valorTotal
 * alimenta as médias por Categoria (Alocação = vertical alocacao_tech;
 * Recrutamento & Seleção = as demais) no relatório acima do Kanban. */
export async function getVagasAtivasPorVertical() {
  const usuario = await requirePapel(PAPEIS_ATS);

  const grupos = await prisma.vaga.groupBy({
    by: ["vertical"],
    where: {
      status: { notIn: ["fechada", "perdida"] },
      ...(podeVerConfidencial(usuario.papel) ? {} : { confidencial: false }),
    },
    _count: true,
    _sum: { valor: true },
  });

  return grupos.map((g) => ({
    vertical: g.vertical,
    total: g._count,
    valorTotal: g._sum.valor ? Number(g._sum.valor) : 0,
  }));
}

/** Funil do Pipeline de Vagas com valor por etapa — mesma contagem de
 * getFunilVagas() (modules/dashboard/queries.ts), mas com o gate de
 * confidencialidade que aquela versão (usada só no Dashboard geral) não
 * tem, e somando Vaga.valor por etapa pro relatório acima do Kanban. */
export async function getFunilVagasComValor() {
  const usuario = await requirePapel(PAPEIS_ATS);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "vagas" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });
  if (!pipeline) return [];

  const vagas = await prisma.vaga.findMany({
    where: podeVerConfidencial(usuario.papel) ? undefined : { confidencial: false },
    select: { etapaId: true, valor: true },
  });

  const porEtapa = new Map<string, { total: number; valorTotal: number }>();
  for (const v of vagas) {
    const atual = porEtapa.get(v.etapaId) ?? { total: 0, valorTotal: 0 };
    atual.total += 1;
    atual.valorTotal += v.valor ? Number(v.valor) : 0;
    porEtapa.set(v.etapaId, atual);
  }

  return pipeline.etapas.map((etapa) => ({
    id: etapa.id,
    nome: etapa.nome,
    cor: etapa.cor,
    isGanho: etapa.isGanho,
    isPerdido: etapa.isPerdido,
    total: porEtapa.get(etapa.id)?.total ?? 0,
    valorTotal: porEtapa.get(etapa.id)?.valorTotal ?? 0,
  }));
}

/** Fase 11 — todos os contatos de todas as empresas, pro pop-up de
 * fechamento (components/ats/fechar-vaga-dialog.tsx) filtrar por empresaId
 * no client sem precisar de uma chamada por vaga. Lista curta e barata
 * (nome/email/cargo), sem dado sensível. */
export async function getContatosParaFechamento() {
  await requirePapel(PAPEIS_ATS);

  return prisma.contato.findMany({
    select: { id: true, nome: true, email: true, cargo: true, empresaId: true },
    orderBy: { nome: "asc" },
  });
}

export async function getVaga(id: string) {
  const usuario = await requirePapel(PAPEIS_ATS);

  const vaga = await prisma.vaga.findUnique({
    where: { id },
    include: {
      empresa: true,
      oportunidadeOrigem: true,
      consultor: true,
      recrutador: true,
      etapa: true,
      candidatos: {
        include: { candidato: true },
        orderBy: { criadoEm: "desc" },
      },
    },
  });

  // Trata como "não encontrada" (não como "sem permissão") pra não vazar a
  // existência da vaga confidencial pra quem não tem o papel.
  if (vaga?.confidencial && !podeVerConfidencial(usuario.papel)) return null;

  return vaga;
}

export async function getCandidatos(filtro?: {
  busca?: string;
  skill?: string;
  cidade?: string;
  disponibilidade?: string;
}) {
  await requirePapel(PAPEIS_ATS);

  const where: Prisma.CandidatoWhereInput = {};

  if (filtro?.busca) {
    where.OR = [
      { nome: { contains: filtro.busca, mode: "insensitive" } },
      { cargoAtual: { contains: filtro.busca, mode: "insensitive" } },
      { empresaAtual: { contains: filtro.busca, mode: "insensitive" } },
    ];
  }
  if (filtro?.skill) {
    where.skills = { has: filtro.skill };
  }
  if (filtro?.cidade) {
    where.cidade = { contains: filtro.cidade, mode: "insensitive" };
  }
  if (filtro?.disponibilidade) {
    where.disponibilidade = filtro.disponibilidade as never;
  }

  return prisma.candidato.findMany({
    where,
    include: { _count: { select: { vagas: true } } },
    orderBy: { nome: "asc" },
  });
}

export async function getCandidato(id: string) {
  await requirePapel(PAPEIS_ATS);

  return prisma.candidato.findUnique({
    where: { id },
    include: {
      vagas: {
        include: { vaga: { include: { empresa: true } } },
        orderBy: { criadoEm: "desc" },
      },
    },
  });
}

/** Empresas visíveis a quem trabalha o ATS (recrutador/consultor_executive_search
 * não têm papel de CRM, então não podem usar modules/crm/queries#getEmpresas). */
export async function getEmpresasParaVaga() {
  await requirePapel(PAPEIS_ATS);

  return prisma.empresa.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

export async function getAtividadesDaVaga(vagaId: string) {
  await requirePapel(PAPEIS_ATS);

  return prisma.atividade.findMany({
    where: { entidadeTipo: "vaga", entidadeId: vagaId },
    include: { autor: true },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getEquipeAts() {
  await requirePapel(PAPEIS_ATS);

  return prisma.usuario.findMany({
    where: { papel: { in: ["recrutador", "consultor_executive_search", "admin", "diretoria"] } },
    orderBy: { nome: "asc" },
  });
}

/** Fase 7 — edições de perfil propostas pelo candidato no Portal do
 * Candidato, aguardando (ou já revisadas) por quem trabalha o ATS. */
export async function getEdicoesPendentesDoCandidato(candidatoId: string) {
  await requirePapel(PAPEIS_ATS);

  const edicoes = await prisma.edicaoPerfilPendente.findMany({
    where: { candidatoId },
    orderBy: { criadoEm: "desc" },
    take: 10,
  });

  return edicoes.map((e) => ({
    id: e.id,
    campos: e.campos as Record<string, unknown>,
    status: e.status,
    criadoEm: e.criadoEm.toISOString(),
  }));
}
