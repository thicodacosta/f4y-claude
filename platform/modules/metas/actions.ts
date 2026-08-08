"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import {
  criarOuAtualizarMetaSchema,
  criarOuAtualizarMetaOrganizacionalSchema,
  type CriarOuAtualizarMetaFormInput,
  type CriarOuAtualizarMetaOrganizacionalFormInput,
} from "@/modules/metas/schemas";

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

function revalidateIntelligence() {
  revalidatePath("/configuracoes/metas");
  revalidatePath("/intelligence");
  revalidatePath("/intelligence/ceo");
  revalidatePath("/intelligence/forecast");
}

export async function criarOuAtualizarMetaOrganizacional(input: CriarOuAtualizarMetaOrganizacionalFormInput) {
  await requirePapel(PAPEIS_GESTAO);
  const data = criarOuAtualizarMetaOrganizacionalSchema.parse(input);

  await prisma.metaOrganizacional.upsert({
    where: { categoria_ano_mes: { categoria: data.categoria, ano: data.ano, mes: data.mes } },
    create: data,
    update: { valorAlvo: data.valorAlvo },
  });

  revalidateIntelligence();
}

export async function excluirMetaOrganizacional(id: string) {
  await requirePapel(PAPEIS_GESTAO);
  await prisma.metaOrganizacional.delete({ where: { id } });

  revalidateIntelligence();
}
