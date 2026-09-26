import { isClaudeUnavailable, requestStructured } from "./claude.js";
import { FriendlyError } from "./errors.js";
import { groqStructured } from "./groq.js";
import { INTERVIEW_OUTPUT_FORMAT } from "./schema.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

export { FriendlyError as AnalysisError } from "./errors.js";

/**
 * Envia a transcrição à IA e devolve o registro estruturado (formato
 * `analyze_interview`). Usa o Claude; se a Anthropic estiver indisponível para
 * a conta (sem crédito, chave ou cota), usa a Groq com o mesmo prompt e schema.
 */
export async function analyzeInterview({ apiKey, groqKey, input, signal }) {
  const system = SYSTEM_PROMPT;
  const user = buildUserMessage(input);

  if (apiKey) {
    try {
      return await requestStructured({ apiKey, system, content: user, format: INTERVIEW_OUTPUT_FORMAT, signal });
    } catch (error) {
      if (!groqKey || !isClaudeUnavailable(error)) throw error;
      console.warn("Anthropic indisponível; gerando o registro pela Groq.", error.message);
    }
  }
  if (!groqKey) throw new FriendlyError("Cadastre uma chave da Anthropic ou da Groq em Configurações.");
  return groqStructured({
    apiKey: groqKey,
    system,
    user,
    name: "registro_entrevista",
    schema: INTERVIEW_OUTPUT_FORMAT.schema,
    signal,
  });
}
