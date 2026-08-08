"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_CRM, PAPEIS_ADMIN } from "@/lib/roles";
import {
  criarOportunidadeSchema,
  criarContatoSchema,
  criarAtividadeSchema,
  moverOportunidadeSchema,
  criarEtapaSchema,
  atualizarEtapaSchema,
  reordenarEtapasSchema,
  type CriarOportunidadeFormInput,
  type CriarContatoInput,
  type CriarAtividadeInput,
} from "@/modules/crm/schemas";
import { serializeEtapa } from "@/modules/crm/serialize";
import { gerarFaturamentoEComissao } from "@/modules/financeiro/comissoes";
import { dispararEntrouEtapa } from "@/modules/automacoes/engine";

function revalidateCrm() {
  revalidatePath("/crm/pipeline-comercial");
  revalidatePath("/empresas");
}

export async function criarOportunidade(input: CriarOportunidadeFormInput) {
  const usuario = await requirePapel(PAPEIS_CRM);
  const data = criarOportunidadeSchema.parse(input);

  const pipeline = await prisma.pipeline.findUnique({
    where: { tipo: "comercial" },
    include: { etapas: { orderBy: { ordem: "asc" }, take: 1 } },
  });
  const primeiraEtapa = pipeline?.etapas[0];
  if (!primeiraEtapa) {
    throw new Error("Pipeline Comercial sem etapas — rode prisma/seed.sql.");
  }

  // Sem `return` do registro criado de propósito: campos `Decimal` do Prisma
  // não são serializáveis pelo RSC ao cruzar a fronteira Server Action ->
  // Client Component, e quem chama (nova-oportunidade-dialog.tsx) só precisa
  // saber se deu certo ou lançou erro, não do valor.
  await prisma.$transaction(async (tx) => {
    let empresaId = data.empresaId;
    if (!empresaId && data.empresaNovaNome) {
      const empresa = await tx.empresa.create({
        data: { nome: data.empresaNovaNome, origem: data.origem },
      });
      empresaId = empresa.id;
    }
    if (!empresaId) throw new Error("Empresa não informada.");

    const oportunidade = await tx.oportunidade.create({
      data: {
        empresaId,
        contatoId: data.contatoId,
        etapaId: primeiraEtapa.id,
        responsavelId: usuario.id,
        vertical: data.vertical,
        executiveSearch: data.executiveSearch,
        origem: data.origem,
        valorEstimado: data.valorEstimado,
        previsaoFechamento: data.previsaoFechamento ? new Date(data.previsaoFechamento) : null,
        observacoes: data.observacoes,
      },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "oportunidade",
        entidadeId: oportunidade.id,
        tipo: "nota",
        autorId: usuario.id,
        conteudo: `Oportunidade criada em "${primeiraEtapa.nome}".`,
      },
    });

    // Engine de automações (Fase 5) — a oportunidade já nasce na primeira
    // etapa (Lead), então "entrou_etapa" dispara aqui, não só no
    // moverOportunidade.
    await dispararEntrouEtapa(tx, primeiraEtapa.id, {
      entidadeTipo: "oportunidade",
      entidadeId: oportunidade.id,
      responsavelId: usuario.id,
    });
  });

  revalidateCrm();
}

export async function moverOportunidade(input: {
  oportunidadeId: string;
  novaEtapaId: string;
  motivoPerda?: string;
}) {
  const usuario = await requirePapel(PAPEIS_CRM);
  const data = moverOportunidadeSchema.parse(input);

  const novaEtapa = await prisma.pipelineEtapa.findUnique({ where: { id: data.novaEtapaId } });
  if (!novaEtapa) throw new Error("Etapa de destino não encontrada.");
  if (novaEtapa.isPerdido && !data.motivoPerda) {
    throw new Error("Informe o motivo da perda para mover para esta etapa.");
  }

  // Sem `return` do registro atualizado de propósito — mesma razão de
  // criarOportunidade acima (`probabilidade` é Decimal, não serializável
  // pelo RSC; pipeline-comercial-view.tsx já atualiza o estado local
  // otimisticamente e não precisa do valor de volta).
  await prisma.$transaction(async (tx) => {
    const atual = await tx.oportunidade.findUniqueOrThrow({
      where: { id: data.oportunidadeId },
      include: { etapa: true },
    });

    await tx.oportunidade.update({
      where: { id: data.oportunidadeId },
      data: {
        etapaId: novaEtapa.id,
        probabilidade: novaEtapa.probabilidadePadrao ?? undefined,
        motivoPerda: novaEtapa.isPerdido ? data.motivoPerda : null,
        fechadoEm: novaEtapa.isGanho || novaEtapa.isPerdido ? new Date() : null,
      },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "oportunidade",
        entidadeId: data.oportunidadeId,
        tipo: "mudanca_etapa",
        autorId: usuario.id,
        conteudo: `Movida de "${atual.etapa.nome}" para "${novaEtapa.nome}".${
          data.motivoPerda ? ` Motivo: ${data.motivoPerda}` : ""
        }`,
      },
    });

    // Fluxo comercial (docs/business-platform/fluxos-usuario.md #1): oportunidade
    // Ganha vira cliente ativo automaticamente, não só um prospect.
    if (novaEtapa.isGanho) {
      await tx.empresa.update({ where: { id: atual.empresaId }, data: { status: "ativo" } });

      // Fluxo financeiro (fluxos-usuario.md #5, passo 1): fechamento gera
      // lançamento pendente de faturamento + comissão automaticamente.
      await gerarFaturamentoEComissao(tx, {
        empresaId: atual.empresaId,
        origemTipo: "oportunidade",
        origemId: atual.id,
        valor: Number(atual.valorEstimado),
        vertical: atual.vertical,
        usuarioId: atual.responsavelId,
      });
    }

    // Engine de automações (Fase 5) — dispara qualquer regra configurada
    // para "entrou_etapa" nesta etapa específica (ver /configuracoes/automacoes).
    await dispararEntrouEtapa(tx, novaEtapa.id, {
      entidadeTipo: "oportunidade",
      entidadeId: atual.id,
      responsavelId: atual.responsavelId,
    });
  });

  revalidateCrm();
}

