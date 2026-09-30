import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import { NENHUM } from "@/lib/escopo";

/**
 * Reuniões visíveis (metadados, pauta, compromissos — nunca anotações, que
 * seguem a policy do banco):
 *  todos  → todas (RH/Admin)
 *  equipe → as dos subordinados diretos (e as que o gestor conduz)
 * Colaborador não acessa o módulo nesta versão (escopo mínimo em lib/contexto.ts).
 */
export function filtroReunioes(ctx: Contexto, escopo: Escopo): Prisma.ReuniaoWhereInput {
  if (escopo === "todos") return {};
  if (escopo !== "equipe" || !ctx.colaboradorId) return { id: NENHUM };
  const eu = ctx.colaboradorId;
  return { OR: [{ gestorId: eu }, { colaborador: { gestorId: eu } }] };
}

/** Feedbacks avaliados visíveis: todos (RH/Admin) · subordinados diretos (gestor). */
export function filtroAvaliacoes(ctx: Contexto, escopo: Escopo): Prisma.AvaliacaoFeedbackWhereInput {
  if (escopo === "todos") return {};
  if (escopo !== "equipe" || !ctx.colaboradorId) return { id: NENHUM };
  return { colaborador: { gestorId: ctx.colaboradorId } };
}

/**
 * Pessoas que o papel pode avaliar/agendar: não desligadas da empresa (todos)
 * ou subordinados diretos (equipe). Inclui pré-admissão (primeiro 1:1 no onboarding).
 */
export function filtroPessoasFeedback(ctx: Contexto, escopo: Escopo): Prisma.ColaboradorWhereInput {
  if (escopo === "todos") return { status: { not: "desligado" } };
  if (escopo !== "equipe" || !ctx.colaboradorId) return { id: NENHUM };
  return { status: { not: "desligado" }, gestorId: ctx.colaboradorId };
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

/** Editar/excluir feedback avaliado: escopo "todos" ou o gestor direto da pessoa (com "editar"). */
export function podeEditarAvaliacao(ctx: Contexto, escopoEditar: Escopo | null, colaborador: { gestorId: string | null }) {
  if (!escopoEditar || ctx.suporte) return false;
  if (escopoEditar === "todos") return true;
  return escopoEditar === "equipe" && !!ctx.colaboradorId && colaborador.gestorId === ctx.colaboradorId;
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
