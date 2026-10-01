import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Ações de retenção visíveis: RH/Admin todas; gestor as de liderados, da equipe que lidera ou sob sua responsabilidade. */
export function filtroAcoesRetencao(ctx: Contexto, escopo: Escopo): Prisma.AcaoRetencaoWhereInput {
  if (escopo === "todos") return {};
  const eu = ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000";
  return { OR: [{ colaborador: { gestorId: eu } }, { equipe: { gestorId: eu } }, { responsavelId: eu }] };
}

export const STATUS_ACAO_RETENCAO = {
  planejada: { nome: "Planejada", tom: "neutro" },
  em_andamento: { nome: "Em andamento", tom: "info" },
  concluida: { nome: "Concluída", tom: "sucesso" },
  cancelada: { nome: "Cancelada", tom: "neutro" },
} as const;

export const ALCANCE = { individual: "Individual", equipe: "Equipe", organizacao: "Organização" } as const;