export async function criarContato(input: CriarContatoInput) {
  await requirePapel(PAPEIS_CRM);
  const data = criarContatoSchema.parse(input);

  const contato = await prisma.contato.create({
    data: {
      empresaId: data.empresaId,
      nome: data.nome,
      cargo: data.cargo,
      telefone: data.telefone,
      email: data.email || undefined,
      linkedin: data.linkedin,
    },
  });

  revalidateCrm();
  return contato;
}

export async function criarAtividade(input: CriarAtividadeInput) {
  const usuario = await requirePapel(PAPEIS_CRM);
  const data = criarAtividadeSchema.parse(input);

  const atividade = await prisma.atividade.create({
    data: { ...data, autorId: usuario.id },
    include: { autor: true },
  });

  revalidateCrm();
  return atividade;
}

/** Busca sob demanda (drawer client-side) — mesma leitura de modules/crm/queries.ts,
 * exposta como Server Action porque quem chama é um Client Component interativo. */
export async function listarAtividades(entidadeTipo: string, entidadeId: string) {
  await requirePapel(PAPEIS_CRM);
  return prisma.atividade.findMany({
    where: { entidadeTipo: entidadeTipo as never, entidadeId },
    include: { autor: true },
    orderBy: { criadoEm: "desc" },
  });
}

export async function listarArquivos(entidadeTipo: string, entidadeId: string) {
  await requirePapel(PAPEIS_CRM);
  return prisma.arquivo.findMany({
    where: { entidadeTipo: entidadeTipo as never, entidadeId },
    include: { enviadoPor: true },
    orderBy: { criadoEm: "desc" },
  });
}

// --- Configuração de pipeline (admin) ---------------------------------------

export async function criarEtapa(input: {
  pipelineId: string;
  nome: string;
  cor: string;
  slaDias?: number;
  probabilidadePadrao?: number;
}) {
  await requirePapel(PAPEIS_ADMIN);
  const data = criarEtapaSchema.parse(input);

  // Ganho/Perdido são colunas fixas ao final (ver wireframes.md) — a nova
  // etapa entra sempre antes delas, nunca depois.
  const etapa = await prisma.$transaction(async (tx) => {
    const naoFixas = await tx.pipelineEtapa.count({
      where: { pipelineId: data.pipelineId, isGanho: false, isPerdido: false },
    });

    await tx.pipelineEtapa.updateMany({
      where: { pipelineId: data.pipelineId, OR: [{ isGanho: true }, { isPerdido: true }] },
      data: { ordem: { increment: 1 } },
    });

    return tx.pipelineEtapa.create({
      data: {
        pipelineId: data.pipelineId,
        nome: data.nome,
        cor: data.cor,
        ordem: naoFixas + 1,
        slaDias: data.slaDias,
        probabilidadePadrao: data.probabilidadePadrao,
      },
    });
  });

  revalidatePath("/configuracoes/pipelines");
  revalidateCrm();
  // Serializa antes de devolver ao client — `probabilidadePadrao` é Decimal
  // no Prisma, não serializável pelo RSC (pipeline-etapas-editor.tsx usa
  // id/nome/cor/ordem do retorno para atualizar a lista local).
  return serializeEtapa(etapa);
}

export async function atualizarEtapa(input: {
  etapaId: string;
  nome?: string;
  cor?: string;
  slaDias?: number | null;
  probabilidadePadrao?: number | null;
}) {
  await requirePapel(PAPEIS_ADMIN);
  const data = atualizarEtapaSchema.parse(input);
  const { etapaId, ...rest } = data;

  // Sem `return` de propósito — mesma razão de criarOportunidade (Decimal
  // não serializável); pipeline-etapas-editor.tsx já atualiza localmente.
  await prisma.pipelineEtapa.update({ where: { id: etapaId }, data: rest });

  revalidatePath("/configuracoes/pipelines");
  revalidateCrm();
}

export async function excluirEtapa(input: { etapaId: string; etapaDestinoId: string }) {
  await requirePapel(PAPEIS_ADMIN);

  if (input.etapaId === input.etapaDestinoId) {
    throw new Error("Escolha uma etapa de destino diferente da que está sendo excluída.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.oportunidade.updateMany({
      where: { etapaId: input.etapaId },
      data: { etapaId: input.etapaDestinoId },
    });
    await tx.pipelineEtapa.delete({ where: { id: input.etapaId } });
  });

  revalidatePath("/configuracoes/pipelines");
  revalidateCrm();
}

export async function reordenarEtapas(input: { pipelineId: string; ordem: string[] }) {
  await requirePapel(PAPEIS_ADMIN);
  const data = reordenarEtapasSchema.parse(input);

  await prisma.$transaction(
    data.ordem.map((etapaId, index) =>
      prisma.pipelineEtapa.update({ where: { id: etapaId }, data: { ordem: index + 1 } }),
    ),
  );

  revalidatePath("/configuracoes/pipelines");
  revalidateCrm();
}
