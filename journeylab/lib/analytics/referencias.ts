import { z } from "zod";

/**
 * Referências para o comparativo de People Analytics. São PONTOS DE PARTIDA
 * editáveis por organização (Configurações de People Analytics) — não são dados
 * oficiais. O ideal é substituí-los pelo benchmark do setor/porte da empresa
 * (pesquisas salariais, consultorias, associações setoriais).
 *
 * `menorMelhor` define o sentido da comparação; `unidade` só formata.
 */
export const REFERENCIAS = {
  turnoverAnual: { nome: "Turnover anual (todas as saídas)", unidade: "%", padrao: 30, menorMelhor: true, ajuda: "Saídas em 12 meses ÷ headcount médio." },
  turnoverVoluntarioAnual: { nome: "Turnover voluntário anual", unidade: "%", padrao: 15, menorMelhor: true, ajuda: "Saídas por iniciativa do colaborador em 12 meses." },
  saidaPrecoce: { nome: "Saídas com menos de 90 dias", unidade: "% das saídas", padrao: 15, menorMelhor: true, ajuda: "Indica problemas de atração, seleção ou integração." },
  retencao12m: { nome: "Retenção em 12 meses", unidade: "%", padrao: 80, menorMelhor: false, ajuda: "Das pessoas ativas há 12 meses, quantas seguem na empresa." },
  timeToFill: { nome: "Tempo para preencher vaga", unidade: "dias", padrao: 40, menorMelhor: true, ajuda: "Da abertura ao encerramento da vaga." },
  coberturaFeedback: { nome: "Cobertura de feedback (90 dias)", unidade: "%", padrao: 80, menorMelhor: false, ajuda: "Pessoas ativas com feedback registrado nos últimos 90 dias." },
  onboardingNoPrazo: { nome: "Onboardings concluídos no prazo", unidade: "%", padrao: 85, menorMelhor: false, ajuda: "Concluídos até o último marco do plano." },
  coberturaPdi: { nome: "Pessoas com PDI ativo", unidade: "%", padrao: 60, menorMelhor: false, ajuda: "Ativos com plano de desenvolvimento em andamento." },
  adesaoPulse: { nome: "Adesão às pesquisas Pulse", unidade: "%", padrao: 70, menorMelhor: false, ajuda: "Média de respondentes ÷ público das pesquisas." },
  enps: { nome: "eNPS de clima (Pulse)", unidade: "pts", padrao: 30, menorMelhor: false, ajuda: "Escala de −100 a 100." },
  enpsSaida: { nome: "eNPS de saída (Offboarding)", unidade: "pts", padrao: 0, menorMelhor: false, ajuda: "Recomendação da empresa por quem saiu." },
} as const;

export type ChaveReferencia = keyof typeof REFERENCIAS;
export const CHAVES_REFERENCIA = Object.keys(REFERENCIAS) as ChaveReferencia[];

/** Premissas de custo (opcionais) — sem elas, o custo do turnover não é estimado. */
export const configSchema = z.object({
  valores: z.partialRecord(z.enum(CHAVES_REFERENCIA as [ChaveReferencia, ...ChaveReferencia[]]), z.number().min(-100).max(1000).nullable()).default({}),
  salarioMedioMensal: z.number().min(0).max(1_000_000).nullable().default(null),
  /** Custo de reposição por saída, em salários mensais (recrutamento, integração, produtividade perdida). */
  mesesCustoReposicao: z.number().min(0).max(36).nullable().default(null),
  setor: z.string().trim().max(80).nullable().default(null),
  fonte: z.string().trim().max(200).nullable().default(null),
});
export type ConfigAnalytics = z.infer<typeof configSchema>;

/** Tolerante: configuração inválida/antiga volta ao padrão. */
export function lerConfig(json: unknown): ConfigAnalytics {
  const r = configSchema.safeParse(json ?? {});
  return r.success ? r.data : configSchema.parse({});
}

export function valorReferencia(c: ConfigAnalytics, chave: ChaveReferencia) {
  const v = c.valores[chave];
  return v === null || v === undefined ? REFERENCIAS[chave].padrao : v;
}

/** Leitura da comparação: melhor, em linha (±10% da referência) ou pior. */
export function compararReferencia(chave: ChaveReferencia, valor: number | null, ref: number) {
  if (valor === null) return null;
  const tolerancia = Math.max(Math.abs(ref) * 0.1, chave === "enps" || chave === "enpsSaida" ? 5 : 1);
  const diff = valor - ref;
  if (Math.abs(diff) <= tolerancia) return { leitura: "em_linha" as const, diff };
  const melhor = REFERENCIAS[chave].menorMelhor ? diff < 0 : diff > 0;
  return { leitura: melhor ? ("melhor" as const) : ("pior" as const), diff };
}
