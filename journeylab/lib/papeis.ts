import "server-only";

import type { Tx } from "@/lib/db";
import { PAPEIS_PADRAO } from "@/lib/permissoes";

/** Cria os papéis padrão de uma organização nova (idempotente por nome). */
export async function criarPapeisPadrao(tx: Tx, tenantId: string) {
  const ids: Record<string, string> = {};
  for (const p of PAPEIS_PADRAO) {
    const papel = await tx.papel.upsert({
      where: { tenantId_nome: { tenantId, nome: p.nome } },
      update: {},
      create: { tenantId, nome: p.nome, base: p.base, sistema: true },
    });
    ids[p.base] = papel.id;
    const existentes = await tx.papelPermissao.count({ where: { papelId: papel.id } });
    if (existentes === 0) {
      await tx.papelPermissao.createMany({
        data: p.regras.flatMap(([area, acoes, escopo]) => acoes.map((acao) => ({ tenantId, papelId: papel.id, area, acao, escopo }))),
      });
    }
  }
  return ids as Record<"admin_org" | "rh" | "gestor" | "colaborador", string>;
}
