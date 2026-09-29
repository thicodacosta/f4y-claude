import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao, data } from "@/lib/exportar";
import { filtroPdis, progressoPdi } from "@/lib/pdi/regras";

/** PDIs no escopo do papel, com objetivos e ações. Auditado. */
export async function GET() {
  const { acesso, negado } = await acessoExportacao("pdi");
  if (!acesso) return negado;
  const { ctx, escopo, db } = acesso;
  const pdis = await db.pdi.findMany({
    where: filtroPdis(ctx, escopo),
    include: { colaborador: { select: { nome: true } }, objetivos: { orderBy: { ordem: "asc" }, include: { acoes: true } }, acoes: { select: { status: true } } },
    orderBy: { criadoEm: "desc" },
    take: 2000,
  });
  const linhas = [
    ["Pessoa", "Plano", "Situação do plano", "Início", "Fim", "Progresso (%)", "Objetivo", "Competência", "Ação", "Tipo", "Prazo", "Situação da ação", "Evidência"],
    ...pdis.flatMap((p) => {
      const base = [p.colaborador.nome, p.titulo, p.status, data(p.inicio), data(p.fim), progressoPdi(p.acoes)];
      const acoes = p.objetivos.flatMap((o) => (o.acoes.length ? o.acoes : [null]).map((a) => [o.titulo, o.competencia, a?.titulo, a?.tipo, data(a?.prazo), a?.status, a?.evidencia]));
      return (acoes.length ? acoes : [[]]).map((a) => [...base, ...a]);
    }),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "pdi.exportar", entidade: "pdi", detalhes: { quantidade: pdis.length } });
  return respostaCsv(linhas, "pdi");
}
