import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao, data } from "@/lib/exportar";
import { filtroAvaliacoes, filtroReunioes } from "@/lib/feedback/regras";
import { TODOS_CRITERIOS, umaCasa } from "@/lib/feedback/avaliacao";

/** Feedbacks avaliados, reuniões e compromissos no escopo do papel. Nunca inclui anotações de 1:1. Auditado. */
export async function GET() {
  const { acesso, negado } = await acessoExportacao("feedback");
  if (!acesso) return negado;
  const { ctx, escopo, db } = acesso;
  const reunioes = await db.reuniao.findMany({
    where: filtroReunioes(ctx, escopo),
    include: { colaborador: { select: { nome: true } }, gestor: { select: { nome: true } }, compromissos: { include: { responsavel: { select: { nome: true } } } } },
    orderBy: { dataHora: "desc" },
    take: 5000,
  });
  const avaliacoes = await db.avaliacaoFeedback.findMany({
    where: filtroAvaliacoes(ctx, escopo),
    include: { colaborador: { select: { nome: true, cargo: true } }, gestor: { select: { nome: true } } },
    orderBy: { data: "desc" },
    take: 5000,
  });
  const linhas: unknown[][] = [
    ["FEEDBACKS AVALIADOS"],
    ["Data", "Pessoa", "Cargo", "Gestor", "Periodicidade", ...TODOS_CRITERIOS.map((c) => c.nome), "Média Performance", "Média Cultura", "Média geral", "Semáforo", "Observações"],
    ...avaliacoes.map((a) => [
      data(a.data),
      a.colaborador.nome,
      a.colaborador.cargo,
      a.gestor?.nome,
      a.periodicidade,
      ...TODOS_CRITERIOS.map((c) => (a as unknown as Record<string, number>)[c.campo]),
      umaCasa(a.mediaPerformance),
      umaCasa(a.mediaCultura),
      umaCasa(a.mediaGeral),
      a.semaforo,
      a.observacoes,
    ]),
    [],
    ["REUNIÕES E COMPROMISSOS"],
    ["Data", "Pessoa", "Gestor", "Situação da reunião", "Compromisso", "Responsável", "Prazo", "Situação do compromisso"],
    ...reunioes.flatMap((r) =>
      (r.compromissos.length ? r.compromissos : [null]).map((c) => [
        data(r.dataHora),
        r.colaborador.nome,
        r.gestor.nome,
        r.status,
        c?.descricao ?? "",
        c?.responsavel.nome ?? "",
        data(c?.prazo),
        c?.status ?? "",
      ]),
    ),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "feedback.exportar", entidade: "reuniao", detalhes: { avaliacoes: avaliacoes.length, reunioes: reunioes.length } });
  return respostaCsv(linhas, "feedback-1a1");
}
