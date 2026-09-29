import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";

const NENHUM = "00000000-0000-0000-0000-000000000000";

/**
 * Quais onboardings o papel enxerga:
 *  todos  → todos
 *  equipe → pessoas geridas diretamente + o próprio
 *  próprio→ só o próprio
 */
export function filtroOnboardings(ctx: Contexto, escopo: Escopo): Prisma.OnboardingWhereInput {
  if (escopo === "todos") return {};
  const eu = ctx.colaboradorId ?? NENHUM;
  if (escopo === "equipe") return { OR: [{ colaboradorId: eu }, { colaborador: { gestorId: eu } }, { tarefas: { some: { responsavelId: eu } } }] };
  return { OR: [{ colaboradorId: eu }, { tarefas: { some: { responsavelId: eu } } }] };
}

/**
 * Quem pode concluir uma tarefa: escopo "todos" (RH/admin) conclui qualquer
 * uma; os demais concluem apenas tarefas das quais são o responsável
 * resolvido (gestor direto ou a própria pessoa). Tarefas de RH exigem "todos".
 */
export function podeConcluirTarefa(
  ctx: Contexto,
  escopoConcluir: Escopo | null,
  tarefa: { responsavelTipo: string; responsavelId: string | null },
) {
  if (!escopoConcluir) return false;
  if (escopoConcluir === "todos") return true;
  if (tarefa.responsavelTipo === "rh") return false;
  return !!ctx.colaboradorId && tarefa.responsavelId === ctx.colaboradorId;
}

export function hojeSemHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const RESPONSAVEL = { rh: "RH", gestor: "Gestor", colaborador: "Novo colaborador" } as const;
export const TIPO_TAREFA = { tarefa: "Tarefa", documento: "Documento", material: "Material" } as const;
