import "server-only";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { provedorIntegracaoValues, type ProvedorIntegracao } from "@/modules/integracoes/schemas";

/** Nunca retorna accessToken/refreshToken — só o que a UI precisa pra
 * mostrar "conectado como X". Os tokens em si só são lidos dentro de
 * modules/integracoes/{gmail,whatsapp}.ts, nunca cruzam pro client. */
export async function getMinhasIntegracoes() {
  const usuario = await requireUsuario();

  const conexoes = await prisma.integracaoUsuario.findMany({
    where: { usuarioId: usuario.id },
    select: { provedor: true, contaExterna: true, conectadoEm: true },
  });
  const porProvedor = new Map(conexoes.map((c) => [c.provedor, c]));

  return provedorIntegracaoValues.map((provedor) => {
    const conexao = porProvedor.get(provedor as ProvedorIntegracao);
    return {
      provedor: provedor as ProvedorIntegracao,
      conectado: !!conexao,
      contaExterna: conexao?.contaExterna ?? null,
      conectadoEm: conexao?.conectadoEm.toISOString() ?? null,
    };
  });
}
