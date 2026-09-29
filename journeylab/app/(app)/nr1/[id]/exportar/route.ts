import { NextResponse } from "next/server";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { indicesPorDimensao, resultadoNr1 } from "@/lib/nr1/consultas";
import { faixa, PRIORIDADE, STATUS_ACAO_NR1, STATUS_RISCO } from "@/lib/nr1/regras";

/**
 * Relatório do ciclo (NR-1 › Exportar, escopo "todos"): índices agregados da
 * organização (só se liberados pelo banco), fatores de risco e plano de ação.
 * Nunca contém respostas individuais. Auditado.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let acesso;
  try {
    acesso = await exigirPermissaoAcao("nr1", "exportar");
    if (acesso.escopo !== "todos") throw new ErroAcesso("Exportação restrita.");
  } catch (e) {
    return NextResponse.json({ erro: e instanceof ErroAcesso ? e.message : "Não autorizado" }, { status: 403 });
  }
  const { ctx, db } = acesso;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const c = await db.cicloNr1.findUnique({
    where: { id },
    include: {
      dimensoes: { orderBy: { ordem: "asc" } },
      riscos: { include: { dimensao: { select: { nome: true } }, acoes: true }, orderBy: { criadoEm: "asc" } },
    },
  });
  if (!c) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const r = await resultadoNr1(ctx, c.id, null);
  const indices = indicesPorDimensao(r.linhas);

  const linhas: unknown[][] = [
    ["Diagnóstico NR-1", c.titulo],
    ["Organização", ctx.org.nome],
    ["Situação", c.status],
    ["Participantes", r.resumo?.liberado ? r.resumo.respondentes : "resultados não liberados"],
    ["Aviso", "Ferramenta de apoio à gestão de fatores psicossociais; não constitui avaliação clínica, laudo técnico nem parecer jurídico."],
    [],
    ["Dimensão", "Índice (0-100)", "Faixa"],
    ...c.dimensoes.map((d) => {
      const i = indices.get(d.id);
      return [d.nome, i ?? "—", i !== undefined ? faixa(i).nome : "—"];
    }),
    [],
    ["Fator de risco", "Dimensão", "Prioridade", "Situação", "Medida", "Responsável", "Prazo", "Situação da medida", "Evidência"],
    ...c.riscos.flatMap((x) =>
      (x.acoes.length ? x.acoes : [null]).map((a) => [
        x.titulo,
        x.dimensao?.nome ?? "",
        PRIORIDADE[x.prioridade].nome,
        STATUS_RISCO[x.status],
        a?.titulo ?? "",
        a?.responsavelNome ?? "",
        a?.prazo ? a.prazo.toISOString().slice(0, 10) : "",
        a ? STATUS_ACAO_NR1[a.status].nome : "",
        a?.evidencia ?? "",
      ]),
    ),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "nr1.exportar", entidade: "ciclo_nr1", entidadeId: c.id });
  return respostaCsv(linhas, "diagnostico-nr1");
}
