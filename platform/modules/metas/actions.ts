"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import { criarOuAtualizarMetaSchema, type CriarOuAtualizarMetaFormInput } from "@/modules/metas/schemas";

export async function criarOuAtualizarMeta(input: CriarOuAtualizarMetaFormInput) {
  await requirePapel(PAPEIS_GESTAO);
  const data = criarOuAtualizarMetaSchema.parse(input);

  await prisma.meta.upsert({
    where: { usuarioId_tipo_ano_mes: { usuarioId: data.usuarioId, tipo: data.tipo, ano: data.ano, mes: data.mes } },
    create: data,
    update: { valorAlvo: data.valorAlvo },
  });

  revalidatePath("/configuracoes/metas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios/produtividade");
}

export async function excluirMeta(id: string) {
  await requirePapel(PAPEIS_GESTAO);
  await prisma.meta.delete({ where: { id } });

  revalidatePath("/configuracoes/metas");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios/produtividade");
}
