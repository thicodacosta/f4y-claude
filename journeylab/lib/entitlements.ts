import "server-only";

import type { Modulo } from "@/lib/permissoes";
import type { Tx } from "@/lib/db";
import type { OrigemEntitlement, StatusEntitlement } from "@/lib/generated/prisma/client";

/** Um módulo está liberado se o status permite E a data atual está no período. */
export function entitlementLibera(e: { status: StatusEntitlement; inicio: Date; fim: Date | null }, agora = new Date()) {
  return (e.status === "ativo" || e.status === "teste") && e.inicio <= agora && (!e.fim || e.fim >= agora);
}

export type MudancaEntitlement = {
  tenantId: string;
  modulo: Modulo;
  status: StatusEntitlement;
  inicio?: Date;
  fim?: Date | null;
  origem: OrigemEntitlement;
  referenciaExterna?: string | null;
  responsavel: { id: string | null; nome: string };
  motivo?: string | null;
};

/**
 * ÚNICO ponto de mudança de acesso a módulos — usado pelo admin JourneyLab,
 * pela integração Kiwify/site e por rotinas do sistema. Grava histórico
 * (antes/depois, origem, responsável, motivo) e NUNCA apaga dados do módulo.
 * Deve rodar numa transação de escopo "plataforma".
 */
export async function alterarEntitlement(tx: Tx, m: MudancaEntitlement) {
  const atual = await tx.entitlement.findUnique({ where: { tenantId_modulo: { tenantId: m.tenantId, modulo: m.modulo } } });
  const inicio = m.inicio ?? atual?.inicio ?? new Date();
  const fim = m.fim === undefined ? (atual?.fim ?? null) : m.fim;
  if (fim && fim < inicio) throw new Error("A data de expiração deve ser posterior ao início.");

  const e = atual
    ? await tx.entitlement.update({
        where: { id: atual.id },
        data: { status: m.status, inicio, fim, origem: m.origem, referenciaExterna: m.referenciaExterna ?? atual.referenciaExterna },
      })
    : await tx.entitlement.create({
        data: {
          tenantId: m.tenantId,
          modulo: m.modulo,
          status: m.status,
          inicio,
          fim,
          origem: m.origem,
          referenciaExterna: m.referenciaExterna ?? null,
        },
      });

  await tx.historicoEntitlement.create({
    data: {
      tenantId: m.tenantId,
      entitlementId: e.id,
      modulo: m.modulo,
      statusAnterior: atual?.status ?? null,
      statusNovo: m.status,
      inicio,
      fim,
      origem: m.origem,
      responsavelId: m.responsavel.id,
      responsavelNome: m.responsavel.nome,
      motivo: m.motivo ?? null,
    },
  });
  return e;
}
