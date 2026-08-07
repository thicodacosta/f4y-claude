import "server-only";

import { prisma } from "@/lib/prisma";
import { executarAutomacao } from "@/modules/automacoes/engine";

const UM_DIA_MS = 86_400_000;

/**
 * Verificação oportunista de SLA — sem cron/job scheduler real nesta fase
 * (exigiria infra própria, ex. Vercel Cron ou Supabase Edge Function
 * agendada, fora do escopo de um app Next.js request/response). Roda a
 * cada carregamento do Dashboard (ver app/(app)/dashboard/page.tsx):
 * suficiente pra "rodar de verdade" sem inventar infraestrutura que a
 * plataforma ainda não tem.
 *
 * Notifica cada oportunidade/vaga estourada UMA vez só (checa se já existe
 * AutomacaoExecucao pra essa entidade antes de disparar de novo) — evita
 * spam a cada page load, ao custo de não re-notificar se ela voltar a
 * estourar depois de já ter sido notificada uma vez.
 */
export async function verificarSlasVencidos() {
  const automacoes = await prisma.automacao.findMany({
    where: { evento: "vencimento_sla", ativo: true },
  });
  if (automacoes.length === 0) return;

  const [oportunidadesAbertas, vagasAbertas] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { etapa: { isGanho: false, isPerdido: false, slaDias: { not: null } } },
      include: { etapa: true },
    }),
    prisma.vaga.findMany({
      where: { status: { in: ["aberta", "pausada"] }, etapa: { slaDias: { not: null } } },
      include: { etapa: true },
    }),
  ]);

  if (oportunidadesAbertas.length === 0 && vagasAbertas.length === 0) return;

  const todosIds = [...oportunidadesAbertas.map((o) => o.id), ...vagasAbertas.map((v) => v.id)];

  const [ultimasMudancasEtapa, execucoesExistentes] = await Promise.all([
    prisma.atividade.findMany({
      where: { tipo: "mudanca_etapa", entidadeId: { in: todosIds } },
      orderBy: { criadoEm: "desc" },
      select: { entidadeId: true, criadoEm: true },
    }),
    prisma.automacaoExecucao.findMany({
      where: { automacaoId: { in: automacoes.map((a) => a.id) }, entidadeId: { in: todosIds } },
      select: { automacaoId: true, entidadeId: true },
    }),
  ]);

  const entrouEtapaEm = new Map<string, Date>();
  for (const a of ultimasMudancasEtapa) {
    if (!entrouEtapaEm.has(a.entidadeId)) entrouEtapaEm.set(a.entidadeId, a.criadoEm);
  }

  const jaExecutado = new Set(execucoesExistentes.map((e) => `${e.automacaoId}:${e.entidadeId}`));

  for (const automacao of automacoes) {
    for (const o of oportunidadesAbertas) {
      if (jaExecutado.has(`${automacao.id}:${o.id}`)) continue;
      const desde = entrouEtapaEm.get(o.id) ?? o.criadoEm;
      const diasNaEtapa = (Date.now() - desde.getTime()) / UM_DIA_MS;
      if (diasNaEtapa > o.etapa.slaDias!) {
        await executarAutomacao(prisma, automacao, {
          entidadeTipo: "oportunidade",
          entidadeId: o.id,
          responsavelId: o.responsavelId,
        });
      }
    }

    for (const v of vagasAbertas) {
      if (jaExecutado.has(`${automacao.id}:${v.id}`)) continue;
      const desde = entrouEtapaEm.get(v.id) ?? v.criadoEm;
      const diasNaEtapa = (Date.now() - desde.getTime()) / UM_DIA_MS;
      if (diasNaEtapa > v.etapa.slaDias!) {
        await executarAutomacao(prisma, automacao, {
          entidadeTipo: "vaga",
          entidadeId: v.id,
          responsavelId: v.recrutadorId,
        });
      }
    }
  }
}
