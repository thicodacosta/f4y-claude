import "server-only";

import { z } from "zod";

/**
 * Chamada de IA (API Messages da Anthropic) — só no servidor, sem SDK extra.
 * Configuração no servidor: ANTHROPIC_API_KEY e IA_MODELO (nenhum modelo fixo no código).
 * Sem as duas, `iaDisponivel()` é falso e as telas mostram o recurso indisponível.
 */
export class ErroIa extends Error {}

export const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY && !!process.env.IA_MODELO;

export async function completarJson<T>(p: { sistema: string; usuario: string; schema: z.ZodType<T>; maxTokens?: number }): Promise<T> {
  const chave = process.env.ANTHROPIC_API_KEY;
  const modelo = process.env.IA_MODELO;
  if (!chave || !modelo) throw new ErroIa("Nenhum serviço de IA está configurado nesta instalação.");
  let resp: Response;
  try {
    resp = await fetch(process.env.IA_URL ?? "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: modelo,
        max_tokens: p.maxTokens ?? 2000,
        system: p.sistema,
        messages: [{ role: "user", content: p.usuario }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ErroIa("Não foi possível contatar o serviço de IA. Tente novamente.");
  }
  if (!resp.ok) throw new ErroIa(`O serviço de IA recusou o pedido (HTTP ${resp.status}).`);
  const dados = (await resp.json()) as { content?: { type: string; text?: string }[] };
  const texto = dados.content?.find((c) => c.type === "text")?.text ?? "";
  const json = texto.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1");
  try {
    return p.schema.parse(JSON.parse(json));
  } catch {
    throw new ErroIa("A resposta da IA veio em formato inesperado. Tente gerar novamente.");
  }
}

/** Formato dos insights do Pulse (pedido no prompt e validado aqui). */
export const insightsSchema = z.object({
  resumo_executivo: z.string().min(1).max(3000),
  pontos_fortes: z.array(z.string().max(500)).max(10),
  pontos_atencao: z.array(z.string().max(500)).max(10),
  riscos: z.array(z.string().max(500)).max(10),
  plano_acao: z
    .array(z.object({ acao: z.string().max(500), prioridade: z.string().max(40), prazo_sugerido: z.string().max(80), responsavel_sugerido: z.string().max(120) }))
    .max(10),
});
export type InsightsPulse = z.infer<typeof insightsSchema>;
