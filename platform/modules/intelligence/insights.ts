/**
 * Geração de insights em linguagem natural — Fase 1 é rule-based (sem LLM),
 * consumindo só as métricas já buscadas pela página (não bate no banco).
 * O AI Business Advisor (Fase 2+) troca essas regras por uma consulta real
 * às funções de modules/intelligence/metrics.ts via @anthropic-ai/sdk,
 * mantendo a mesma garantia: nunca responde com número inventado.
 */

const VERTICAL_LABEL: Record<string, string> = {
  alocacao: "Alocação de Profissionais",
  recrutamento: "Recrutamento & Seleção",
  executive_search: "Executive Search",
};

export function gerarInsightsCeo(input: {
  crescimentoMoM: number | null;
  concentracao: { percentual: number; topN: number } | null;
  utilizacaoCapacidade: number | null;
  receitaPorVertical: Record<string, number> | null;
  alertaCritico: { titulo: string; descricao: string } | null;
}): string[] {
  const insights: string[] = [];

  if (input.crescimentoMoM != null) {
    const sinal = input.crescimentoMoM >= 0 ? "cresceu" : "caiu";
    insights.push(`A receita ${sinal} ${Math.abs(input.crescimentoMoM).toFixed(0)}% em relação ao mês anterior.`);
  }

  if (input.concentracao && input.concentracao.percentual >= 40) {
    insights.push(
      `Os ${input.concentracao.topN} maiores clientes representam ${input.concentracao.percentual.toFixed(0)}% da receita — dependência acima do recomendado.`,
    );
  }

  if (input.utilizacaoCapacidade != null) {
    if (input.utilizacaoCapacidade >= 85) {
      insights.push(`Capacidade de Alocação em ${input.utilizacaoCapacidade.toFixed(0)}% — próxima do limite contratado.`);
    } else if (input.utilizacaoCapacidade <= 50) {
      insights.push(`Capacidade de Alocação em apenas ${input.utilizacaoCapacidade.toFixed(0)}% — há espaço para novas alocações.`);
    }
  }

  if (input.receitaPorVertical) {
    const entradas = Object.entries(input.receitaPorVertical).filter(([, v]) => v > 0);
    if (entradas.length > 0) {
      const [melhorVertical] = [...entradas].sort((a, b) => b[1] - a[1]);
      const label = VERTICAL_LABEL[melhorVertical[0]] ?? melhorVertical[0];
      insights.push(`${label} é a vertical com maior receita acumulada até agora.`);
    }
  }

  if (input.alertaCritico) {
    insights.push(`${input.alertaCritico.titulo}: ${input.alertaCritico.descricao}`);
  }

  return insights;
}
