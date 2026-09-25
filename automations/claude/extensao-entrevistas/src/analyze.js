import { requestStructured } from "./claude.js";
import { INTERVIEW_OUTPUT_FORMAT } from "./schema.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

export { ClaudeError as AnalysisError } from "./claude.js";

/**
 * Envia a transcrição ao Claude e devolve o registro estruturado (objeto no
 * formato de `analyze_interview`).
 */
export function analyzeInterview({ apiKey, input, signal }) {
  return requestStructured({
    apiKey,
    system: SYSTEM_PROMPT,
    content: buildUserMessage(input),
    format: INTERVIEW_OUTPUT_FORMAT,
    signal,
  });
}
