import "server-only";

import { transacao, type EscopoDb } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { removerArquivo } from "@/lib/storage";

export const CATEGORIAS_RETENCAO = {
  crmCandidatosMeses: {
    nome: "Candidatos inativos (CRM)",
    ajuda: "Exclui candidatos que não viraram colaboradores, sem processo em andamento e sem atualização no período — com currículos e histórico.",
  },
  crmAnexosMeses: { nome: "Currículos e anexos (CRM)", ajuda: "Remove arquivos enviados há mais tempo que o período; o cadastro do candidato é mantido." },
  feedbackNotasMeses: { nome: "Anotações de 1:1", ajuda: "Remove anotações de reuniões antigas. Data, situação e compromissos são mantidos." },
  pulseMeses: { nome: "Pesquisas Pulse encerradas", ajuda: "Exclui a pesquisa com respostas e participações. Exporte os resultados antes, se precisar guardá-los." },
  nr1RespostasMeses: {
    nome: "Respostas do Diagnóstico NR-1",
    ajuda: "Remove as respostas anônimas de ciclos encerrados; riscos e plano de ação são mantidos. Exporte o relatório antes e confirme os prazos de guarda com a equipe de SST e o jurídico.",
  },
} as const;

export type CategoriaRetencao = keyof typeof CATEGORIAS_RETENCAO;
const DA_FUNCAO: Record<string, CategoriaRetencao> = { feedback_notas: "feedbackNotasMeses", pulse: "pulseMeses", nr1_respostas: "nr1RespostasMeses" };

const ATIVOS = ["inscrito", "em_avaliacao", "entrevista", "aprovado"] as const;
const corte = (meses: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
};

/**
 * Aplica (ou simula) a política de retenção de UMA organização.
 * CRM é tratado aqui (inclui arquivos no storage); anotações e respostas
 * anônimas, pela função do banco `jl_retencao` (a aplicação não as enxerga).
 * Toda execução real fica na auditoria da organização.
 */
export async function executarRetencao(escopo: EscopoDb, tenantId: string, simular: boolean, responsavel: { id: string; nome: string }) {
  const resultado: Partial<Record<CategoriaRetencao, number>> = {};
  const arquivos: string[] = [];
  await transacao(escopo, async (tx) => {
    const pol = await tx.politicaRetencao.findUnique({ where: { tenantId } });
    if (!pol) return;

    if (pol.crmCandidatosMeses && pol.crmCandidatosMeses >= 1) {
      const limite = corte(pol.crmCandidatosMeses);
      const where = {
        tenantId,
        colaborador: null,
        atualizadoEm: { lt: limite },
        candidaturas: { none: { status: { in: [...ATIVOS] } } },
        interacoes: { none: { criadoEm: { gte: limite } } },
      };
      const alvo = await tx.candidato.findMany({ where, select: { id: true, anexos: { select: { caminho: true } } } });
      resultado.crmCandidatosMeses = alvo.length;
      if (!simular && alvo.length) {
        arquivos.push(...alvo.flatMap((c) => c.anexos.map((a) => a.caminho)));
        await tx.candidato.deleteMany({ where: { id: { in: alvo.map((c) => c.id) } } });
      }
    }
    if (pol.crmAnexosMeses && pol.crmAnexosMeses >= 1) {
      const alvo = await tx.anexoCandidato.findMany({ where: { tenantId, criadoEm: { lt: corte(pol.crmAnexosMeses) } }, select: { id: true, caminho: true } });
      resultado.crmAnexosMeses = alvo.length;
      if (!simular && alvo.length) {
        arquivos.push(...alvo.map((a) => a.caminho));
        await tx.anexoCandidato.deleteMany({ where: { id: { in: alvo.map((a) => a.id) } } });
      }
    }
    const linhas = await tx.$queryRaw<{ categoria: string; quantidade: number }[]>`select * from public.jl_retencao(${tenantId}::uuid, ${simular})`;
    for (const l of linhas) resultado[DA_FUNCAO[l.categoria]] = l.quantidade;

    if (!simular) {
      await tx.politicaRetencao.update({ where: { tenantId }, data: { ultimaExecucao: new Date() } });
      await auditar(tx, { tenantId, usuario: responsavel, acao: "retencao.executar", entidade: "politica_retencao", entidadeId: pol.id, detalhes: resultado });
    }
  });
  // Arquivos só saem do storage depois que o banco confirmou a exclusão.
  for (const caminho of new Set(arquivos)) await removerArquivo(caminho).catch(() => undefined);
  return resultado;
}
