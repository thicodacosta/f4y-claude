import { NextResponse } from "next/server";
import { dbUsuario } from "@/lib/db";
import { getUsuario } from "@/lib/contexto";

/** Portabilidade (LGPD art. 18, V): dados da conta do próprio usuário. */
export async function GET() {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const dados = await dbUsuario(usuario.id).usuario.findUnique({
    where: { id: usuario.id },
    include: { consentimentos: true, associacoes: { select: { tenantId: true, status: true, criadoEm: true, organizacao: { select: { nome: true } } } } },
  });
  return new NextResponse(JSON.stringify({ exportadoEm: new Date().toISOString(), conta: dados }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="minha-conta-journeylab.json"',
      "Cache-Control": "no-store",
    },
  });
}
