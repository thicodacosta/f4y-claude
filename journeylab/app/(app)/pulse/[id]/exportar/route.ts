import { NextResponse } from "next/server";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao } from "@/lib/exportar";
import { resultadoPulse } from "@/lib/pulse/consultas";
import { analisarPergunta } from "@/lib/pulse/analise";
import { deBanco, NOME_TIPO, umaCasa } from "@/lib/pulse/perguntas";

/**
 * Resultados agregados (organização + departamentos cujo recorte o banco
 * liberar). Sem comentários livres e sem respostas individuais.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, negado } = await acessoExportacao("pulse");
  if (!acesso) return negado;
  const { ctx, escopo, db } = acesso;
  if (escopo !== "todos" || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  const p = await db.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
  if (!p || p.status === "rascunho") return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const areas = await db.area.findMany({ where: p.audienciaTipo === "departamentos" ? { id: { in: p.areaIds } } : {}, select: { id: true, nome: true }, orderBy: { nome: "asc" } });

  const linhas: unknown[][] = [["Pesquisa", p.titulo], ["Tipo", p.anonima ? "Anônima" : "Identificada"], [], ["Recorte", "Respondentes", "Pergunta", "Tipo", "Item", "Média", "eNPS", "Distribuição"]];
  for (const recorte of [{ id: null as string | null, nome: "Toda a organização" }, ...areas]) {
    const r = await resultadoPulse(ctx, p.id, recorte.id);
    if (!r.resumo?.liberado) {
      linhas.push([recorte.nome, r.resumo?.respondentes ?? 0, "Recorte não liberado (anonimato)", "", "", "", "", ""]);
      continue;
    }
    for (const q of p.perguntas) {
      const a = analisarPergunta(deBanco(q), q.id, r.linhas, r.comentarios);
      if (a.forma === "textos" || a.pergunta.type === "matrix_text") continue;
      const dist = (itens: { rotulo: string; pct: number }[]) => itens.map((i) => `${i.rotulo}: ${i.pct}%`).join(" | ");
      if (a.linhas.length)
        for (const l of a.linhas) linhas.push([recorte.nome, r.resumo.respondentes, q.texto, NOME_TIPO[a.pergunta.type], l.rotulo, l.media !== null ? umaCasa(l.media) : "", "", dist(l.itens)]);
      else linhas.push([recorte.nome, r.resumo.respondentes, q.texto, NOME_TIPO[a.pergunta.type], "", a.media !== null ? umaCasa(a.media) : "", a.enps?.enps ?? "", dist(a.itens)]);
    }
  }
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "pulse.exportar", entidade: "pesquisa_pulse", entidadeId: p.id });
  return respostaCsv(linhas, "pulse");
}
