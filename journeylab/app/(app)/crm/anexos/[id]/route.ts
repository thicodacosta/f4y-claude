import { NextResponse } from "next/server";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { filtroCandidatos } from "@/lib/crm/consultas";
import { urlTemporaria } from "@/lib/storage";

/**
 * Download de anexo: checa módulo, permissão, organização (RLS) e escopo do
 * candidato ANTES de emitir URL assinada de 60 s. Um id de outra organização
 * simplesmente não é encontrado.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let acesso;
  try {
    acesso = await exigirPermissaoAcao("crm", "visualizar");
  } catch (e) {
    return NextResponse.json({ erro: e instanceof ErroAcesso ? e.message : "Não autorizado" }, { status: 403 });
  }
  const { ctx, escopo, db } = acesso;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const anexo = await db.anexoCandidato.findFirst({ where: { id, candidato: filtroCandidatos(ctx, escopo) } });
  if (!anexo) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return NextResponse.redirect(await urlTemporaria(anexo.caminho, anexo.nomeArquivo));
}
