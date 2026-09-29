import { NextResponse } from "next/server";
import { auditar } from "@/lib/auditoria";
import { respostaCsv } from "@/lib/csv";
import { acessoExportacao } from "@/lib/exportar";
import { resultadoPulse } from "@/lib/pulse/consultas";
import { calcularEnps } from "@/lib/pulse/regras";

/**
 * Resultados agregados de uma pesquisa encerrada (organização + equipes cujo
 * recorte o banco liberar). Sem comentários livres e sem respostas individuais.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, negado } = await acessoExportacao("pulse");
  if (!acesso) return negado;
  const { ctx, escopo, db } = acesso;
  if (escopo !== "todos" || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: "Não autorizado" }, { status: 403 });
  const p = await db.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
  if (!p) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const equipes = await db.equipe.findMany({ where: p.publicoTodos ? {} : { id: { in: p.equipeIds } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });

  const linhas: unknown[][] = [["Pesquisa", p.titulo], [], ["Recorte", "Respondentes", "Pergunta", "Tipo", "Média", "eNPS", "Distribuição"]];
  for (const recorte of [{ id: null as string | null, nome: "Toda a organização" }, ...equipes]) {
    const r = await resultadoPulse(ctx, p.id, recorte.id);
    if (!r.resumo?.liberado) {
      linhas.push([recorte.nome, r.resumo?.respondentes ?? 0, "Recorte não liberado (anonimato)", "", "", "", ""]);
      continue;
    }
    for (const q of p.perguntas.filter((q) => q.tipo !== "texto")) {
      const l = r.linhas.find((x) => x.pergunta_id === q.id);
      const enps = q.tipo === "enps" && l ? calcularEnps(l.distribuicao)?.enps : "";
      linhas.push([recorte.nome, r.resumo.respondentes, q.texto, q.tipo, l?.media ?? "", enps ?? "", l ? JSON.stringify(l.distribuicao) : ""]);
    }
  }
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "pulse.exportar", entidade: "pesquisa_pulse", entidadeId: p.id });
  return respostaCsv(linhas, "pulse");
}
