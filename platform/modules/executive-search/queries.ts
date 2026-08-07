import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_EXECUTIVE_SEARCH } from "@/lib/roles";

/** Abordagem confidencial (fluxos-usuario.md #3, passo 3) — registrada como
 * Atividade no candidato, mas só quem tem papel de Executive Search lê. Não
 * é uma timeline geral do candidato (essa não existe ainda nesta fase). */
export async function getAbordagensConfidenciais(candidatoId: string) {
  await requirePapel(PAPEIS_EXECUTIVE_SEARCH);

  return prisma.atividade.findMany({
    where: { entidadeTipo: "candidato", entidadeId: candidatoId },
    include: { autor: true },
    orderBy: { criadoEm: "desc" },
  });
}
