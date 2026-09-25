/**
 * Cliente da API de chat da Groq (compatível com a da OpenAI). Usado pelo
 * comparativo e pela pesquisa salarial: modelos abertos rodando no hardware da
 * Groq, com respostas em poucos segundos.
 */
import { FriendlyError } from "./errors.js";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "openai/gpt-oss-120b";
// Modelo menor para tarefas simples de formatação: mais rápido e com cota
// de uso separada do 120b.
export const GROQ_FAST_MODEL = "openai/gpt-oss-20b";
const MAX_ATTEMPTS = 4;

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new FriendlyError("Operação cancelada."));
    });
  });

/** Uma chamada ao chat, com novas tentativas em limite de taxa e instabilidade. */
async function chat({ apiKey, body, signal, model = GROQ_MODEL }) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, ...body }),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new FriendlyError("Operação cancelada.");
      if (attempt >= MAX_ATTEMPTS) throw new FriendlyError("Não foi possível conectar à Groq. Verifique sua conexão.");
      await sleep(1500 * attempt, signal);
      continue;
    }

    if (res.ok) return res.json();

    const detail = await res.text();
    // Detalhe técnico só no console (Inspecionar), para diagnóstico.
    console.error(`Groq ${res.status}`, detail);
    if (res.status === 401 || res.status === 403) {
      throw new FriendlyError("A chave da Groq é inválida ou não tem permissão. Revise em Configurações.");
    }
    // Falha ocasional da saída estruturada ("failed to generate JSON"):
    // uma nova tentativa costuma resolver.
    const transientJson = res.status === 400 && /json_validate_failed|failed to generate/i.test(detail);
    if ((res.status === 429 || res.status >= 500 || transientJson) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * attempt, signal);
      continue;
    }
    if (res.status === 429) {
      throw new FriendlyError("Limite de uso da Groq atingido. Aguarde alguns instantes e tente novamente.");
    }
    if (res.status === 413 || /context|too large|maximum/i.test(detail)) {
      throw new FriendlyError("O conteúdo enviado é grande demais. Envie menos arquivos ou textos mais curtos.");
    }
    throw new FriendlyError(`A Groq respondeu com erro (${res.status}). Tente novamente.`);
  }
}

/**
 * Resposta em JSON garantida pelo schema (saída estruturada estrita da Groq).
 * O schema precisa ter todos os campos em `required` e
 * `additionalProperties: false` em todos os objetos.
 */
export async function groqStructured({ apiKey, system, user, name, schema, reasoningEffort = "medium", model, signal }) {
  const data = await chat({
    apiKey,
    signal,
    model,
    body: {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      reasoning_effort: reasoningEffort,
      max_completion_tokens: 32000,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    },
  });
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new FriendlyError("A resposta ficou incompleta. Tente novamente.");
  try {
    return JSON.parse(choice?.message?.content ?? "");
  } catch {
    throw new FriendlyError("A resposta não veio em um formato válido. Tente novamente.");
  }
}

/**
 * Pesquisa na web com a ferramenta de busca da Groq. Devolve o texto da
 * resposta e as páginas consultadas (quando a API as informa).
 */
export async function groqWebResearch({ apiKey, system, user, reasoningEffort = "low", signal }) {
  const data = await chat({
    apiKey,
    signal,
    body: {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      reasoning_effort: reasoningEffort,
      max_completion_tokens: 8000,
      tool_choice: "required",
      tools: [{ type: "browser_search" }],
    },
  });
  const message = data.choices?.[0]?.message ?? {};
  // Resultados das buscas, com título e URL, quando a Groq os devolve.
  const pages = (message.executed_tools ?? [])
    .flatMap((tool) => tool.search_results?.results ?? [])
    .map((r) => ({ title: r.title ?? "", url: r.url ?? "" }))
    .filter((r) => r.url);
  if (!message.content?.trim()) throw new FriendlyError("A pesquisa não trouxe resultados. Tente novamente.");
  return { text: message.content, pages };
}
