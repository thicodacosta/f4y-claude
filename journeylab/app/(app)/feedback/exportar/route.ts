import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao, data } from "@/lib/exportar";
import { filtroReunioes } from "@/lib/feedback/regras";

/** Reuniões e compromissos no escopo do papel. Nunca inclui anotações. Auditado. */
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
  const linhas = [
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
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "feedback.exportar", entidade: "reuniao", detalhes: { quantidade: reunioes.length } });
  return respostaCsv(linhas, "feedback-1a1");
}
