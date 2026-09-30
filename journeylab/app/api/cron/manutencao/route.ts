import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { transacao } from "@/lib/db";
import { alterarEntitlement } from "@/lib/entitlements";
import { executarRetencao } from "@/lib/retencao";
import { SISTEMA } from "@/lib/integracoes/processar";
import { rotinaPulse } from "@/lib/pulse/rotina";
import { rotinaNr1 } from "@/lib/nr1/rotina";

export const dynamic = "force-dynamic";

function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Rotina diária (a Vercel Cron envia Authorization: Bearer CRON_SECRET):
 *  1. marca como "expirado" o módulo cujo período terminou (com histórico —
 *     o acesso já era bloqueado pela data; os dados são preservados);
 *  2. aplica a política de retenção de cada organização que a configurou;
 *  3. Pulse: encerra pesquisas vencidas e envia o lembrete automático;
 *  4. Diagnóstico NR-1: encerra diagnósticos cuja data de fim passou.
 */
export async function GET(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const sistema = { id: SISTEMA, nome: "Rotina diária JourneyLab" };
  const plataforma = { escopo: "plataforma" as const, usuarioId: SISTEMA };

  const expirados = await transacao(plataforma, async (tx) => {
    const vencidos = await tx.entitlement.findMany({ where: { status: { in: ["ativo", "teste"] }, fim: { lt: new Date() } } });
    for (const e of vencidos) {
      await alterarEntitlement(tx, { tenantId: e.tenantId, modulo: e.modulo, status: "expirado", origem: "sistema", responsavel: sistema, motivo: "Período de acesso encerrado." });
    }
    return vencidos.length;
  });

  const politicas = await transacao(plataforma, (tx) => tx.politicaRetencao.findMany({ select: { tenantId: true } }));
  const retencao: Record<string, unknown> = {};
  for (const p of politicas) {
    try {
      retencao[p.tenantId] = await executarRetencao(plataforma, p.tenantId, false, sistema);
    } catch (e) {
      retencao[p.tenantId] = { erro: e instanceof Error ? e.message : "falha" };
    }
  }
  let pulse: unknown;
  try {
    pulse = await rotinaPulse(plataforma, sistema);
  } catch (e) {
    pulse = { erro: e instanceof Error ? e.message : "falha" };
  }
  let nr1: unknown;
  try {
    nr1 = await rotinaNr1(plataforma, sistema);
  } catch (e) {
    nr1 = { erro: e instanceof Error ? e.message : "falha" };
  }
  return NextResponse.json({ expirados, retencao, pulse, nr1 });
}
