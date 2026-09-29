import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { dbPlataforma } from "@/lib/db";
import { processarRecebido, SISTEMA } from "@/lib/integracoes/processar";
import type { Prisma } from "@/lib/generated/prisma/client";

const LIMITE_BYTES = 256 * 1024;
const CABECALHOS = ["content-type", "user-agent", "x-forwarded-for", "x-real-ip"];

function tokenPresente(token: string, valores: unknown[]): boolean {
  const alvo = Buffer.from(token);
  const visitar = (v: unknown): boolean => {
    if (typeof v === "string") {
      const b = Buffer.from(v);
      return b.length === alvo.length && timingSafeEqual(b, alvo);
    }
    if (Array.isArray(v)) return v.some(visitar);
    if (v && typeof v === "object") return Object.values(v).some(visitar);
    return false;
  };
  return valores.some(visitar);
}

/**
 * Recebe eventos da Kiwify: grava primeiro (auditoria) e depois interpreta
 * (lib/integracoes/processar.ts). Por padrão a ativação fica para revisão do
 * superadmin; a automática exige INTEGRACAO_ATIVACAO_AUTOMATICA=true e token
 * conferido. O corpo do webhook nunca é, sozinho, prova de compra.
 */
export async function POST(request: NextRequest) {
  const bruto = await request.text();
  if (Buffer.byteLength(bruto) > LIMITE_BYTES) return NextResponse.json({ erro: "Corpo muito grande" }, { status: 413 });
  let corpo: unknown = null;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    corpo = null;
  }
  const cabecalhos = Object.fromEntries(CABECALHOS.flatMap((h) => (request.headers.get(h) ? [[h, request.headers.get(h)]] : [])));
  const cabecalhosX = [...request.headers.entries()].filter(([k]) => k.startsWith("x-") && !CABECALHOS.includes(k));
  const consulta = request.nextUrl.searchParams;
  const token = process.env.KIWIFY_WEBHOOK_TOKEN;
  const tokenConferido = token ? tokenPresente(token, [[...consulta.values()], cabecalhosX.map(([, v]) => v), corpo]) : null;

  const evento = await dbPlataforma(SISTEMA).eventoIntegracao.create({
    data: {
      canal: "kiwify",
      corpo: corpo === null ? undefined : (corpo as Prisma.InputJsonValue),
      corpoBruto: corpo === null ? bruto.slice(0, 5000) : null,
      cabecalhos: { ...cabecalhos, parametros_x: cabecalhosX.map(([k]) => k) },
      consulta: [...consulta.keys()].join(",") || null,
      tokenConferido,
      status: tokenConferido === false ? "ignorado" : "recebido",
      erro: tokenConferido === false ? "Token do webhook não conferido." : null,
    },
  });
  if (evento.status === "recebido") {
    after(async () => {
      try {
        await processarRecebido(evento.id);
      } catch (e) {
        await dbPlataforma(SISTEMA).eventoIntegracao.update({ where: { id: evento.id }, data: { status: "erro", erro: e instanceof Error ? e.message.slice(0, 500) : "Falha no processamento." } });
      }
    });
  }
  return NextResponse.json({ recebido: true });
}
