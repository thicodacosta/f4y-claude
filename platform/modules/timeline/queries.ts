import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_INTERNOS } from "@/lib/roles";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { podeVerConfidencial } from "@/modules/ats/queries";

export type TimelineItem = {
  id: string;
  tipo: string;
  conteudo: string;
  criadoEm: string;
  autorNome: string | null;
  origem: string;
  origemLink: string;
};

/** Timeline unificada de uma empresa (Fase 10) — junta atividades que hoje
 * vivem espalhadas por três domínios (CRM/oportunidades, ATS/vagas,
 * Alocação Tech/contratos), todas já gravadas em `Atividade` de forma
 * polimórfica (entidadeTipo+entidadeId) — aqui só agregamos e ordenamos por
 * data, sem duplicar o dado. */
export async function getTimelineUnificadaEmpresa(empresaId: string): Promise<TimelineItem[]> {
  await requirePapel(PAPEIS_INTERNOS);

  const [oportunidades, vagas] = await Promise.all([
    prisma.oportunidade.findMany({ where: { empresaId }, select: { id: true, vertical: true } }),
    prisma.vaga.findMany({ where: { empresaId }, select: { id: true, cargo: true } }),
  ]);

  const contratos = await prisma.contratoAlocacao.findMany({
    where: { vagaId: { in: vagas.map((v) => v.id) } },
    select: { id: true, vagaId: true },
  });

  const idsPorTipo: Record<string, string[]> = {
    empresa: [empresaId],
    oportunidade: oportunidades.map((o) => o.id),
    vaga: vagas.map((v) => v.id),
    contrato: contratos.map((c) => c.id),
  };

  const todosIds = Object.values(idsPorTipo).flat();
  if (todosIds.length === 0) return [];

  const atividades = await prisma.atividade.findMany({
    where: {
      OR: Object.entries(idsPorTipo)
        .filter(([, ids]) => ids.length > 0)
        .map(([entidadeTipo, ids]) => ({ entidadeTipo: entidadeTipo as never, entidadeId: { in: ids } })),
    },
    include: { autor: true },
    orderBy: { criadoEm: "desc" },
  });

  const oportunidadePorId = new Map(oportunidades.map((o) => [o.id, o]));
  const vagaPorId = new Map(vagas.map((v) => [v.id, v]));
  const vagaIdPorContratoId = new Map(contratos.map((c) => [c.id, c.vagaId]));

  return atividades.map((a) => {
    let origem = "Empresa";
    let origemLink = `/empresas/${empresaId}`;

    if (a.entidadeTipo === "oportunidade") {
      const o = oportunidadePorId.get(a.entidadeId);
      origem = `Comercial · ${o ? verticalNegocioLabel[o.vertical] : ""}`;
      origemLink = `/crm/pipeline-comercial`;
    } else if (a.entidadeTipo === "vaga") {
      const v = vagaPorId.get(a.entidadeId);
      origem = `Recrutamento · ${v?.cargo ?? ""}`;
      origemLink = `/vagas/${a.entidadeId}`;
    } else if (a.entidadeTipo === "contrato") {
      const vagaId = vagaIdPorContratoId.get(a.entidadeId);
      origem = "Alocação Tech · Contrato";
      origemLink = vagaId ? `/vagas/${vagaId}` : "/alocacao";
    }

    return {
      id: a.id,
      tipo: a.tipo,
      conteudo: a.conteudo,
      criadoEm: a.criadoEm.toISOString(),
      autorNome: a.autor?.nome ?? null,
      origem,
      origemLink,
    };
  });
}

/** Timeline unificada de um candidato — atividades diretas do perfil +
 * eventos sintetizados de cada processo (VagaCandidato) que hoje não geram
 * uma linha própria em Atividade (entrada no processo, feedback do
 * cliente) + atividades de vaga que citam o candidato pelo nome (o
 * conteúdo dessas sempre inclui o nome entre aspas, ver modules/ats/actions.ts
 * e modules/portal-cliente/actions.ts — heurística simples, não é garantida
 * se dois candidatos tiverem o mesmo nome). */
export async function getTimelineUnificadaCandidato(candidatoId: string): Promise<TimelineItem[]> {
  const usuario = await requirePapel(PAPEIS_INTERNOS);

  const candidato = await prisma.candidato.findUniqueOrThrow({ where: { id: candidatoId }, select: { nome: true } });

  const todosProcessos = await prisma.vagaCandidato.findMany({
    where: { candidatoId },
    include: { vaga: { select: { id: true, cargo: true, confidencial: true } } },
  });

  // Mesma regra de modules/ats/queries.ts: quem não tem papel de Executive
  // Search nem sabe que o processo confidencial existe — exclui inteiro em
  // vez de mascarar, pra não vazar nem a existência do processo.
  const processos = podeVerConfidencial(usuario.papel)
    ? todosProcessos
    : todosProcessos.filter((p) => !p.vaga.confidencial);

  const vagaIds = processos.map((p) => p.vagaId);

  const [atividadesDiretas, atividadesDeVaga] = await Promise.all([
    prisma.atividade.findMany({
      where: { entidadeTipo: "candidato", entidadeId: candidatoId },
      include: { autor: true },
    }),
    vagaIds.length > 0
      ? prisma.atividade.findMany({
          where: { entidadeTipo: "vaga", entidadeId: { in: vagaIds }, conteudo: { contains: candidato.nome } },
          include: { autor: true },
        })
      : Promise.resolve([]),
  ]);

  const vagaPorId = new Map(processos.map((p) => [p.vagaId, p.vaga]));

  const itensReais: TimelineItem[] = [...atividadesDiretas, ...atividadesDeVaga].map((a) => {
    const vaga = a.entidadeTipo === "vaga" ? vagaPorId.get(a.entidadeId) : undefined;
    return {
      id: a.id,
      tipo: a.tipo,
      conteudo: a.conteudo,
      criadoEm: a.criadoEm.toISOString(),
      autorNome: a.autor?.nome ?? null,
      origem: vaga ? `Processo · ${vaga.confidencial ? "🔒 " : ""}${vaga.cargo}` : "Perfil",
      origemLink: vaga ? `/vagas/${vaga.id}` : `/candidatos/${candidatoId}`,
    };
  });

  const itensSinteticos: TimelineItem[] = processos.flatMap((p) => {
    const nomeVaga = p.vaga.confidencial ? `🔒 ${p.vaga.cargo}` : p.vaga.cargo;
    const entrada: TimelineItem = {
      id: `${p.id}-entrada`,
      tipo: "nota",
      conteudo: `Entrou no processo de "${nomeVaga}".`,
      criadoEm: p.criadoEm.toISOString(),
      autorNome: null,
      origem: `Processo · ${nomeVaga}`,
      origemLink: `/vagas/${p.vagaId}`,
    };
    if (!p.feedbackCliente || !p.feedbackEm) return [entrada];
    const feedback: TimelineItem = {
      id: `${p.id}-feedback`,
      tipo: "feedback_cliente",
      conteudo: `Cliente ${p.feedbackCliente === "aprovado" ? "aprovou" : "reprovou"} o candidato para "${nomeVaga}"${
        p.comentarioCliente ? ` — "${p.comentarioCliente}"` : ""
      }.`,
      criadoEm: p.feedbackEm.toISOString(),
      autorNome: null,
      origem: `Processo · ${nomeVaga}`,
      origemLink: `/vagas/${p.vagaId}`,
    };
    return [entrada, feedback];
  });

  return [...itensReais, ...itensSinteticos].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
  );
}
