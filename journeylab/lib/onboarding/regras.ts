import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import { hoje } from "@/lib/datas";
import { NENHUM } from "@/lib/escopo";

export { RESPONSAVEL, TIPO_TAREFA } from "./calculo";

/**
 * Quais onboardings o papel enxerga (a organização já é garantida pelo RLS):
 *  todos  → todos (RH/Admin)
 *  equipe → os dos subordinados diretos (colaborador.gestorId = eu)
 * Colaborador não acessa o módulo nesta versão (escopo mínimo em lib/contexto.ts).
 */
export function filtroOnboardings(ctx: Contexto, escopo: Escopo): Prisma.OnboardingWhereInput {
  if (escopo === "todos") return {};
  if (escopo === "equipe" && ctx.colaboradorId) return { colaborador: { gestorId: ctx.colaboradorId } };
  return { id: NENHUM };
}

/**
 * Quem atualiza uma tarefa (iniciar, bloquear, concluir…), sempre com a ação
 * "concluir": escopo "todos" (RH/Admin) atualiza qualquer uma; o gestor atualiza
 * as de gestor e de colaborador dos seus subordinados (tarefas de colaborador
 * são acompanhadas por gestor/RH — o colaborador não acessa). Tarefas de RH
 * exigem "todos".
 */
export function podeAtualizarTarefa(escopoConcluir: Escopo | null, tarefa: { responsavelTipo: string }) {
  if (!escopoConcluir || escopoConcluir === "proprio") return false;
  if (escopoConcluir === "todos") return true;
  return tarefa.responsavelTipo !== "rh";
}

/** Hoje como data civil (00:00 UTC) — comparável com colunas `date`. Ver lib/datas.ts. */
export function hojeSemHora() {
  return hoje();
}

export const FILTRO_SITUACAO = { nao_iniciado: "Não iniciados", em_andamento: "Em andamento", concluido: "Concluídos", cancelado: "Cancelados" } as const;

/** Filtro por situação exibida (usa a mesma regra de lib/onboarding/calculo.ts#situacao). Vazio = todos menos cancelados. */
export function filtroSituacao(s: keyof typeof FILTRO_SITUACAO | undefined, h = hoje()): Prisma.OnboardingWhereInput {
  if (s === "nao_iniciado") return { status: "em_andamento", inicio: { gt: h } };
  if (s === "em_andamento") return { status: "em_andamento", inicio: { lte: h } };
  if (s === "concluido" || s === "cancelado") return { status: s };
  return { status: { not: "cancelado" } };
}
