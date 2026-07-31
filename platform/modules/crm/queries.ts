import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_CRM } from "@/lib/roles";

export async function getPipelineComercial() {
  await requirePapel(PAPEIS_CRM);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "comercial" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });

  if (!pipeline) {
    throw new Error(
      "Pipeline Comercial não encontrado — rode prisma/seed.sql (ver platform/README.md).",
    );
  }

  return pipeline;
}

export async function getOportunidades() {
  await requirePapel(PAPEIS_CRM);

  return prisma.oportunidade.findMany({
    include: {
      empresa: true,
      contato: true,
      responsavel: true,
      etapa: true,
    },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getOportunidade(id: string) {
  await requirePapel(PAPEIS_CRM);

  return prisma.oportunidade.findUnique({
    where: { id },
    include: { empresa: true, contato: true, responsavel: true, etapa: true },
  });
}

export async function getAtividadesDaEntidade(entidadeTipo: string, entidadeId: string) {
  await requirePapel(PAPEIS_CRM);

  return prisma.atividade.findMany({
    where: { entidadeTipo: entidadeTipo as never, entidadeId },
    include: { autor: true },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getArquivosDaEntidade(entidadeTipo: string, entidadeId: string) {
  await requirePapel(PAPEIS_CRM);

  return prisma.arquivo.findMany({
    where: { entidadeTipo: entidadeTipo as never, entidadeId },
    include: { enviadoPor: true },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getEmpresas() {
  await requirePapel(PAPEIS_CRM);

  return prisma.empresa.findMany({
    include: { contatos: true, _count: { select: { oportunidades: true } } },
    orderBy: { nome: "asc" },
  });
}

/** "Cliente" = empresa com status ativo — ver modelagem-dados.md, seção "empresas". */
export async function getClientesAtivos() {
  await requirePapel(PAPEIS_CRM);

  return prisma.empresa.findMany({
    where: { status: "ativo" },
    include: { contatos: true, _count: { select: { oportunidades: true } } },
    orderBy: { nome: "asc" },
  });
}

export async function getConsultoresComerciais() {
  await requirePapel(PAPEIS_CRM);

  return prisma.usuario.findMany({
    where: { papel: { in: ["consultor_comercial", "admin", "diretoria"] } },
    orderBy: { nome: "asc" },
  });
}
