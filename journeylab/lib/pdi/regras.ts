import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { NENHUM } from "@/lib/escopo";
import { hoje } from "@/lib/datas";
import { calcularPdi } from "./calculo";

/**
 * PDIs visíveis (mesma regra de jl_acesso_pdi no banco):
 *  todos  (RH/Admin) → qualquer pessoa da organização
 *  equipe (gestor)   → só liderados diretos (não o próprio PDI)
 * Colaborador não acessa o módulo nesta versão (escopo mínimo em lib/contexto.ts).
 */
export function filtroPdis(ctx: Contexto, escopo: Escopo | null): Prisma.PdiWhereInput {
  if (escopo === "todos") return {};
  if (escopo === "equipe") return { colaborador: { gestorId: ctx.colaboradorId ?? NENHUM, id: { not: ctx.colaboradorId ?? NENHUM } } };
  return { id: NENHUM };
}

/** Pessoas para quem o usuário pode criar/gerir PDI. */
export function filtroPessoasPdi(ctx: Contexto, escopo: Escopo | null): Prisma.ColaboradorWhereInput {
  if (escopo === "todos") return {};
  if (escopo === "equipe") return { gestorId: ctx.colaboradorId ?? NENHUM, id: { not: ctx.colaboradorId ?? NENHUM } };
  return { id: NENHUM };
}

export function cobrePdi(ctx: Contexto, escopo: Escopo | null, pessoa: { id: string; gestorId: string | null }) {
  if (escopo === "todos") return true;
  return escopo === "equipe" && !!ctx.colaboradorId && pessoa.gestorId === ctx.colaboradorId && pessoa.id !== ctx.colaboradorId;
}

/** Inclusão padrão para calcular progresso/status (focos → ações em ordem). */
export const COM_ACOES = {
  focos: { orderBy: { ordem: "asc" }, include: { acoes: { orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] } } },
} satisfies Prisma.PdiInclude;

/** PDI mais recente ainda não concluído da pessoa (destino de compromissos de 1:1). */
export async function pdiEmAberto(tx: Tx, colaboradorId: string) {
  const pdis = await tx.pdi.findMany({ where: { colaboradorId }, include: COM_ACOES, orderBy: { criadoEm: "desc" }, take: 10 });
  const h = hoje();
  return pdis.find((p) => calcularPdi(p.focos, h).status !== "concluido") ?? null;
}
