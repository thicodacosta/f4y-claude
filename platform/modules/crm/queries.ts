import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_CRM, PAPEIS_INTERNOS } from "@/lib/roles";

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

/** PAPEIS_INTERNOS (não PAPEIS_CRM) — o menu libera "Empresas" pra
 * recrutador/financeiro também (ver lib/nav.ts), e o registro precisa
 * mostrar toda empresa com quem já houve contato, inclusive as que só têm
 * vaga aberta (sem nenhuma oportunidade comercial associada). */
export async function getEmpresas() {
  await requirePapel(PAPEIS_INTERNOS);

  const empresas = await prisma.empresa.findMany({
    include: { contatos: true, _count: { select: { oportunidades: true, vagas: true } } },
    orderBy: { nome: "asc" },
  });

  // status=ativo primeiro (nome asc dentro de cada grupo, via sort estável)
  // — sem isso os clientes reais somem no meio dos 300+ prospects do
  // import de contatos, que dominam a lista em ordem alfabética pura.
  return empresas.sort((a, b) => Number(b.status === "ativo") - Number(a.status === "ativo"));
}

/** Clientes de verdade (status=ativo) pra visão geral do CRM — diferente de
 * getEmpresas() (traz tudo, inclusive os 337 prospects do import de
 * contatos de prospecção, pesado demais pra um card de resumo). */
export async function getClientesAtivos() {
  await requirePapel(PAPEIS_CRM);

  return prisma.empresa.findMany({
    where: { status: "ativo" },
    include: { _count: { select: { oportunidades: true, vagas: true, contatos: true } } },
    orderBy: { nome: "asc" },
  });
}

/** Fase 7 — base pra /empresas/[id], que hoje existe sobretudo pra gerenciar
 * contatos e convite ao Portal do Cliente (não havia detalhe de empresa
 * antes disso). */
export async function getEmpresa(id: string) {
  await requirePapel(PAPEIS_INTERNOS);

  return prisma.empresa.findUnique({
    where: { id },
    include: {
      contatos: { orderBy: { principal: "desc" } },
      _count: { select: { oportunidades: true, vagas: true } },
    },
  });
}

/** Todos os contatos de prospecção, cruzando empresas — inclusive os sem
 * empresa identificada na fonte (empresaId null, ver Contato no schema).
 * Base pra /crm/contatos, que mostra tudo num grid de cards com filtro
 * client-side (453 linhas é pouco pra precisar paginar/filtrar no banco). */
export async function getContatos() {
  await requirePapel(PAPEIS_CRM);

  // `select` explícito (não `include: { empresa: true }`) — só os campos que
  // serializeContato realmente usa. Empresa tem colunas pesadas (logoUrl,
  // observações etc.) que não fazem sentido carregar/serializar 453x só pra
  // exibir o nome no card.
  return prisma.contato.findMany({
    select: {
      id: true,
      nome: true,
      cargo: true,
      area: true,
      tipo: true,
      nivel: true,
      cidade: true,
      estado: true,
      telefone: true,
      email: true,
      linkedin: true,
      empresaId: true,
      empresa: { select: { nome: true } },
    },
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
