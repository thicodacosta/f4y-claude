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
