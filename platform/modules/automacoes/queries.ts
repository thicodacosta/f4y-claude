import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_AUTOMACOES } from "@/lib/roles";

export async function getAutomacoes() {
  await requirePapel(PAPEIS_AUTOMACOES);

  const automacoes = await prisma.automacao.findMany({
    include: {
      pipelineEtapa: { include: { pipeline: true } },
      _count: { select: { execucoes: true } },
    },
    orderBy: { criadoEm: "asc" },
  });

  return automacoes.map((a) => ({
    id: a.id,
    nome: a.nome,
    evento: a.evento,
    etapaNome: a.pipelineEtapa
      ? `${a.pipelineEtapa.pipeline.tipo === "comercial" ? "Pipeline Comercial" : "Pipeline de Vagas"} — ${a.pipelineEtapa.nome}`
      : null,
    acao: a.acao as { tipo: string; params?: Record<string, unknown> },
    ativo: a.ativo,
    totalExecucoes: a._count.execucoes,
  }));
}

export async function getExecucoesRecentes(limit = 20) {
  await requirePapel(PAPEIS_AUTOMACOES);

  const execucoes = await prisma.automacaoExecucao.findMany({
    include: { automacao: true },
    orderBy: { executadoEm: "desc" },
    take: limit,
  });

  return execucoes.map((e) => ({
    id: e.id,
    automacaoNome: e.automacao.nome,
    entidadeTipo: e.entidadeTipo,
    entidadeId: e.entidadeId,
    resultado: e.resultado,
    erro: e.erro,
    executadoEm: e.executadoEm.toISOString(),
  }));
}
