/**
 * Módulos reaproveitados da ToolsKit (../extensao-entrevistas). Único ponto
 * de importação: se a ToolsKit mudar de estrutura, só este arquivo muda.
 */
export { authConfigured, supabase, currentUser } from "../../../extensao-entrevistas/src/auth/client.js";
export { logout, requireAuth } from "../../../extensao-entrevistas/src/auth/gate.js";
export { initTheme, effectiveTheme } from "../../../extensao-entrevistas/src/theme.js";
export { initHeader } from "../../../extensao-entrevistas/src/header.js";
export { loadKeys, hasEmbeddedKeys } from "../../../extensao-entrevistas/src/keys.js";
export { FriendlyError } from "../../../extensao-entrevistas/src/errors.js";
export { requestStructured, isClaudeUnavailable } from "../../../extensao-entrevistas/src/claude.js";
export { groqStructured, stripCitations } from "../../../extensao-entrevistas/src/groq.js";
export { prepareAttachment, sendChat } from "../../../extensao-entrevistas/src/chat/engine.js";
export { cltTermination, pjTermination, replacementCosts, sum, DEFAULT_CLT_COST_FACTOR } from "../../../extensao-entrevistas/src/turnover/calc.js";
export { saveBlob, formatBRL, normalize } from "../../../extensao-entrevistas/src/ui.js";
