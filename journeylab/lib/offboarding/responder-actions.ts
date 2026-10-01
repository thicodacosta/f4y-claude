"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { dentroDoLimite } from "@/lib/limite";
import { entrevistaDoToken } from "./links";
import { plataformaOffboarding, validarEntrevista } from "./publico";
import { gravarRespostas } from "./servico";

/**
 * Recebimento público da entrevista de desligamento (sem login). Validações no
 * servidor: link assinado e do envio vigente, prazo, módulo ativo, limite de
 * tentativas por IP e por link, formato das respostas e uso único — tudo na
 * mesma transação da gravação.
 */
export async function responderEntrevistaPublica(token: string, respostasJson: string): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!dentroDoLimite(`offboarding:ip:${ip}`, 20, 10 * 60_000)) return { erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    const t = entrevistaDoToken(token);
    if (!t) return { erro: "Link inválido. Use o link recebido por e-mail." };
    if (!dentroDoLimite(`offboarding:link:${t.id}`, 5, 10 * 60_000)) return { erro: "Muitas tentativas com este link. Aguarde alguns minutos." };
    let json: unknown;
    try {
      json = JSON.parse(respostasJson);
    } catch {
      return { erro: "Respostas inválidas. Revise o formulário." };
    }
    return await transacao(plataformaOffboarding, async (tx) => {
      const v = await validarEntrevista(tx, token);
      if (!v) return { erro: "Link inválido ou substituído por um envio mais recente." };
      if (v.r.entrevistaStatus === "respondida") return { erro: "Esta entrevista já foi respondida. Obrigado!" };
      if (v.r.entrevistaStatus !== "enviada" || (v.r.entrevistaExpiraEm && v.r.entrevistaExpiraEm < new Date())) return { erro: "O prazo para responder terminou." };
      // Bloqueio da linha: duas submissões simultâneas não gravam duas vezes.
      await tx.$queryRaw`select id from desligamentos where id = ${v.r.id}::uuid for update`;
      const atual = await tx.desligamento.findUnique({ where: { id: v.r.id }, select: { entrevistaStatus: true } });
      if (atual?.entrevistaStatus === "respondida") return { erro: "Esta entrevista já foi respondida. Obrigado!" };
      await gravarRespostas(tx, v.r.id, json, "link");
      await auditar(tx, { tenantId: v.r.tenantId, usuario: { id: plataformaOffboarding.usuarioId, nome: "Entrevista de desligamento (link)" }, acao: "offboarding.entrevista.respondida", entidade: "desligamento", entidadeId: v.r.id });
      return { ok: true };
    });
  } catch (e) {
    if (e instanceof z.ZodError) return { erro: e.issues[0].message };
    return { erro: "Não foi possível registrar sua resposta. Tente novamente em instantes." };
  }
}
