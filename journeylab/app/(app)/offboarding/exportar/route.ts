import { acessoExportacao, data } from "@/lib/exportar";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { nomeMotivo, TIPO_DESLIGAMENTO } from "@/lib/offboarding/motivos";
import { CHAVES_DIMENSAO, DIMENSOES, lerRespostas } from "@/lib/offboarding/questionario";

/** Desligamentos e entrevistas (RH/Admin · Offboarding › Exportar), auditado. */
export async function GET() {
  const { acesso, negado } = await acessoExportacao("offboarding");
  if (negado) return negado;
  const { ctx, db } = acesso;
  const lista = await db.desligamento.findMany({ include: { colaborador: { select: { nome: true } } }, orderBy: { data: "desc" }, take: 20_000 });
  const linhas: unknown[][] = [
    [
      "Colaborador",
      "Data",
      "Tipo",
      "Iniciativa",
      "Perda lamentada",
      "Cargo",
      "Equipe",
      "Área",
      "Gestor",
      "Admissão",
      "Motivo informado",
      "Entrevista",
      "Motivo principal real",
      "Motivos reais",
      "Poderia ter sido evitada",
      "Recomendaria (0-10)",
      "Voltaria",
      ...CHAVES_DIMENSAO.map((d) => DIMENSOES[d]),
      "O que mais pesou",
      "Sugestões",
    ],
    ...lista.map((x) => {
      const r = lerRespostas(x.respostas);
      return [
        x.colaborador.nome,
        data(x.data),
        TIPO_DESLIGAMENTO[x.tipo].nome,
        x.voluntario ? "Voluntária" : "Involuntária",
        x.perdaLamentada ? "Sim" : "Não",
        x.cargo,
        x.equipeNome,
        x.areaNome,
        x.gestorNome,
        data(x.admissao),
        nomeMotivo(x.motivoDeclarado),
        x.entrevistaStatus,
        x.motivoPrincipalReal ? nomeMotivo(x.motivoPrincipalReal) : "",
        x.motivosReais.map(nomeMotivo).join(", "),
        x.evitavel ?? "",
        x.enps ?? "",
        x.voltaria ?? "",
        ...CHAVES_DIMENSAO.map((d) => r?.experiencia[d] ?? ""),
        r?.decisao ?? "",
        r?.sugestoes ?? "",
      ];
    }),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "offboarding.exportar", entidade: "desligamento", detalhes: { quantidade: lista.length } });
  return respostaCsv(linhas, "desligamentos");
}
