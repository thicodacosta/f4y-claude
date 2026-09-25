import Anthropic from "@anthropic-ai/sdk";
import { INTERVIEW_OUTPUT_FORMAT } from "./schema.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

export const MODEL = "claude-opus-5";

/** Erro com mensagem já pronta para exibir ao recrutador. */
export class AnalysisError extends Error {}

/**
 * Envia a transcrição ao Claude e devolve o registro estruturado (objeto no
 * formato de `analyze_interview`). Usa streaming porque transcrições longas
 * com raciocínio adaptativo podem passar do tempo limite de uma requisição
 * comum.
 */
export async function analyzeInterview({ apiKey, input, signal }) {
  // A chave é a do próprio recrutador, guardada só no navegador dele
  // (chrome.storage.local). O SDK exige a confirmação explícita para rodar
  // fora de um servidor.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let message;
  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: INTERVIEW_OUTPUT_FORMAT },
        // Se os filtros de segurança do modelo recusarem o pedido, a própria
        // API refaz a chamada no modelo substituto recomendado.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(input) }],
      },
      { signal },
    );
    message = await stream.finalMessage();
  } catch (error) {
    throw toAnalysisError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new AnalysisError(
      "O modelo recusou processar esta transcrição. Revise o conteúdo e tente novamente.",
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new AnalysisError("A resposta ficou incompleta. Tente novamente.");
  }

  const text = message.content.find((block) => block.type === "text")?.text;
  if (!text) throw new AnalysisError("O modelo não devolveu um registro.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AnalysisError("O registro devolvido não está em um formato válido. Tente novamente.");
  }
}

function toAnalysisError(error) {
  if (error instanceof Anthropic.APIUserAbortError) {
    return new AnalysisError("Análise cancelada.");
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AnalysisError("Chave de API inválida ou sem permissão. Revise a chave nas configurações.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AnalysisError("Limite de uso da API atingido. Aguarde alguns instantes e tente novamente.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AnalysisError(`A API rejeitou a requisição: ${error.message}`);
  }
  if (error instanceof Anthropic.InternalServerError) {
    return new AnalysisError("A API está instável no momento. Tente novamente em instantes.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AnalysisError("Não foi possível conectar à API. Verifique sua conexão.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AnalysisError(`Erro da API (${error.status ?? "sem status"}): ${error.message}`);
  }
  return error;
}
