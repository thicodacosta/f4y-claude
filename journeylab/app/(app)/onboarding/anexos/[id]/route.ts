import { NextResponse } from "next/server";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import { filtroOnboardings } from "@/lib/onboarding/regras";
import { urlTemporaria } from "@/lib/storage";

/**
 * Download de anexo de tarefa: módulo, permissão, organização (RLS) e escopo
 * do onboarding checados ANTES de emitir a URL assinada de 60 s.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let acesso;
  try {
    acesso = await exigirPermissaoAcao("onboarding", "visualizar");
  } catch (e) {
    return NextResponse.json({ erro: e instanceof ErroAcesso ? e.message : "Não autorizado" }, { status: 403 });
  }
  const { ctx, escopo, db } = acesso;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  const anexo = await db.anexoTarefaOnboarding.findFirst({ where: { id, tarefa: { onboarding: filtroOnboardings(ctx, escopo) } } });
  if (!anexo) return NextResponse.json({ erro: "Não encontrado" }, { status: 404 });
  return NextResponse.redirect(await urlTemporaria(anexo.caminho, anexo.nomeArquivo));
}
