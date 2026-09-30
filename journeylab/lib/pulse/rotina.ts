import "server-only";

import { transacao, type EscopoDb } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { diasEntre, hoje } from "@/lib/datas";
import { enviarConvites } from "./envio";

/**
 * Rotina diária do Pulse (chamada pelo cron):
 *  1. encerra pesquisas ativas cujo prazo terminou (o banco já recusa respostas fora do prazo);
 *  2. envia UM lembrete automático a quem ainda não respondeu — 2 dias antes do fim
 *     ou, sem data de fim, 3 dias após o envio.
 */
export async function rotinaPulse(escopo: EscopoDb, sistema: { id: string; nome: string }) {
  const h = hoje();
  const encerradas = await transacao(escopo, async (tx) => {
    const vencidas = await tx.pesquisaPulse.findMany({ where: { status: "aberta", encerraEm: { lt: h } }, select: { id: true, tenantId: true } });
    for (const p of vencidas) {
      await tx.pesquisaPulse.update({ where: { id: p.id }, data: { status: "encerrada", encerradaEm: new Date() } });
      await auditar(tx, { tenantId: p.tenantId, usuario: sistema, acao: "pulse.encerrar_automatico", entidade: "pesquisa_pulse", entidadeId: p.id });
    }
    return vencidas.length;
  });

  const ativas = await transacao(escopo, (tx) => tx.pesquisaPulse.findMany({ where: { status: "aberta" }, select: { id: true, encerraEm: true, abertaEm: true } }));
  const devidas = ativas.filter((p) => (p.encerraEm ? diasEntre(h, p.encerraEm) <= 2 : p.abertaEm && Date.now() - p.abertaEm.getTime() >= 3 * 86_400_000));
  let lembretes = 0;
  const falhas: string[] = [];
  for (const p of devidas) {
    const ids = await transacao(escopo, (tx) =>
      tx.$queryRaw<{ id: string }[]>`
        select c.id from convites_pulse c
         where c.pesquisa_id = ${p.id}::uuid and c.enviado_em is not null and c.lembrete_em is null
           and not public.jl_convite_respondido(c.id)`,
    );
    if (!ids.length) continue;
    const r = await enviarConvites(escopo, ids.map((i) => i.id), true);
    lembretes += r.enviados;
    falhas.push(...r.falhas.map((f) => `${f.nome}: ${f.motivo}`));
  }
  return { encerradas, lembretes, falhas: falhas.slice(0, 20) };
}
