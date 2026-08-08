/**
 * Simulation Engine (Fase 2/Intelligence) — funções puras, sem "server-only"
 * de propósito: o baseline real vem do servidor uma vez (Metrics Engine),
 * e a simulação em si roda no client pra feedback instantâneo (seção 6 do
 * pedido: "o usuário deve conseguir alterar variáveis e visualizar
 * imediatamente o impacto"). Nenhuma função aqui bate no banco.
 */

export type CategoriaNegocio = "alocacao" | "recrutamento" | "executive_search";

// ---------------------------------------------------------------------------
// What-If
// ---------------------------------------------------------------------------

export function simularCrescimentoClientes(
  baseline: { receitaMensalAtual: number; clientesAtivos: number; ticketMedioGeral: number | null },
  percentualAumento: number,
) {
  if (baseline.ticketMedioGeral == null || baseline.clientesAtivos === 0) return null;
  const novosClientes = Math.round(baseline.clientesAtivos * (percentualAumento / 100));
  const receitaAdicional = novosClientes * baseline.ticketMedioGeral;
  return {
    novosClientes,
    clientesProjetados: baseline.clientesAtivos + novosClientes,
    receitaAdicional,
    receitaProjetada: baseline.receitaMensalAtual + receitaAdicional,
  };
}

export function simularAumentoTicket(receitaMensalAtual: number, percentualAumento: number) {
  const fator = 1 + percentualAumento / 100;
  return {
    receitaProjetada: receitaMensalAtual * fator,
    receitaAdicional: receitaMensalAtual * (fator - 1),
  };
}

export function simularAumentoConversao(pipelinePonderadoAtual: number, taxaAtual: number | null, pontosPercentuais: number) {
  if (taxaAtual == null || taxaAtual === 0) return null;
  const novaTaxa = taxaAtual + pontosPercentuais;
  const fator = novaTaxa / taxaAtual;
  return { taxaAtual, novaTaxa, pipelinePonderadoProjetado: pipelinePonderadoAtual * fator };
}

export function simularPerdaCliente(receitaMensalAtual: number, receitaDoCliente: number) {
  return {
    receitaRestante: Math.max(0, receitaMensalAtual - receitaDoCliente),
    impactoPercentual: receitaMensalAtual > 0 ? (receitaDoCliente / receitaMensalAtual) * 100 : 0,
  };
}

export function simularNovosRecrutadores(
  vagasFechadasPorRecrutadorMes: number | null,
  recrutadoresAtuais: number,
  novosRecrutadores: number,
) {
  if (vagasFechadasPorRecrutadorMes == null) return null;
  return {
    capacidadeAtual: vagasFechadasPorRecrutadorMes * recrutadoresAtuais,
    capacidadeAdicional: vagasFechadasPorRecrutadorMes * novosRecrutadores,
    capacidadeProjetada: vagasFechadasPorRecrutadorMes * (recrutadoresAtuais + novosRecrutadores),
  };
}

// ---------------------------------------------------------------------------
// Reverse Planning — "quero faturar R$ X/mês, quanto preciso de cada vertical?"
// ---------------------------------------------------------------------------

const CATEGORIAS: CategoriaNegocio[] = ["alocacao", "recrutamento", "executive_search"];

export type TicketPorVertical = Record<CategoriaNegocio, number | null>;
export type MixVertical = Record<CategoriaNegocio, number>;

export function calcularPlanejamentoReverso(objetivoMensal: number, ticketMedios: TicketPorVertical, mix: MixVertical) {
  const resultado = {} as Record<
    CategoriaNegocio,
    { valorAlvo: number; ticketMedio: number | null; quantidadeNecessaria: number | null }
  >;

  for (const categoria of CATEGORIAS) {
    const valorAlvo = objetivoMensal * (mix[categoria] / 100);
    const ticketMedio = ticketMedios[categoria];
    resultado[categoria] = {
      valorAlvo,
      ticketMedio,
      quantidadeNecessaria: ticketMedio && ticketMedio > 0 ? Math.ceil(valorAlvo / ticketMedio) : null,
    };
  }

  return resultado;
}

/** Mix padrão — proporcional à receita histórica de cada vertical. Se uma
 * vertical não tem receita histórica ainda, cai pra divisão igual entre as
 * que têm dado (nunca inventa peso pra uma vertical sem nenhum fechamento). */
export function mixPadraoPorReceitaHistorica(receitaPorVertical: Record<CategoriaNegocio, number> | null): MixVertical {
  if (!receitaPorVertical) return { alocacao: 100 / 3, recrutamento: 100 / 3, executive_search: 100 / 3 };

  const total = CATEGORIAS.reduce((acc, c) => acc + receitaPorVertical[c], 0);
  if (total === 0) return { alocacao: 100 / 3, recrutamento: 100 / 3, executive_search: 100 / 3 };

  return {
    alocacao: (receitaPorVertical.alocacao / total) * 100,
    recrutamento: (receitaPorVertical.recrutamento / total) * 100,
    executive_search: (receitaPorVertical.executive_search / total) * 100,
  };
}
