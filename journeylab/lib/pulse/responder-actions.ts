"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { carregarParaResponder, cookieLinkAberto, plataforma } from "./publico";
import { normalizarResposta, type Linha, type ValorResposta } from "./perguntas";


/**
 * Envio público (sem login obrigatório). A identidade vem do link pessoal ou da
 * sessão — nunca do formulário. Cada resposta é validada pelo tipo; a gravação
 * (e as garantias de prazo, audiência, duplicidade e anonimato) é da função do
 * banco jl_registrar_resposta_pulse.
 */
export async function responderPesquisaPublica(pesquisaId: string, token: string | null, respostasJson: string): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const id = z.string().uuid().parse(pesquisaId);
    const carga = await carregarParaResponder(id, token);
    if (!carga) return { erro: "Pesquisa não encontrada." };
    if (carga.situacao !== "ativa") return { erro: carga.situacao === "encerrada" ? "Esta pesquisa está encerrada." : "Esta pesquisa ainda não começou." };
    if (carga.respondente.modo === "negado") return { erro: carga.naAudiencia ? "Use o link pessoal enviado por e-mail para responder." : "Você não faz parte do público desta pesquisa." };
    if (carga.jaRespondeu) return { erro: "Você já respondeu esta pesquisa. Obrigado!" };
    const jar = await cookies();
    if (carga.respondente.modo === "aberto" && jar.get(cookieLinkAberto(id))) return { erro: "Este navegador já enviou uma resposta para esta pesquisa." };

    let respostas: Record<string, ValorResposta>;
    try {
      respostas = z.record(z.string(), z.any()).parse(JSON.parse(respostasJson));
    } catch {
      return { erro: "Não foi possível ler suas respostas. Recarregue a página." };
    }
    const linhas: Linha[] = [];
    for (const p of carga.perguntas) {
      const r = normalizarResposta(p, respostas[p.dbId]);
      if ("erro" in r) return { erro: r.erro };
      linhas.push(...r.linhas);
    }
    if (!linhas.length) return { erro: "Responda ao menos uma pergunta." };

    await transacao(plataforma, (tx) => tx.$executeRaw`select public.jl_registrar_resposta_pulse(${id}::uuid, ${carga.respondente.colaboradorId}::uuid, ${JSON.stringify(linhas)}::jsonb)`);
    if (carga.respondente.modo === "aberto") jar.set(cookieLinkAberto(id), "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const doBanco = msg.match(/JL: ([^\n"]+)/);
    return { erro: doBanco ? doBanco[1].trim() : "Não foi possível registrar sua resposta. Tente novamente." };
  }
}
