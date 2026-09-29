import { NextResponse, type NextRequest } from "next/server";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { filtroCandidatos, filtroLista } from "@/lib/crm/consultas";
import { auditar } from "@/lib/auditoria";
import { csv } from "@/lib/csv";


/** Exportação com permissão própria (CRM › Exportar), limitada ao escopo e auditada. Sem anexos. */
export async function GET(request: NextRequest) {
  let acesso;
  try {
    acesso = await exigirPermissaoAcao("crm", "exportar");
  } catch (e) {
    return NextResponse.json({ erro: e instanceof ErroAcesso ? e.message : "Não autorizado" }, { status: 403 });
  }
  const { ctx, escopo, db } = acesso;
  const sp = Object.fromEntries(request.nextUrl.searchParams) as Record<string, string>;
  const candidatos = await db.candidato.findMany({
    where: { AND: [filtroCandidatos(ctx, escopo), filtroLista(sp)] },
    include: { tags: { include: { tag: true } }, candidaturas: { include: { vaga: { select: { titulo: true } } } } },
    orderBy: { nome: "asc" },
    take: 5000,
  });
  const linhas = [
    ["Nome", "E-mail", "Telefone", "Cidade", "UF", "LinkedIn", "Competências", "Tags", "Vagas (situação)", "Origem", "Cadastrado em"].map(csv).join(";"),
    ...candidatos.map((c) =>
      [
        c.nome,
        c.email,
        c.telefone,
        c.cidade,
        c.uf,
        c.linkedin,
        c.competencias.join(", "),
        c.tags.map((t) => t.tag.nome).join(", "),
        c.candidaturas.map((cd) => `${cd.vaga.titulo} (${cd.status})`).join("; "),
        c.origem,
        c.criadoEm.toISOString().slice(0, 10),
      ]
        .map(csv)
        .join(";"),
    ),
  ];
  await auditar(db, { tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome }, acao: "crm.exportar", entidade: "candidato", detalhes: { filtros: sp, quantidade: candidatos.length } });
  return new NextResponse("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidatos-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
