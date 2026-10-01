"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { filtroVagas } from "./consultas";
import { ETAPAS_PIPELINE, ORDEM_PIPELINE, PRIORIDADES, type EtapaPipeline, type Prioridade } from "./pipeline";

/**
 * Move a vaga no Pipeline. Concluir encerra a vaga (sai da Página de Carreiras,
 * candidaturas e histórico são mantidos); tirar de "Concluída" reabre sem publicar.
 */
export async function moverVagaPipeline(id: string, etapa: EtapaPipeline): Promise<{ ok?: string; erro?: string }> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const e = z.enum(ORDEM_PIPELINE as [EtapaPipeline, ...EtapaPipeline[]]).parse(etapa);
    const msg = await transacao({ escopo: "tenant", tenantId: ctx.org.id, usuarioId: ctx.usuario.id }, async (tx) => {
      const v = await tx.vaga.findFirst({ where: { AND: [{ id: z.string().uuid().parse(id) }, filtroVagas(ctx, escopo)] } });
      if (!v) throw new ErroAcesso("Vaga não encontrada.");
      if (v.etapaPipeline === e) return "Sem alteração.";
      const data: { etapaPipeline: EtapaPipeline; status?: "aberta" | "fechada"; fechadaEm?: Date | null; publicada?: boolean } = { etapaPipeline: e };
      if (e === "concluida" && v.status !== "fechada" && v.status !== "cancelada") Object.assign(data, { status: "fechada", fechadaEm: new Date(), publicada: false });
      if (e !== "concluida" && (v.status === "fechada" || v.status === "cancelada")) Object.assign(data, { status: "aberta", fechadaEm: null });
      await tx.vaga.update({ where: { id: v.id }, data });
      await auditar(tx, {
        tenantId: ctx.org.id,
        usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome },
        acao: "pipeline.vaga.mover",
        entidade: "vaga",
        entidadeId: v.id,
        detalhes: { de: v.etapaPipeline, para: e },
      });
      if (e === "concluida") return "Vaga concluída e retirada da Página de Carreiras.";
      if (data.status === "aberta") return `Vaga reaberta em ${ETAPAS_PIPELINE[e].nome} (publique novamente se quiser receber candidaturas).`;
      return `Movida para ${ETAPAS_PIPELINE[e].nome}.`;
    });
    revalidatePath("/pipeline-vagas");
    revalidatePath("/pagina-carreiras");
    return { ok: msg };
  } catch (e) {
    return { erro: e instanceof ErroAcesso ? e.message : e instanceof z.ZodError ? "Etapa inválida." : "Não foi possível mover a vaga." };
  }
}

export async function alterarPrioridadeVaga(id: string, prioridade: Prioridade): Promise<{ ok?: string; erro?: string }> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const p = z.enum(Object.keys(PRIORIDADES) as [Prioridade, ...Prioridade[]]).parse(prioridade);
    await transacao({ escopo: "tenant", tenantId: ctx.org.id, usuarioId: ctx.usuario.id }, async (tx) => {
      const v = await tx.vaga.findFirst({ where: { AND: [{ id: z.string().uuid().parse(id) }, filtroVagas(ctx, escopo)] }, select: { id: true, prioridade: true } });
      if (!v) throw new ErroAcesso("Vaga não encontrada.");
      await tx.vaga.update({ where: { id: v.id }, data: { prioridade: p } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "pipeline.vaga.prioridade", entidade: "vaga", entidadeId: v.id, detalhes: { de: v.prioridade, para: p } });
    });
    revalidatePath("/pipeline-vagas");
    return { ok: `Prioridade: ${PRIORIDADES[p].nome}.` };
  } catch (e) {
    return { erro: e instanceof ErroAcesso ? e.message : "Não foi possível alterar a prioridade." };
  }
}
