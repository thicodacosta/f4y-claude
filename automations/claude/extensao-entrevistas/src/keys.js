/**
 * Chaves de API: as cadastradas em Configurações (neste navegador) têm
 * prioridade; senão valem as embutidas no pacote pelo build (.env.local).
 */

// Substituídas pelo esbuild (build.mjs → define).
export const EMBEDDED_KEYS = {
  anthropic: __EMBEDDED_ANTHROPIC_KEY__,
  groq: __EMBEDDED_GROQ_KEY__,
};

export const hasEmbeddedKeys = Boolean(EMBEDDED_KEYS.anthropic);

/** Chaves efetivas no formato usado pelo painel: { apiKey, groqKey }. */
export async function loadKeys() {
  const stored = await chrome.storage.local.get(["apiKey", "groqKey"]);
  return {
    apiKey: stored.apiKey || EMBEDDED_KEYS.anthropic || undefined,
    groqKey: stored.groqKey || EMBEDDED_KEYS.groq || undefined,
  };
}
