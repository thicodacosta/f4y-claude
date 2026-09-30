"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { dentroDoLimite } from "@/lib/limite";
import { conviteNr1DoToken } from "./links";
import { plataformaNr1 } from "./publico";

/**
 * Recebimento público (sem login). Validações no servidor: link assinado,
 * limite de tentativas por IP e por link, formato das respostas; o banco
 * (jl_registrar_resposta_nr1) confere status, período, módulo, departamento,
 * questionário completo e uso único — tudo numa transação.
 */
export async function responderNr1Publico(token: string, areaId: string | null, respostasJson: string): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!dentroDoLimite(`nr1:ip:${ip}`, 20, 10 * 60_000)) return { erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    const conviteId = conviteNr1DoToken(token);
    if (!conviteId) return { erro: "Link inválido. Use o link recebido por e-mail." };
    if (!dentroDoLimite(`nr1:convite:${conviteId}`, 5, 10 * 60_000)) return { erro: "Muitas tentativas com este link. Aguarde alguns minutos." };
    const area = z.string().uuid().nullable().parse(areaId || null);
    let respostas: Record<string, number | null>;
    try {
      respostas = z.record(z.string().uuid(), z.number().int().min(1).max(5).nullable()).parse(JSON.parse(respostasJson));
    } catch {
      return { erro: "Respostas inválidas. Revise o formulário." };
    }
    await transacao(plataformaNr1, (tx) => tx.$executeRaw`select public.jl_registrar_resposta_nr1(${conviteId}::uuid, ${area}::uuid, ${JSON.stringify(respostas)}::jsonb)`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const doBanco = msg.match(/JL: ([^\n"]+)/);
    return { erro: doBanco ? doBanco[1].trim() : "Não foi possível registrar sua resposta. Tente novamente em instantes." };
  }
}
