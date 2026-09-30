import "server-only";

import { transacao, type EscopoDb } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { hoje } from "@/lib/datas";

/** Rotina diária: encerra diagnósticos ativos cuja data de fim já passou (o banco já recusa respostas fora do prazo). */
export async function rotinaNr1(escopo: EscopoDb, sistema: { id: string; nome: string }) {
  return transacao(escopo, async (tx) => {
    const vencidos = await tx.cicloNr1.findMany({ where: { status: "aberto", encerraEm: { lt: hoje() } }, select: { id: true, tenantId: true } });
    for (const c of vencidos) {
      await tx.cicloNr1.update({ where: { id: c.id }, data: { status: "encerrado", encerradoEm: new Date() } });
      await auditar(tx, { tenantId: c.tenantId, usuario: sistema, acao: "nr1.encerrar_automatico", entidade: "ciclo_nr1", entidadeId: c.id });
    }
    return { encerrados: vencidos.length };
  });
}
