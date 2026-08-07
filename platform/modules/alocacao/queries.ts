import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS } from "@/lib/roles";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Pool de talentos — fluxos-usuario.md #4, passo 2: candidatos com
 * disponibilidade != indisponível e stack compatível. */
export async function getPoolTalentos(filtro?: { busca?: string; skill?: string }) {
  await requirePapel(PAPEIS_ATS);

  const where: Prisma.CandidatoWhereInput = { disponibilidade: { not: null, notIn: ["indisponivel"] } };

  if (filtro?.busca) {
    where.OR = [
      { nome: { contains: filtro.busca, mode: "insensitive" } },
      { cargoAtual: { contains: filtro.busca, mode: "insensitive" } },
    ];
  }
  if (filtro?.skill) {
    where.OR = [...(where.OR ?? []), { skills: { has: filtro.skill } }, { tecnologias: { has: filtro.skill } }];
  }

  return prisma.candidato.findMany({
    where,
    include: { _count: { select: { contratosAlocacao: true } } },
    orderBy: { nome: "asc" },
  });
}

export async function getContratosDaVaga(vagaId: string) {
  await requirePapel(PAPEIS_ATS);

  return prisma.contratoAlocacao.findMany({
    where: { vagaId },
    include: { candidato: true },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getContratosAtivos() {
  await requirePapel(PAPEIS_ATS);

  return prisma.contratoAlocacao.findMany({
    where: { status: { in: ["ativo", "renovado"] } },
    include: { candidato: true, vaga: { include: { empresa: true } } },
    orderBy: { dataFim: "asc" },
  });
}
