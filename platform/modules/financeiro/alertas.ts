import "server-only";

import { prisma } from "@/lib/prisma";
import { executarAutomacao } from "@/modules/automacoes/engine";

/**
 * Verificações oportunistas de datas do fechamento de vaga — mesmo padrão
 * (sem cron real) de modules/alocacao/renovacao.ts. Rodam a cada
 * carregamento do layout autenticado (ver app/(app)/layout.tsx), pra que o
 * pop-up de alerta (components/notificacoes/alerta-financeiro-dialog.tsx)
 * tenha a melhor chance de aparecer independente de qual página o usuário
 * abrir primeiro.
 */

async function executarParaCada(
  automacoes: { id: string; acao: unknown }[],
  faturamentos: { id: string; origemId: string }[],
  recrutadorPorVaga: Map<string, string | null>,
) {
  if (automacoes.length === 0 || faturamentos.length === 0) return;

  const execucoesExistentes = await prisma.automacaoExecucao.findMany({
    where: {
      automacaoId: { in: automacoes.map((a) => a.id) },
      entidadeId: { in: faturamentos.map((f) => f.id) },
    },
    select: { automacaoId: true, entidadeId: true },
  });
  const jaExecutado = new Set(execucoesExistentes.map((e) => `${e.automacaoId}:${e.entidadeId}`));

  for (const automacao of automacoes) {
    for (const f of faturamentos) {
      if (jaExecutado.has(`${automacao.id}:${f.id}`)) continue;
      await executarAutomacao(prisma, automacao, {
        entidadeTipo: "faturamento",
        entidadeId: f.id,
        responsavelId: recrutadorPorVaga.get(f.origemId) ?? null,
      });
    }
  }
}

async function buscarRecrutadoresDasVagas(vagaIds: string[]) {
  const vagas = await prisma.vaga.findMany({
    where: { id: { in: vagaIds } },
    select: { id: true, recrutadorId: true },
  });
  return new Map(vagas.map((v) => [v.id, v.recrutadorId]));
}

/** NF do fechamento de vaga não emitida até a data prevista. */
export async function verificarNfsPendentes() {
  const automacoes = await prisma.automacao.findMany({ where: { evento: "nf_pendente", ativo: true } });
  if (automacoes.length === 0) return;

  const faturamentos = await prisma.faturamento.findMany({
    where: { origemTipo: "vaga", nfEmitida: false, dataEmissaoNf: { lte: new Date() } },
    select: { id: true, origemId: true },
  });
  if (faturamentos.length === 0) return;

  const recrutadorPorVaga = await buscarRecrutadoresDasVagas(faturamentos.map((f) => f.origemId));
  await executarParaCada(automacoes, faturamentos, recrutadorPorVaga);
}

/** Data de término da alocação do profissional se aproximando. */
export async function verificarVencimentosAlocacao() {
  const automacoes = await prisma.automacao.findMany({ where: { evento: "vencimento_alocacao", ativo: true } });
  if (automacoes.length === 0) return;

  const faturamentos = await prisma.faturamento.findMany({
    where: { origemTipo: "vaga", alocacaoEncerrada: false, dataTerminoAlocacao: { lte: new Date() } },
    select: { id: true, origemId: true },
  });
  if (faturamentos.length === 0) return;

  const recrutadorPorVaga = await buscarRecrutadoresDasVagas(faturamentos.map((f) => f.origemId));
  await executarParaCada(automacoes, faturamentos, recrutadorPorVaga);
}
