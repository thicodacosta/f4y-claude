import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";
import { getAlertasExecutivos } from "@/modules/dashboard/queries";
import { getConcentracaoReceita } from "@/modules/intelligence/metrics";

export type Severidade = "critico" | "alto" | "medio" | "baixo";

export type AlertaIntelligence = {
  id: string;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  link?: string;
};

const ORDEM_SEVERIDADE: Record<Severidade, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };

/** Central de alertas do Find4You Intelligence — não inventa regra nova de
 * negócio, só consolida sinais que já existem espalhados (vagas atrasadas,
 * contrato de alocação vencendo, NF pendente) mais um sinal novo
 * (concentração de receita) numa lista única, priorizada. Regras simples e
 * explicáveis (rule-based), nada de ML — ver regra 44 do pedido. */
export async function getAlertasInteligentes(): Promise<AlertaIntelligence[]> {
  await requirePapel(PAPEIS_GESTAO);

  const [executivos, concentracao, contratosVencendo, nfPendentes] = await Promise.all([
    getAlertasExecutivos(),
    getConcentracaoReceita(5),
    prisma.contratoAlocacao.findMany({
      where: { status: { in: ["ativo", "renovado"] }, dataFim: { lte: new Date(Date.now() + 30 * 86_400_000) } },
      include: { vaga: { include: { empresa: true } } },
      orderBy: { dataFim: "asc" },
    }),
    prisma.faturamento.findMany({
      where: { origemTipo: "vaga", nfEmitida: false, dataEmissaoNf: { lte: new Date() } },
      include: { empresa: true },
    }),
  ]);

  const alertas: AlertaIntelligence[] = [];

  for (const v of executivos.semFecharHaMuitoTempo) {
    alertas.push({
      id: `vaga-atrasada-${v.id}`,
      severidade: "alto",
      titulo: "Vaga acima do prazo esperado",
      descricao: `${v.cargo} (${v.empresaNome}) aberta há ${v.diasAberta} dias sem preencher todas as posições.`,
      link: `/vagas/${v.id}`,
    });
  }

  for (const v of executivos.semSourcing) {
    alertas.push({
      id: `vaga-sem-sourcing-${v.id}`,
      severidade: "medio",
      titulo: "Vaga sem candidatos",
      descricao: `${v.cargo} (${v.empresaNome}) sem nenhum candidato há ${v.diasAberta} dias.`,
      link: `/vagas/${v.id}`,
    });
  }

  for (const c of contratosVencendo) {
    const diasRestantes = Math.ceil((c.dataFim.getTime() - Date.now()) / 86_400_000);
    alertas.push({
      id: `contrato-vencendo-${c.id}`,
      severidade: diasRestantes <= 7 ? "critico" : "alto",
      titulo: "Contrato de alocação vencendo",
      descricao: `${c.vaga.cargo} (${c.vaga.empresa.nome}) vence em ${diasRestantes} dia(s).`,
      link: `/vagas/${c.vagaId}`,
    });
  }

  for (const f of nfPendentes) {
    alertas.push({
      id: `nf-pendente-${f.id}`,
      severidade: "medio",
      titulo: "NF pendente de emissão",
      descricao: `${f.empresa.nome} — faturamento aguardando emissão de NF.`,
      link: "/financeiro",
    });
  }

  if (concentracao && concentracao.percentual >= 40) {
    alertas.push({
      id: "concentracao-receita",
      severidade: concentracao.percentual >= 60 ? "critico" : "alto",
      titulo: "Alta concentração de receita",
      descricao: `Top ${concentracao.topN} clientes representam ${concentracao.percentual.toFixed(0)}% da receita faturada.`,
      link: "/intelligence",
    });
  }

  return alertas.sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade]);
}
