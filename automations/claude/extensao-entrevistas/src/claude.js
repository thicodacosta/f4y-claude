import Anthropic from "@anthropic-ai/sdk";
import { FriendlyError } from "./errors.js";

export const MODEL = "claude-opus-5";

/**
 * Erro com mensagem já pronta para exibir ao usuário. `code` indica quando a
 * Anthropic está indisponível para esta conta ("credits", "auth", "rate") e
 * vale tentar outro provedor.
 */
export class ClaudeError extends FriendlyError {
  constructor(message, code = null) {
    super(message);
    this.code = code;
  }
}

/** A Anthropic não pode atender agora (sem crédito, chave ou cota)? */
export const isClaudeUnavailable = (error) =>
  error instanceof ClaudeError && ["credits", "auth", "rate"].includes(error.code);

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

// Pausas do laço de ferramentas do servidor (busca web) a retomar antes de
// desistir.
const MAX_CONTINUATIONS = 5;

/**
 * Para tarefas com ferramentas do servidor (ex.: busca web): o Claude
 * pesquisa e, ao terminar, chama `resultTool` com o resultado estruturado.
 * Saída estruturada (`output_config.format`) não combina com as citações da
 * busca web, por isso o resultado chega como argumento de uma ferramenta.
 */
export async function requestToolResult({ apiKey, system, content, tools, resultTool, effort = "high", onProgress, signal }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const messages = [{ role: "user", content }];
  const allTools = [...tools, { ...resultTool, strict: true, eager_input_streaming: true }];

  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    let message;
    try {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 64000,
          thinking: { type: "adaptive" },
          output_config: { effort },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system,
          tools: allTools,
          messages,
        },
        { signal },
      );
      // Avisa o que está sendo pesquisado, para a espera não parecer travada.
      if (onProgress) {
        stream.on("contentBlock", (block) => {
          if (block.type === "server_tool_use") onProgress({ tool: block.name, input: block.input });
        });
      }
      message = await stream.finalMessage();
    } catch (error) {
      throw toClaudeError(error);
    }

    if (message.stop_reason === "refusal") {
      throw new ClaudeError("O modelo recusou esta solicitação. Revise os dados e tente novamente.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new ClaudeError("A resposta ficou incompleta. Tente novamente.");
    }
    if (message.stop_reason === "pause_turn") {
      // O servidor pausou o laço de busca: reenviar a resposta parcial retoma
      // de onde parou.
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const call = message.content.find((b) => b.type === "tool_use" && b.name === resultTool.name);
    if (call && call.input && typeof call.input === "object") return call.input;
    throw new ClaudeError("A pesquisa não foi concluída. Tente novamente.");
  }
  throw new ClaudeError("A pesquisa demorou mais que o esperado. Tente novamente.");
}

function toClaudeError(error) {
  // Erros que chegam no meio do streaming vêm sem status HTTP; o tipo e a
  // mensagem ficam no corpo do erro.
  const apiMessage = error?.error?.error?.message ?? "";
  if (/credit balance/i.test(apiMessage)) {
    return new ClaudeError(
      "Os créditos da API da Anthropic acabaram. Recarregue em console.anthropic.com → Plans & Billing.",
      "credits",
    );
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ClaudeError("Operação cancelada.");
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError("Chave de API da Anthropic inválida ou sem permissão. Revise a chave nas configurações.", "auth");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ClaudeError("Limite de uso da API atingido. Aguarde alguns instantes e tente novamente.", "rate");
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
