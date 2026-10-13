/**
 * Medidor de consumo de IA (teste gratuito). Cada extensão instala o medidor
 * (auth/plano.js); as chamadas de IA (claude.js, groq.js, transcribe.js)
 * conferem antes se o plano permite e informam depois quantos tokens usaram.
 * Sem medidor instalado (ex.: pacote sem login), nada muda.
 */
let medidor = null;

export function definirMedidor(m) {
  medidor = m;
}

/** Lança erro amigável se o plano não permite usar a IA agora. */
export async function antesDaIa() {
  await medidor?.antes?.();
}

/** Informa o consumo (tokens) de uma chamada concluída. */
export function registrarTokens(tokens) {
  const n = Math.round(Number(tokens) || 0);
  if (n > 0) medidor?.depois?.(n);
}

/** Tokens de uma resposta da Anthropic (entrada, saída e cache). */
export const tokensAnthropic = (u) =>
  (u?.input_tokens ?? 0) + (u?.output_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0);

/** Estimativa quando a API não informa: ~4 caracteres por token. */
export const estimarTokens = (texto) => Math.ceil(String(texto ?? "").length / 4);
