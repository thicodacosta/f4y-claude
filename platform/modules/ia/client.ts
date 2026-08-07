import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/** Camada fina sobre a API da Anthropic — ver docs/business-platform/
 * arquitetura.md, seção de stack ("IA | Claude via API (Anthropic)"). Nunca
 * importar de um Client Component; a chave só existe no servidor. */
export const MODELO_IA = "claude-sonnet-5";

export function createIaClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Extrai o primeiro bloco de texto da resposta — todas as chamadas deste
 * módulo pedem JSON puro (sem tool use), então isto é sempre o payload. */
export function textoDaResposta(message: Anthropic.Message): string {
  const bloco = message.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") {
    throw new Error("Resposta da IA não trouxe conteúdo de texto.");
  }
  return bloco.text;
}

/** As respostas pedem JSON estrito (via instrução de prompt), mas o modelo
 * às vezes embrulha em ```json apesar da instrução — remove a cerca de
 * markdown antes de tentar o parse, em vez de confiar só na instrução. */
export function parseJsonDaResposta<T>(message: Anthropic.Message): T {
  const bruto = textoDaResposta(message).trim();
  const semCerca = bruto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(semCerca) as T;
  } catch {
    throw new Error("Resposta da IA não veio em JSON válido.");
  }
}
