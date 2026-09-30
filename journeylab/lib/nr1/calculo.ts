/**
 * Diagnóstico NR-1 — apresentação dos scores (puro: servidor e cliente).
 *
 * O CÁLCULO acontece no banco (jl_fatores_nr1, rls.sql): média do valor
 * ajustado por fator (item reverso = 6 − valor), score = round(((média − 1) / 4) × 100).
 * Maior score = maior frequência de exposição ao fator. Itens sem resposta não
 * entram (não viram nota 1). Fator com menos respondentes que o mínimo fica oculto.
 *
 * As faixas e a matriz são CRITÉRIOS INTERNOS DO PRODUTO, configuráveis por
 * diagnóstico — não são classificação oficial da NR-1 nem avaliação técnica do GRO/PGR.
 */

export const FAIXAS_PADRAO = [20, 40, 60, 80];

export const NOMES_FAIXA = [
  { nome: "Exposição muito baixa", tom: "sucesso" },
  { nome: "Exposição baixa", tom: "sucesso" },
  { nome: "Atenção", tom: "alerta" },
  { nome: "Exposição elevada", tom: "perigo" },
  { nome: "Exposição muito elevada", tom: "perigo" },
] as const;

/** Índice 0–4 da faixa do score (limites superiores inclusivos: ≤20, ≤40, ≤60, ≤80, >80). */
export function indiceFaixa(score: number, faixas: number[] = FAIXAS_PADRAO) {
  const lim = faixas.length === 4 ? faixas : FAIXAS_PADRAO;
  const i = lim.findIndex((l) => score <= l);
  return i === -1 ? 4 : i;
}

export function faixaDe(score: number, faixas?: number[]) {
  return { indice: indiceFaixa(score, faixas), ...NOMES_FAIXA[indiceFaixa(score, faixas)] };
}

/** Rótulos dos intervalos para a legenda da metodologia. */
export function intervalosFaixas(faixas: number[] = FAIXAS_PADRAO) {
  const lim = faixas.length === 4 ? faixas : FAIXAS_PADRAO;
  const ini = [0, ...lim.map((l) => l + 1)];
  const fim = [...lim, 100];
  return NOMES_FAIXA.map((f, i) => ({ ...f, de: ini[i], ate: fim[i] }));
}

export const SEVERIDADE = { 1: "Moderada", 2: "Alta", 3: "Muito alta" } as const;

/**
 * Matriz indicativa: exposição (faixa 1–5) × severidade de referência (1–3).
 * Nível = faixa + severidade (2–8), agrupado em Baixo / Moderado / Alto / Crítico.
 */
export function nivelMatriz(indiceFaixa0a4: number, severidade: number) {
  const n = indiceFaixa0a4 + 1 + severidade;
  if (n >= 7) return { nome: "Prioridade crítica", tom: "perigo" as const, n };
  if (n >= 6) return { nome: "Prioridade alta", tom: "perigo" as const, n };
  if (n >= 4) return { nome: "Prioridade moderada", tom: "alerta" as const, n };
  return { nome: "Prioridade baixa", tom: "sucesso" as const, n };
}

/** Score indicativo geral: média simples dos scores dos fatores exibidos. */
export function scoreGeral(scores: (number | null)[]) {
  const v = scores.filter((s): s is number => s !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

export const MOTIVO_OCULTO: Record<string, string> = {
  aberta: "Resultados disponíveis após o encerramento da pesquisa.",
  minimo: "Dados insuficientes para exibição segura.",
  complemento: "Dados insuficientes para exibição segura (o restante do grupo ficaria pequeno demais).",
  audiencia_pequena: "Recortes por departamento indisponíveis: o público da pesquisa é pequeno demais para exibição segura.",
  sem_departamento: "Esta pesquisa não coletou departamento.",
  sem_permissao: "Você não tem acesso a este recorte.",
};

export const LIMITACOES =
  "Scores indicativos de uma pesquisa de percepção: apoiam a identificação de fatores de risco psicossociais relacionados ao trabalho, " +
  "mas não são laudo técnico, diagnóstico clínico, certificação nem prova de conformidade com a NR-1. A avaliação e o gerenciamento dos riscos " +
  "(GRO/PGR) devem ser conduzidos pelos profissionais responsáveis, considerando também outras fontes sobre as condições e a organização do trabalho.";
