import type { NextRequest } from "next/server";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao, data } from "@/lib/exportar";
import { hoje } from "@/lib/datas";
import { calcularPdi, progressoAcao, RESPONSAVEL_ACAO, STATUS_ACAO, STATUS_PDI, TIPO_ACAO } from "@/lib/pdi/calculo";
import { nomeFoco } from "@/lib/pdi/focos";
import { COM_ACOES, filtroPdis } from "@/lib/pdi/regras";

/** PDIs no escopo do papel (ou um só, com ?pdi=), com focos e ações. Status/progresso calculados. Auditado. */
export async function GET(request: NextRequest) {
  const { acesso, negado } = await acessoExportacao("pdi");
  if (!acesso) return negado;
  const { ctx, escopo, db } = acesso;
  const um = request.nextUrl.searchParams.get("pdi");
  const pdis = await db.pdi.findMany({
    where: { AND: [filtroPdis(ctx, escopo), um && /^[0-9a-f-]{36}$/.test(um) ? { id: um } : {}] },
    include: { ...COM_ACOES, colaborador: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
    take: 2000,
  });
  const h = hoje();
  const linhas = [
    ["Colaborador", "Plano", "Status do plano", "Início", "Término previsto", "Progresso do plano (%)", "Foco", "Objetivo", "Ação", "Tipo", "Responsável", "Início da ação", "Prazo", "Status da ação", "Progresso da ação (%)", "Investimento estimado (R$)", "Impacto esperado (estimativa)", "Mentor"],
    ...pdis.flatMap((p) => {
      const c = calcularPdi(p.focos, h);
      const base = [p.colaborador.nome, p.titulo, STATUS_PDI[c.status].nome, data(p.inicio), data(p.fim), c.progresso];
      const itens = p.focos.flatMap((f) =>
        (f.acoes.length ? f.acoes : [null]).map((a) => [
          nomeFoco(f.focoChave, f.nomePersonalizado),
          f.objetivo,
          a?.descricao,
          a ? TIPO_ACAO[a.tipo] : "",
          a ? RESPONSAVEL_ACAO[a.responsavel] : "",
          data(a?.inicio),
          data(a?.prazo),
          a ? STATUS_ACAO[a.status].nome : "",
          a ? progressoAcao(a) : "",
          a?.investimento ? Number(a.investimento.toString()).toFixed(2).replace(".", ",") : "",
          a?.impacto,
          a?.mentor,
        ]),
      );
      return (itens.length ? itens : [[]]).map((i) => [...base, ...i]);
    }),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "pdi.exportar", entidade: "pdi", detalhes: { quantidade: pdis.length } });
  return respostaCsv(linhas, "pdi");
}
