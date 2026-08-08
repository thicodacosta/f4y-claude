import "server-only";

import type { Prisma, EntidadeTipo } from "@/lib/generated/prisma/client";

type AcaoCriarTarefa = { tipo: "criar_tarefa"; params: { titulo: string; prazoDias?: number } };
type AcaoNotificar = { tipo: "notificar"; params: { titulo: string; corpo?: string } };
type Acao = AcaoCriarTarefa | AcaoNotificar | { tipo: string; params?: unknown };

type ContextoDisparo = {
  entidadeTipo: EntidadeTipo;
  entidadeId: string;
  /** Quem recebe a tarefa/notificação — responsável da oportunidade,
   * recrutador da vaga. Sem isso a ação vira uma execução com erro (não dá
   * pra criar tarefa/notificação sem destinatário). */
  responsavelId: string | null;
};

/** Qualquer client compatível com os delegates usados aqui — tanto o
 * PrismaClient normal quanto o client de dentro de um $transaction. */
type AutomacaoDb = Prisma.TransactionClient;

/** Chamado de dentro da transação que move uma oportunidade/vaga de etapa —
 * ver modules/crm/actions.ts#moverOportunidade e modules/ats/actions.ts#moverVaga. */
export async function dispararEntrouEtapa(db: AutomacaoDb, pipelineEtapaId: string, ctx: ContextoDisparo) {
  const automacoes = await db.automacao.findMany({
    where: { pipelineEtapaId, evento: "entrou_etapa", ativo: true },
  });
  for (const automacao of automacoes) {
    await executarAutomacao(db, automacao, ctx);
  }
}

/** Executa uma automação já resolvida (usado pelo disparo por etapa acima e
 * pela verificação de SLA em modules/automacoes/sla.ts). Nunca lança — falha
 * de ação individual não pode derrubar o fechamento da oportunidade/vaga que
 * a disparou; fica registrada em AutomacaoExecucao com resultado "erro". */
export async function executarAutomacao(
  db: AutomacaoDb,
  automacao: { id: string; acao: unknown },
  ctx: ContextoDisparo,
) {
  const acao = automacao.acao as Acao;

  try {
    switch (acao.tipo) {
      case "criar_tarefa": {
        if (!ctx.responsavelId) throw new Error("Sem responsável atribuído — não foi possível criar a tarefa.");
        const params = acao.params as AcaoCriarTarefa["params"];
        await db.tarefa.create({
          data: {
            titulo: params.titulo,
            entidadeTipo: ctx.entidadeTipo,
            entidadeId: ctx.entidadeId,
            responsavelId: ctx.responsavelId,
            prazo: params.prazoDias ? new Date(Date.now() + params.prazoDias * 86_400_000) : undefined,
            origem: "automacao",
          },
        });
        break;
      }
      case "notificar": {
        if (!ctx.responsavelId) throw new Error("Sem destinatário atribuído — não foi possível notificar.");
        const params = acao.params as AcaoNotificar["params"];
        await db.notificacao.create({
          data: {
            usuarioId: ctx.responsavelId,
            titulo: params.titulo,
            corpo: params.corpo,
            link:
              ctx.entidadeTipo === "vaga"
                ? `/vagas/${ctx.entidadeId}`
                : ctx.entidadeTipo === "faturamento"
                  ? "/financeiro"
                  : undefined,
          },
        });
        break;
      }
      default:
        throw new Error(`Tipo de ação "${acao.tipo}" ainda não implementado nesta fase.`);
    }

    await db.automacaoExecucao.create({
      data: {
        automacaoId: automacao.id,
        entidadeTipo: ctx.entidadeTipo,
        entidadeId: ctx.entidadeId,
        resultado: "sucesso",
      },
    });
  } catch (err) {
    await db.automacaoExecucao.create({
      data: {
        automacaoId: automacao.id,
        entidadeTipo: ctx.entidadeTipo,
        entidadeId: ctx.entidadeId,
        resultado: "erro",
        erro: err instanceof Error ? err.message : "Erro desconhecido.",
      },
    });
  }
}
