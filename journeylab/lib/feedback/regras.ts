import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import { NENHUM } from "@/lib/escopo";

/**
 * Reuniões visíveis (metadados, pauta, compromissos — nunca anotações, que
 * seguem a policy do banco):
 *  todos  → todas
 *  equipe → as que participo + as dos meus liderados diretos
 *  próprio→ as que participo
 */
export function filtroReunioes(ctx: Contexto, escopo: Escopo): Prisma.ReuniaoWhereInput {
  if (escopo === "todos") return {};
  const eu = ctx.colaboradorId ?? NENHUM;
  const minhas: Prisma.ReuniaoWhereInput[] = [{ gestorId: eu }, { colaboradorId: eu }];
  if (escopo === "equipe") minhas.push({ colaborador: { gestorId: eu } });
  return { OR: minhas };
}

export function participa(ctx: Contexto, r: { gestorId: string; colaboradorId: string }) {
  return !!ctx.colaboradorId && (r.gestorId === ctx.colaboradorId || r.colaboradorId === ctx.colaboradorId);
}

/** Editar a reunião (pauta, data, realizada/cancelada, compromissos): gestor participante com "editar", ou escopo "todos". */
export function podeEditarReuniao(ctx: Contexto, escopoEditar: Escopo | null, r: { gestorId: string; colaboradorId: string }) {
  if (!escopoEditar || ctx.suporte) return false;
  if (escopoEditar === "todos") return true;
  if (escopoEditar === "equipe") return !!ctx.colaboradorId && r.gestorId === ctx.colaboradorId;
  return false;
}

/** Concluir compromisso: o responsável, o gestor da reunião, ou escopo "todos" — sempre com "concluir". */
export function podeConcluirCompromisso(
  ctx: Contexto,
  escopoConcluir: Escopo | null,
  c: { responsavelId: string },
  r: { gestorId: string },
) {
  if (!escopoConcluir || ctx.suporte) return false;
  if (escopoConcluir === "todos") return true;
  const eu = ctx.colaboradorId;
  if (!eu) return false;
  if (c.responsavelId === eu) return true;
  return escopoConcluir === "equipe" && r.gestorId === eu;
}

export const STATUS_REUNIAO = {
  agendada: { nome: "Agendada", tom: "info" },
  realizada: { nome: "Realizada", tom: "sucesso" },
  cancelada: { nome: "Cancelada", tom: "neutro" },
} as const;

export const STATUS_COMPROMISSO = {
  aberto: { nome: "Aberto", tom: "alerta" },
  concluido: { nome: "Concluído", tom: "sucesso" },
  cancelado: { nome: "Cancelado", tom: "neutro" },
} as const;
