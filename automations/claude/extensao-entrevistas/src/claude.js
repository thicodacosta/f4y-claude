import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5";

/** Erro com mensagem já pronta para exibir ao usuário. */
export class ClaudeError extends Error {}

/**
 * Pede ao Claude uma resposta no formato JSON do `format` informado e devolve
 * o objeto já convertido. Usa streaming porque entradas longas com
 * raciocínio adaptativo podem passar do tempo limite de uma requisição comum.
 */
export async function requestStructured({ apiKey, system, content, format, effort = "high", signal }) {
  // A chave é a do próprio usuário, guardada só no navegador dele
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
        output_config: { effort, format },
        // Se os filtros de segurança do modelo recusarem o pedido, a própria
        // API refaz a chamada no modelo substituto recomendado.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content }],
      },
      { signal },
    );
    message = await stream.finalMessage();
  } catch (error) {
    throw toClaudeError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new ClaudeError("O modelo recusou processar este conteúdo. Revise o material e tente novamente.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ClaudeError("A resposta ficou incompleta. Tente novamente.");
  }

  const text = message.content.find((block) => block.type === "text")?.text;
  if (!text) throw new ClaudeError("O modelo não devolveu uma resposta.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ClaudeError("A resposta não veio em um formato válido. Tente novamente.");
  }
}

function toClaudeError(error) {
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ClaudeError("Operação cancelada.");
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError("Chave de API da Anthropic inválida ou sem permissão. Revise a chave nas configurações.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ClaudeError("Limite de uso da API atingido. Aguarde alguns instantes e tente novamente.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ClaudeError(`A API rejeitou a requisição: ${error.message}`);
  }
  if (error instanceof Anthropic.InternalServerError) {
    return new ClaudeError("A API está instável no momento. Tente novamente em instantes.");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ClaudeError("Não foi possível conectar à API. Verifique sua conexão.");
  }
  if (error instanceof Anthropic.APIError) {
    return new ClaudeError(`Erro da API (${error.status ?? "sem status"}): ${error.message}`);
  }
  return error;
}
