/**
 * PDI — regra ÚNICA de progresso e status (lista, Kanban, dashboard, detalhe,
 * painel, exportação). Pura: servidor e cliente.
 *
 *  Ação:  concluída = 100 · em andamento = progresso explícito (1–99) ou 50 · não iniciada = 0
 *  Foco:  média das ações (foco sem ações = 0 e deixa o plano "incompleto")
 *  PDI:   média dos focos (sem focos = 0, "incompleto")
 *  Status: concluído  → há focos, todo foco tem ação e todas as ações concluídas
 *          em risco   → alguma ação não concluída com prazo anterior a hoje
 *          em andamento → demais casos
 * O banco (jl_normalizar_acao_pdi) mantém status e progresso da ação coerentes.
 */

export type StatusAcao = "nao_iniciada" | "em_andamento" | "concluida";
export type StatusPdiCalculado = "em_risco" | "em_andamento" | "concluido";

type AcaoCalc = { status: StatusAcao | string; progresso?: number | null; prazo?: Date | null };
type FocoCalc<A extends AcaoCalc = AcaoCalc> = { acoes: A[] };

export function progressoAcao(a: AcaoCalc) {
  if (a.status === "concluida") return 100;
  if (a.status === "em_andamento") return a.progresso && a.progresso >= 1 && a.progresso <= 99 ? a.progresso : 50;
  return 0;
}

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Ação vencida: não concluída e prazo anterior a hoje (datas civis, 00:00 UTC). */
export const acaoVencida = (a: AcaoCalc, hoje: Date) => a.status !== "concluida" && !!a.prazo && a.prazo < hoje;

export function calcularFoco(f: FocoCalc) {
  return { progresso: Math.round(media(f.acoes.map(progressoAcao))), vazio: f.acoes.length === 0 };
}

export function calcularPdi<A extends AcaoCalc>(focos: FocoCalc<A>[], hoje: Date) {
  const acoes = focos.flatMap((f) => f.acoes);
  const progresso = Math.round(media(focos.map((f) => media(f.acoes.map(progressoAcao)))));
  const incompleto = focos.length === 0 || focos.some((f) => f.acoes.length === 0);
  const vencidas = acoes.filter((a) => acaoVencida(a, hoje));
  const concluido = !incompleto && acoes.every((a) => a.status === "concluida");
  const status: StatusPdiCalculado = concluido ? "concluido" : vencidas.length ? "em_risco" : "em_andamento";
  const porStatus = { nao_iniciada: 0, em_andamento: 0, concluida: 0 } as Record<StatusAcao, number>;
  for (const a of acoes) porStatus[a.status as StatusAcao] = (porStatus[a.status as StatusAcao] ?? 0) + 1;
  return { progresso: concluido ? 100 : Math.min(progresso, 99), status, incompleto, vencidas: vencidas.length, totalAcoes: acoes.length, porStatus };
}

/** Ordem do Kanban e das listas: em risco → em andamento → concluído. */
export const STATUS_PDI: Record<StatusPdiCalculado, { nome: string; tom: "perigo" | "alerta" | "sucesso"; ordem: number }> = {
  em_risco: { nome: "Em risco", tom: "perigo", ordem: 0 },
  em_andamento: { nome: "Em andamento", tom: "alerta", ordem: 1 },
  concluido: { nome: "Concluído", tom: "sucesso", ordem: 2 },
};

export const STATUS_ACAO: Record<StatusAcao, { nome: string; tom: "neutro" | "info" | "sucesso" }> = {
  nao_iniciada: { nome: "Não iniciada", tom: "neutro" },
  em_andamento: { nome: "Em andamento", tom: "info" },
  concluida: { nome: "Concluída", tom: "sucesso" },
};

export const TIPO_ACAO = { treinamento: "Treinamento", mentoria: "Mentoria", leitura: "Leitura", projeto_pratico: "Projeto prático" } as const;
export type TipoAcao = keyof typeof TIPO_ACAO;

export const RESPONSAVEL_ACAO = { colaborador: "Colaborador", gestor: "Gestor", ambos: "Colaborador e gestor" } as const;
export type ResponsavelAcao = keyof typeof RESPONSAVEL_ACAO;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** Valor em reais no formato pt-BR (R$ 1.234,56). */
export const formatarBRL = (v: number | string | { toString(): string } | null | undefined) => (v === null || v === undefined || v === "" ? "—" : BRL.format(Number(v.toString())));
