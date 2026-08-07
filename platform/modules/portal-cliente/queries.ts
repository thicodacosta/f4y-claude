import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePortalCliente } from "@/lib/auth";
import type { StatusSimplificado } from "@/modules/portal-cliente/schemas";

const ETAPAS_SHORTLIST = new Set(["entrevista_cliente", "forecast", "fechada"]);

function statusSimplificado(vaga: { status: string }, etapas: string[]): StatusSimplificado {
  if (vaga.status === "fechada") return "fechada";
  if (vaga.status === "perdida") return "encerrada";
  if (etapas.some((e) => ETAPAS_SHORTLIST.has(e))) return "shortlist_disponivel";
  return "em_andamento";
}

export async function getVagasDoCliente() {
  const { empresaId } = await requirePortalCliente();

  const vagas = await prisma.vaga.findMany({
    where: { empresaId },
    include: { candidatos: { select: { etapa: true } } },
    orderBy: { criadoEm: "desc" },
  });

  return vagas.map((v) => ({
    id: v.id,
    cargo: v.cargo,
    vertical: v.vertical,
    status: statusSimplificado(v, v.candidatos.map((c) => c.etapa)),
    dataAbertura: v.dataAbertura ? v.dataAbertura.toISOString() : null,
    quantidadePosicoes: v.quantidadePosicoes,
    posicoesPreenchidas: v.posicoesPreenchidas,
  }));
}

/** Retorna null (tratado como 404 pela página) em vez de lançar — mesma
 * razão de modules/ats/queries.ts#getVaga: não confirmar a outro cliente que
 * o id existe. */
export async function getVagaDoCliente(id: string) {
  const { empresaId } = await requirePortalCliente();

  const vaga = await prisma.vaga.findUnique({
    where: { id },
    include: {
      candidatos: {
        where: { etapa: { in: Array.from(ETAPAS_SHORTLIST) as never[] } },
        include: { candidato: true },
        orderBy: { criadoEm: "desc" },
      },
    },
  });

  if (!vaga || vaga.empresaId !== empresaId) return null;

  return {
    id: vaga.id,
    cargo: vaga.cargo,
    vertical: vaga.vertical,
    status: statusSimplificado(
      vaga,
      vaga.candidatos.map((c) => c.etapa),
    ),
    jobDescription: vaga.jobDescription,
    skillsRequeridas: vaga.skillsRequeridas,
    shortlist: vaga.candidatos.map((c) => ({
      id: c.id,
      etapa: c.etapa,
      fitScore: c.fitScore ? Number(c.fitScore) : null,
      feedbackCliente: c.feedbackCliente,
      comentarioCliente: c.comentarioCliente,
      candidato: {
        nome: c.candidato.nome,
        cargoAtual: c.candidato.cargoAtual,
        empresaAtual: c.candidato.empresaAtual,
        resumoIa: c.candidato.resumoIa,
        skills: c.candidato.skills,
      },
    })),
  };
}
