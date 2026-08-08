"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_FINANCEIRO, PAPEIS_ADMIN } from "@/lib/roles";
import {
  atualizarStatusFaturamentoSchema,
  atualizarStatusComissaoSchema,
  atualizarRegraComissaoSchema,
  marcarFaturamentoFlagSchema,
  type AtualizarRegraComissaoFormInput,
} from "@/modules/financeiro/schemas";

function revalidateFinanceiro() {
  revalidatePath("/financeiro");
}

export async function atualizarStatusFaturamento(input: { faturamentoId: string; novoStatus: string }) {
  await requirePapel(PAPEIS_FINANCEIRO);
  const data = atualizarStatusFaturamentoSchema.parse(input);

  await prisma.faturamento.update({
    where: { id: data.faturamentoId },
    data: {
      status: data.novoStatus,
      dataEfetiva: data.novoStatus === "pago" ? new Date() : undefined,
    },
  });

  revalidateFinanceiro();
}

/** Fase 11 — some o alerta oportunista de NF pendente (ver
 * modules/financeiro/alertas.ts#verificarNfsPendentes). */
export async function marcarNfEmitida(input: { faturamentoId: string }) {
  await requirePapel(PAPEIS_FINANCEIRO);
  const data = marcarFaturamentoFlagSchema.parse(input);

  await prisma.faturamento.update({ where: { id: data.faturamentoId }, data: { nfEmitida: true } });
  revalidateFinanceiro();
}

/** Some o alerta oportunista de fim de alocação (ver
 * modules/financeiro/alertas.ts#verificarVencimentosAlocacao). */
export async function marcarAlocacaoEncerrada(input: { faturamentoId: string }) {
  await requirePapel(PAPEIS_FINANCEIRO);
  const data = marcarFaturamentoFlagSchema.parse(input);

  await prisma.faturamento.update({ where: { id: data.faturamentoId }, data: { alocacaoEncerrada: true } });
  revalidateFinanceiro();
}

export async function atualizarStatusComissao(input: { comissaoId: string; novoStatus: string }) {
  await requirePapel(PAPEIS_FINANCEIRO);
  const data = atualizarStatusComissaoSchema.parse(input);

  await prisma.comissao.update({
    where: { id: data.comissaoId },
    data: { status: data.novoStatus },
  });

  revalidateFinanceiro();
}

/** Só admin — regra de comissão é política de remuneração, não operação do
 * dia a dia do financeiro (mesma separação que RLS já aplica em regras_comissao). */
export async function atualizarRegraComissao(input: AtualizarRegraComissaoFormInput) {
  await requirePapel(PAPEIS_ADMIN);
  const data = atualizarRegraComissaoSchema.parse(input);

  await prisma.regraComissao.update({
    where: { vertical: data.vertical },
    data: {
      percentualConsultor: data.percentualConsultor,
      percentualRecrutador: data.percentualRecrutador,
    },
  });

  revalidateFinanceiro();
}
