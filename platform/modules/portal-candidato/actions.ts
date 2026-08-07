"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePortalCandidato } from "@/lib/auth";
import {
  propostaEdicaoPerfilSchema,
  type PropostaEdicaoPerfilInput,
} from "@/modules/portal-candidato/schemas";

/** Nunca escreve direto em Candidato — fica pendente até um recrutador
 * aprovar (ver modules/ats/actions.ts#aprovarEdicaoPerfil). Um pendente por
 * vez evita fila de propostas conflitantes esperando revisão. */
export async function proporEdicaoPerfil(input: PropostaEdicaoPerfilInput) {
  const { candidatoId } = await requirePortalCandidato();
  const data = propostaEdicaoPerfilSchema.parse(input);

  const jaTemPendente = await prisma.edicaoPerfilPendente.findFirst({
    where: { candidatoId, status: "pendente" },
  });
  if (jaTemPendente) {
    throw new Error("Você já tem uma edição aguardando revisão — aguarde a análise antes de enviar outra.");
  }

  await prisma.edicaoPerfilPendente.create({
    data: { candidatoId, campos: data },
  });

  revalidatePath("/portal-candidato/perfil");
}
