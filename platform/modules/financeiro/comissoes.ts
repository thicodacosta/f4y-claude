import "server-only";

import type { Prisma, VerticalNegocio } from "@/lib/generated/prisma/client";

/**
 * Chamado de dentro da transação que fecha uma oportunidade (Ganho) ou vaga
 * (Fechada) — ver modules/crm/actions.ts#moverOportunidade e
 * modules/ats/actions.ts#moverVaga. Gera o lançamento de faturamento
 * (pendente) e a comissão (pendente) do responsável, usando o percentual da
 * regra da vertical no momento do fechamento (não recalcula depois se a
 * regra mudar — ver comentário no model RegraComissao).
 *
 * Silencioso (não lança erro) quando falta o dado necessário — valor zerado
 * ou responsável não atribuído não deveriam travar o fechamento em si.
 */
export async function gerarFaturamentoEComissao(
  tx: Prisma.TransactionClient,
  params: {
    empresaId: string;
    origemTipo: "oportunidade" | "vaga";
    origemId: string;
    valor: number;
    vertical: VerticalNegocio;
    usuarioId: string | null;
  },
) {
  if (params.valor <= 0) return;

  const regra = await tx.regraComissao.findUnique({ where: { vertical: params.vertical } });
  const percentual =
    params.origemTipo === "oportunidade" ? regra?.percentualConsultor : regra?.percentualRecrutador;

  await tx.faturamento.create({
    data: {
      empresaId: params.empresaId,
      origemTipo: params.origemTipo,
      origemId: params.origemId,
      valor: params.valor,
      dataPrevista: new Date(),
    },
  });

  if (params.usuarioId && percentual) {
    const hoje = new Date();
    await tx.comissao.create({
      data: {
        usuarioId: params.usuarioId,
        origemTipo: params.origemTipo,
        origemId: params.origemId,
        valor: (params.valor * Number(percentual)) / 100,
        percentual,
        competencia: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`,
      },
    });
  }
}
