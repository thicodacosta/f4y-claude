"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ADMIN } from "@/lib/roles";

export async function alternarAutomacao(automacaoId: string, ativo: boolean) {
  await requirePapel(PAPEIS_ADMIN);

  await prisma.automacao.update({ where: { id: automacaoId }, data: { ativo } });
  revalidatePath("/configuracoes/automacoes");
}
