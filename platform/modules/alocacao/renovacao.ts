import "server-only";

import { prisma } from "@/lib/prisma";
import { executarAutomacao } from "@/modules/automacoes/engine";

/**
 * Verificação oportunista de renovação de contrato — mesmo padrão (sem cron
 * real) da verificação de SLA em modules/automacoes/sla.ts. Roda a cada
 * carregamento do Dashboard. Notifica consultor E recrutador da vaga (ver
 * fluxos-usuario.md #4, passo 4: "sistema notifica consultor e recrutador
 * antes do vencimento"), uma vez cada, por contrato.
 */
export async function verificarRenovacoesPendentes() {
  const automacoes = await prisma.automacao.findMany({
    where: { evento: "renovacao_contrato", ativo: true },
  });
  if (automacoes.length === 0) return;

  const contratos = await prisma.contratoAlocacao.findMany({
    where: { status: { in: ["ativo", "renovado"] }, renovacaoLembreteEm: { lte: new Date() } },
    include: { vaga: true },
  });
  if (contratos.length === 0) return;

  const execucoesExistentes = await prisma.automacaoExecucao.findMany({
    where: {
      automacaoId: { in: automacoes.map((a) => a.id) },
      entidadeId: { in: contratos.map((c) => c.id) },
    },
    select: { automacaoId: true, entidadeId: true },
  });
  const jaExecutado = new Set(execucoesExistentes.map((e) => `${e.automacaoId}:${e.entidadeId}`));

  for (const automacao of automacoes) {
    for (const contrato of contratos) {
      if (jaExecutado.has(`${automacao.id}:${contrato.id}`)) continue;

      const destinatarios = [contrato.vaga.consultorId, contrato.vaga.recrutadorId].filter(
        (id): id is string => !!id,
      );

      if (destinatarios.length === 0) {
        await executarAutomacao(prisma, automacao, {
          entidadeTipo: "contrato",
          entidadeId: contrato.id,
          responsavelId: null,
        });
        continue;
      }

      for (const responsavelId of destinatarios) {
        await executarAutomacao(prisma, automacao, {
          entidadeTipo: "contrato",
          entidadeId: contrato.id,
          responsavelId,
        });
      }
    }
  }
}
