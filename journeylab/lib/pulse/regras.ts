import "server-only";

import { dbTenant, type Tx } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import type { Prisma } from "@/lib/generated/prisma/client";
import { hoje } from "@/lib/datas";

/**
 * Pesquisas visíveis na gestão do Pulse:
 *  todos (RH/Admin, com "criar"/"editar") → todas, inclusive rascunhos
 *  leitura (gestor)                      → ativas e encerradas da empresa (somente leitura)
 * Colaborador não acessa a gestão (escopo mínimo em lib/contexto.ts): responde pelo link.
 */
export function filtroPesquisas(gerencia: boolean): Prisma.PesquisaPulseWhereInput {
  return gerencia ? {} : { status: { not: "rascunho" } };
}

/** Equipes lideradas diretamente pelo usuário (usado também pelo NR-1). */
export async function equipesLideradas(ctx: Contexto) {
  if (!ctx.colaboradorId) return [];
  return dbTenant(ctx.org.id, ctx.usuario.id).equipe.findMany({ where: { gestorId: ctx.colaboradorId }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
}

type Pessoa = { id: string; equipeId: string | null; areaId: string | null };

/** Condição de audiência (mesma regra de jl_na_audiencia_pulse no banco). */
export function daAudiencia(p: Pessoa): Prisma.PesquisaPulseWhereInput {
  return {
    OR: [
      { audienciaTipo: "todos" },
      ...(p.areaId ? [{ audienciaTipo: "departamentos", areaIds: { has: p.areaId } }] : []),
      ...(p.equipeId ? [{ audienciaTipo: "equipes", equipeIds: { has: p.equipeId } }] : []),
      { audienciaTipo: "colaboradores", colaboradorIds: { has: p.id } },
    ],
  };
}

/** Pesquisas ativas, no prazo, da audiência da pessoa e ainda não respondidas. */
export function filtroParaResponder(p: Pessoa): Prisma.PesquisaPulseWhereInput {
  const h = hoje();
  return {
    AND: [
      { status: "aberta" },
      { OR: [{ dataInicio: null }, { dataInicio: { lte: h } }] },
      { OR: [{ encerraEm: null }, { encerraEm: { gte: h } }] },
      daAudiencia(p),
      { participacoes: { none: { colaboradorId: p.id } } },
    ],
  };
}

export type Audiencia = { audienciaTipo: string; areaIds: string[]; equipeIds: string[]; colaboradorIds: string[] };

/** Pessoas ativas na audiência (para convites e total do público). */
export function membrosAudiencia(tx: Tx, a: Audiencia) {
  const where: Prisma.ColaboradorWhereInput =
    a.audienciaTipo === "departamentos"
      ? { equipe: { areaId: { in: a.areaIds } } }
      : a.audienciaTipo === "equipes"
        ? { equipeId: { in: a.equipeIds } }
        : a.audienciaTipo === "colaboradores"
          ? { id: { in: a.colaboradorIds } }
          : {};
  return tx.colaborador.findMany({
    where: { AND: [{ status: "ativo" }, where] },
    select: { id: true, nome: true, email: true, associacao: { select: { status: true, usuario: { select: { email: true } } } } },
    orderBy: { nome: "asc" },
  });
}

export const STATUS_PESQUISA = {
  rascunho: { nome: "Rascunho", tom: "neutro" },
  aberta: { nome: "Ativa", tom: "info" },
  encerrada: { nome: "Encerrada", tom: "sucesso" },
} as const;

export const AUDIENCIA = { todos: "Toda a organização", departamentos: "Departamentos", equipes: "Equipes", colaboradores: "Pessoas específicas" } as const;
