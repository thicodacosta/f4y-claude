import "server-only";

import { NextResponse } from "next/server";
import { ErroAcesso, exigirPermissaoAcao } from "@/lib/contexto";
import type { AreaPermissao } from "@/lib/permissoes";

/** Guarda comum das rotas de exportação: módulo ativo + permissão "exportar" (com escopo). */
export async function acessoExportacao(area: AreaPermissao) {
  try {
    return { acesso: await exigirPermissaoAcao(area, "exportar"), negado: null };
  } catch (e) {
    return { acesso: null, negado: NextResponse.json({ erro: e instanceof ErroAcesso ? e.message : "Não autorizado" }, { status: 403 }) };
  }
}

export const data = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
