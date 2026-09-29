import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao, data } from "@/lib/exportar";
import { filtroOnboardings, hojeSemHora } from "@/lib/onboarding/regras";

/** Onboardings no escopo do papel: situação, progresso e atrasos. Auditado. */
export async function GET() {
  const { acesso, negado } = await acessoExportacao("onboarding");
  if (!acesso) return negado;
  const { ctx, escopo, db } = acesso;
  const lista = await db.onboarding.findMany({
    where: filtroOnboardings(ctx, escopo),
    include: { colaborador: { select: { nome: true, cargo: true, gestor: { select: { nome: true } } } }, tarefas: { select: { status: true, prazo: true } } },
    orderBy: { inicio: "desc" },
    take: 5000,
  });
  const hoje = hojeSemHora();
  const linhas = [
    ["Pessoa", "Cargo", "Gestor", "Modelo", "Início", "Situação", "Tarefas encerradas", "Tarefas totais", "Atrasadas", "Encerrado em"],
    ...lista.map((o) => [
      o.colaborador.nome,
      o.colaborador.cargo,
      o.colaborador.gestor?.nome,
      o.modeloNome,
      data(o.inicio),
      o.status,
      o.tarefas.filter((t) => t.status !== "pendente").length,
      o.tarefas.length,
      o.status === "em_andamento" ? o.tarefas.filter((t) => t.status === "pendente" && t.prazo < hoje).length : 0,
      data(o.concluidoEm),
    ]),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "onboarding.exportar", entidade: "onboarding", detalhes: { quantidade: lista.length } });
  return respostaCsv(linhas, "onboardings");
}
