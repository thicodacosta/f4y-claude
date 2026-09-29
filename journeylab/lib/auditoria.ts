import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import type { Tx } from "@/lib/db";

type Cliente = Tx | { auditoria: { create: (a: { data: Prisma.AuditoriaUncheckedCreateInput }) => Promise<unknown> } };

/** Registro imutável de ação relevante (trigger em rls.sql bloqueia alteração). */
export async function auditar(
  db: Cliente,
  e: {
    tenantId: string | null;
    usuario: { id: string; nome: string };
    acao: string;
    entidade: string;
    entidadeId?: string | null;
    detalhes?: unknown;
    suporte?: boolean;
  },
) {
  await db.auditoria.create({
    data: {
      tenantId: e.tenantId,
      usuarioId: e.usuario.id,
      usuarioNome: e.usuario.nome,
      acao: e.acao,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      detalhes: e.detalhes === undefined ? undefined : (JSON.parse(JSON.stringify(e.detalhes)) as Prisma.InputJsonValue),
      suporte: e.suporte ?? false,
    },
  });
}
