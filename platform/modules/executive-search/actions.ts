"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_EXECUTIVE_SEARCH } from "@/lib/roles";
import { atualizarEmpresasAlvoSchema, criarAbordagemSchema } from "@/modules/executive-search/schemas";

export async function atualizarEmpresasAlvo(input: { vagaId: string; empresasAlvo: string[] }) {
  await requirePapel(PAPEIS_EXECUTIVE_SEARCH);
  const data = atualizarEmpresasAlvoSchema.parse(input);

  await prisma.vaga.update({
    where: { id: data.vagaId },
    data: { empresasAlvo: data.empresasAlvo },
  });

  revalidatePath(`/vagas/${data.vagaId}`);
  revalidatePath("/executive-search");
}

/** Fluxos-usuario.md #3, passo 3: não gera notificação pública nem aparece
 * na busca padrão de candidatos — só o registro em si, lido só por quem tem
 * o papel (ver modules/executive-search/queries.ts#getAbordagensConfidenciais). */
export async function criarAbordagemConfidencial(input: { candidatoId: string; conteudo: string }) {
  const usuario = await requirePapel(PAPEIS_EXECUTIVE_SEARCH);
  const data = criarAbordagemSchema.parse(input);

  const atividade = await prisma.atividade.create({
    data: {
      entidadeTipo: "candidato",
      entidadeId: data.candidatoId,
      tipo: "nota",
      autorId: usuario.id,
      conteudo: data.conteudo,
    },
    include: { autor: true },
  });

  revalidatePath(`/candidatos/${data.candidatoId}`);
  return atividade;
}
