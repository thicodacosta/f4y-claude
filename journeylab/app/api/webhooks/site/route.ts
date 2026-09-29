import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { dbPlataforma } from "@/lib/db";
import { processarRecebido, SISTEMA } from "@/lib/integracoes/processar";
import type { Prisma } from "@/lib/generated/prisma/client";

const LIMITE_BYTES = 64 * 1024;

/**
 * Compras pelo site JourneyLab. Contrato:
 *   POST /api/webhooks/site
 *   Cabeçalho x-journeylab-assinatura: hex(HMAC-SHA256(SITE_WEBHOOK_SECRET, corpo bruto))
 *   Corpo: { "pedido_id", "tipo" (aprovado|renovacao|reembolso|chargeback|cancelamento),
 *            "produto_id", "email", "documento" }
 * Mesmo fluxo da Kiwify: grava, interpreta e aguarda revisão (ou aplica, se automático).
 */
export async function POST(request: NextRequest) {
  const segredo = process.env.SITE_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ erro: "Integração do site não configurada." }, { status: 503 });
  const bruto = await request.text();
  if (Buffer.byteLength(bruto) > LIMITE_BYTES) return NextResponse.json({ erro: "Corpo muito grande" }, { status: 413 });
  const recebida = Buffer.from(request.headers.get("x-journeylab-assinatura") ?? "", "utf8");
  const esperada = Buffer.from(createHmac("sha256", segredo).update(bruto).digest("hex"), "utf8");
  const assinada = recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  let corpo: unknown = null;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    corpo = null;
  }
  const evento = await dbPlataforma(SISTEMA).eventoIntegracao.create({
    data: {
      canal: "site",
      corpo: corpo === null ? undefined : (corpo as Prisma.InputJsonValue),
      corpoBruto: corpo === null ? bruto.slice(0, 5000) : null,
      tokenConferido: assinada,
      status: assinada && corpo ? "recebido" : "ignorado",
      erro: !assinada ? "Assinatura inválida." : !corpo ? "Corpo inválido." : null,
    },
  });
  if (!assinada) return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });
  after(async () => {
    try {
      await processarRecebido(evento.id);
    } catch (e) {
      await dbPlataforma(SISTEMA).eventoIntegracao.update({ where: { id: evento.id }, data: { status: "erro", erro: e instanceof Error ? e.message.slice(0, 500) : "Falha no processamento." } });
    }
  });
  return NextResponse.json({ recebido: true });
}
