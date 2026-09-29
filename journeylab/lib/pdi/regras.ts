import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import { NENHUM } from "@/lib/escopo";

/** PDIs visíveis: todos · equipe (o meu + liderados diretos) · próprio. */
export function filtroPdis(ctx: Contexto, escopo: Escopo): Prisma.PdiWhereInput {
  if (escopo === "todos") return {};
  const eu = ctx.colaboradorId ?? NENHUM;
  if (escopo === "equipe") return { OR: [{ colaboradorId: eu }, { colaborador: { gestorId: eu } }] };
  return { colaboradorId: eu };
}

/** Um PDI aceita mudanças de conteúdo enquanto está em rascunho ou ativo. */
export const PDI_ABERTO = ["rascunho", "ativo"] as const;

export function progressoPdi(acoes: { status: string }[]) {
  const validas = acoes.filter((a) => a.status !== "cancelada");
  if (!validas.length) return 0;
  return Math.round((validas.filter((a) => a.status === "concluida").length / validas.length) * 100);
}

export const STATUS_PDI = {
  rascunho: { nome: "Rascunho", tom: "neutro" },
  ativo: { nome: "Ativo", tom: "info" },
  concluido: { nome: "Concluído", tom: "sucesso" },
  arquivado: { nome: "Arquivado", tom: "neutro" },
} as const;

export const STATUS_ACAO = {
  pendente: { nome: "Pendente", tom: "neutro" },
  em_andamento: { nome: "Em andamento", tom: "info" },
  concluida: { nome: "Concluída", tom: "sucesso" },
  cancelada: { nome: "Cancelada", tom: "neutro" },
} as const;

export const TIPO_ACAO = {
  pratica: "Prática no trabalho",
  curso: "Curso ou treinamento",
  mentoria: "Mentoria",
  leitura: "Leitura",
  projeto: "Projeto",
  outro: "Outro",
} as const;
