/**
 * Regras de cálculo do Onboarding — funções puras, usadas pelo servidor (fonte
 * de verdade ao gravar) e pelas telas (exibição). Datas: colunas `date` como
 * Date 00:00 UTC e "hoje" de lib/datas.ts (sem deslocamento de fuso).
 */
import { diasEntre, somarDias } from "@/lib/datas";

export type StatusTarefa = "nao_iniciada" | "em_andamento" | "bloqueada" | "concluida" | "dispensada";
export type StatusOnboarding = "em_andamento" | "concluido" | "cancelado";
export type Situacao = "nao_iniciado" | "em_andamento" | "concluido" | "cancelado";

export const PENDENTES: readonly StatusTarefa[] = ["nao_iniciada", "em_andamento", "bloqueada"];
export const ehPendente = (s: StatusTarefa) => PENDENTES.includes(s);

export const STATUS_TAREFA: Record<StatusTarefa, { nome: string; tom: "neutro" | "info" | "perigo" | "sucesso" }> = {
  nao_iniciada: { nome: "Não iniciada", tom: "neutro" },
  em_andamento: { nome: "Em andamento", tom: "info" },
  bloqueada: { nome: "Bloqueada", tom: "perigo" },
  concluida: { nome: "Concluída", tom: "sucesso" },
  dispensada: { nome: "Dispensada", tom: "neutro" },
};
/** Colunas do Kanban de tarefas (dispensadas ficam fora do quadro). */
export const COLUNAS_KANBAN: StatusTarefa[] = ["nao_iniciada", "em_andamento", "bloqueada", "concluida"];

export const SITUACAO: Record<Situacao, { nome: string; tom: "neutro" | "info" | "sucesso" }> = {
  nao_iniciado: { nome: "Não iniciado", tom: "neutro" },
  em_andamento: { nome: "Em andamento", tom: "info" },
  concluido: { nome: "Concluído", tom: "sucesso" },
  cancelado: { nome: "Cancelado", tom: "neutro" },
};

/**
 * Situação exibida. "Não iniciado" não é gravado: é um onboarding em andamento
 * cuja data de início ainda não chegou — muda sozinho quando a data chega.
 */
export function situacao(o: { status: StatusOnboarding; inicio: Date }, hoje: Date): Situacao {
  if (o.status !== "em_andamento") return o.status;
  return o.inicio > hoje ? "nao_iniciado" : "em_andamento";
}

/**
 * Progresso = concluídas ÷ consideradas × 100, arredondado. Consideradas = todas
 * menos as dispensadas. Bloqueada continua pendente (não soma). Sem tarefas
 * consideradas: 0%.
 */
export function calcularProgresso(tarefas: { status: StatusTarefa }[]) {
  const consideradas = tarefas.filter((t) => t.status !== "dispensada");
  if (!consideradas.length) return 0;
  return Math.round((consideradas.filter((t) => t.status === "concluida").length / consideradas.length) * 100);
}

/** Concluído automaticamente quando existe ao menos uma tarefa obrigatória e todas estão concluídas. */
export function obrigatoriasConcluidas(tarefas: { status: StatusTarefa; obrigatoria: boolean }[]) {
  const obrig = tarefas.filter((t) => t.obrigatoria && t.status !== "dispensada");
  return obrig.length > 0 && obrig.every((t) => t.status === "concluida");
}

/** Prazo da tarefa: específico (quando definido) ou início + deslocamento; sem deslocamento, o marco da fase. */
export function prazoCalculado(inicio: Date, prazoDias: number | null, marcoFase: number) {
  return somarDias(inicio, prazoDias ?? marcoFase);
}

export type Sinais = { atrasada: boolean; venceHoje: boolean; proxima: boolean; bloqueada: boolean };

/** Alertas de uma tarefa pendente: atrasada, vence hoje, vence em até 3 dias, bloqueada. */
export function sinais(t: { status: StatusTarefa; prazo: Date }, hoje: Date): Sinais {
  if (!ehPendente(t.status)) return { atrasada: false, venceHoje: false, proxima: false, bloqueada: false };
  const d = diasEntre(hoje, t.prazo);
  return { atrasada: d < 0, venceHoje: d === 0, proxima: d >= 1 && d <= 3, bloqueada: t.status === "bloqueada" };
}

/** Dia do onboarding (1 = dia do início); negativo/zero = antes do início. */
export function diaDoOnboarding(inicio: Date, hoje: Date) {
  return diasEntre(inicio, hoje) + 1;
}

/** Fase atual pelo calendário: a primeira cujo marco ainda não passou. Antes do início: null. */
export function faseAtual<F extends { marcoDias: number; ordem: number }>(fases: F[], inicio: Date, hoje: Date): F | null {
  const dia = diaDoOnboarding(inicio, hoje);
  if (dia < 1 || !fases.length) return null;
  const ordenadas = [...fases].sort((a, b) => a.ordem - b.ordem);
  return ordenadas.find((f) => f.marcoDias >= dia) ?? ordenadas[ordenadas.length - 1];
}

/**
 * Ritmo: tarefas que já deveriam estar concluídas (prazo até hoje) × concluídas.
 * Previsão de conclusão no ritmo atual: extrapola a média de tarefas por dia
 * desde o início — é uma estimativa deste onboarding, não uma projeção anual.
 */
export function ritmo(tarefas: { status: StatusTarefa; prazo: Date }[], inicio: Date, hoje: Date) {
  const consideradas = tarefas.filter((t) => t.status !== "dispensada");
  const concluidas = consideradas.filter((t) => t.status === "concluida").length;
  const esperadas = consideradas.filter((t) => t.prazo <= hoje).length;
  const diferenca = concluidas - esperadas;
  const dias = diaDoOnboarding(inicio, hoje);
  let previsao: Date | null = null;
  const restantes = consideradas.length - concluidas;
  if (dias >= 1 && concluidas > 0 && restantes > 0) previsao = somarDias(hoje, Math.ceil(restantes / (concluidas / dias)));
  return {
    concluidas,
    esperadas,
    total: consideradas.length,
    diferenca,
    estado: esperadas === 0 && concluidas === 0 ? ("inicio" as const) : diferenca >= 0 ? ("em_dia" as const) : ("atras" as const),
    previsao,
  };
}

export const RESPONSAVEL = { rh: "RH", gestor: "Gestor", colaborador: "Colaborador" } as const;
export const TIPO_TAREFA = { tarefa: "Tarefa", documento: "Documento", material: "Material" } as const;
