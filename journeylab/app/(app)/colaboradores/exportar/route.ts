import { acessoExportacao, data } from "@/lib/exportar";
import { filtroColaboradores } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { STATUS_PESSOA } from "@/lib/rotulos";

/** Base de colaboradores no escopo do papel (Cadastro › Exportar), auditada. */
export async function GET() {
  const { acesso, negado } = await acessoExportacao("cadastro");
  if (negado) return negado;
  const { ctx, escopo, db } = acesso;
  const lista = await db.colaborador.findMany({
    where: filtroColaboradores(ctx, escopo),
    include: { equipe: { select: { nome: true, area: { select: { nome: true } } } }, gestor: { select: { email: true } } },
    orderBy: { nome: "asc" },
    take: 50_000,
  });
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "colaborador.exportar", entidade: "colaborador", detalhes: { quantidade: lista.length } });
  return respostaCsv(
    [
      ["nome", "email", "cargo", "equipe", "area", "gestor_email", "data_admissao", "situacao", "desligado_em"],
      ...lista.map((c) => [c.nome, c.email, c.cargo, c.equipe?.nome, c.equipe?.area?.nome, c.gestor?.email, data(c.dataAdmissao), STATUS_PESSOA[c.status].nome, data(c.desligadoEm)]),
    ],
    "colaboradores",
  );
}
