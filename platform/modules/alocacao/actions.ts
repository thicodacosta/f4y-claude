"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ATS } from "@/lib/roles";
import {
  criarContratoSchema,
  renovarContratoSchema,
  encerrarContratoSchema,
  type CriarContratoFormInput,
} from "@/modules/alocacao/schemas";

const DIAS_LEMBRETE_RENOVACAO = 30;

function somarMeses(data: Date, meses: number) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

function calcularLembrete(dataFim: Date) {
  const d = new Date(dataFim);
  d.setDate(d.getDate() - DIAS_LEMBRETE_RENOVACAO);
  return d;
}

function revalidateAlocacao(vagaId: string) {
  revalidatePath("/alocacao");
  revalidatePath("/alocacao/pool");
  revalidatePath(`/vagas/${vagaId}`);
}

/** Fluxos-usuario.md #4, passo 3: contrato nasce com lembrete de renovação já
 * calculado (30 dias antes do fim) — automação nativa, não manual. */
export async function criarContrato(input: CriarContratoFormInput) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = criarContratoSchema.parse(input);

  const dataInicio = new Date(data.dataInicio);
  const dataFim = somarMeses(dataInicio, data.prazoMeses);
  const renovacaoLembreteEm = calcularLembrete(dataFim);

  await prisma.$transaction(async (tx) => {
    const contrato = await tx.contratoAlocacao.create({
      data: {
        vagaId: data.vagaId,
        candidatoId: data.candidatoId,
        rate: data.rate,
        prazoMeses: data.prazoMeses,
        dataInicio,
        dataFim,
        renovacaoLembreteEm,
      },
      include: { candidato: true },
    });

    // Fluxos-usuario.md #4, passo 2: pool de disponibilidade atualiza
    // automaticamente — o profissional alocado sai do pool.
    await tx.candidato.update({
      where: { id: data.candidatoId },
      data: { disponibilidade: "indisponivel", status: "alocado" },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: data.vagaId,
        tipo: "nota",
        autorId: usuario.id,
        conteudo: `Contrato de alocação criado com "${contrato.candidato.nome}" — ${data.prazoMeses} meses, encerra em ${dataFim.toLocaleDateString("pt-BR")}.`,
      },
    });
  });

  revalidateAlocacao(data.vagaId);
}

export async function renovarContrato(input: { contratoId: string; prazoMeses: number }) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = renovarContratoSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const contrato = await tx.contratoAlocacao.findUniqueOrThrow({
      where: { id: data.contratoId },
      include: { candidato: true },
    });

    const novaDataFim = somarMeses(contrato.dataFim, data.prazoMeses);
    const novoLembrete = calcularLembrete(novaDataFim);

    await tx.contratoAlocacao.update({
      where: { id: data.contratoId },
      data: { dataFim: novaDataFim, renovacaoLembreteEm: novoLembrete, status: "renovado" },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: contrato.vagaId,
        tipo: "nota",
        autorId: usuario.id,
        conteudo: `Contrato de "${contrato.candidato.nome}" renovado por mais ${data.prazoMeses} meses — novo encerramento em ${novaDataFim.toLocaleDateString("pt-BR")}.`,
      },
    });
  });

  revalidatePath("/alocacao");
}

export async function encerrarContrato(input: { contratoId: string }) {
  const usuario = await requirePapel(PAPEIS_ATS);
  const data = encerrarContratoSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const contrato = await tx.contratoAlocacao.update({
      where: { id: data.contratoId },
      data: { status: "encerrado" },
      include: { candidato: true },
    });

    // Volta pro pool de disponibilidade automaticamente.
    await tx.candidato.update({
      where: { id: contrato.candidatoId },
      data: { disponibilidade: "imediata", status: "ativo" },
    });

    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: contrato.vagaId,
        tipo: "nota",
        autorId: usuario.id,
        conteudo: `Contrato de "${contrato.candidato.nome}" encerrado.`,
      },
    });
  });

  revalidatePath("/alocacao");
  revalidatePath("/alocacao/pool");
}
