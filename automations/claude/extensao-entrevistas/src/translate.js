/**
 * Tradução do registro de entrevista (inglês ou espanhol) via Groq.
 *
 * Só os textos vão para a IA, numerados, sem os nomes dos campos: ao traduzir
 * o JSON inteiro, o modelo também traduzia as chaves (ex.:
 * "competenciasComportamentais" → "competenciasComportamentales" em espanhol)
 * e a resposta era recusada pelo schema. A estrutura é remontada aqui.
 */
import { FriendlyError } from "./errors.js";
import { groqStructured } from "./groq.js";
import { toStructuredSchema } from "./schema.js";

const TARGET = { en: "inglês (en-US)", es: "espanhol (es)" };

// Campos que não se traduzem: nomes próprios de empresas.
const KEEP = new Set(["empresa"]);

const SYSTEM_PROMPT = `Você é tradutor profissional de uma consultoria de Recruitment & Executive Search. Traduz trechos de registros de entrevista do português para o idioma pedido, com tom consultivo e corporativo.

REGRAS
- Recebe uma lista numerada de textos e devolve a tradução de cada um, na mesma ordem e na mesma quantidade.
- Não acrescente, não remova e não reinterprete informações. Não resuma nem junte itens.
- Mantenha como estão: nomes de pessoas e empresas, siglas, tecnologias, certificações e valores monetários (ex.: R$ 12.000).
- Datas e períodos: traduza apenas as palavras (ex.: "3 anos" → "3 years").
- Trechos literais da fala do candidato: traduza fielmente. Nenhum texto pode ficar em português.
- Linguagem de evidência continua de evidência (ex.: "demonstrou" → "demonstrated").`;

const SCHEMA = toStructuredSchema({
  type: "object",
  properties: { traducoes: { type: "array", items: { type: "string" } } },
  required: ["traducoes"],
});

/** Caminhos e valores de todos os textos traduzíveis do registro. */
function collectTexts(value, path = [], out = []) {
  if (typeof value === "string") {
    if (value.trim() && !KEEP.has(path.at(-1))) out.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectTexts(item, [...path, i], out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectTexts(item, [...path, key], out);
  }
  return out;
}

function setAt(target, path, value) {
  let node = target;
  for (const key of path.slice(0, -1)) node = node[key];
  node[path.at(-1)] = value;
}

async function translateTexts({ apiKey, texts, lang, signal }) {
  const { traducoes } = await groqStructured({
    apiKey,
    system: SYSTEM_PROMPT,
    user: `Traduza para ${TARGET[lang]} os ${texts.length} textos abaixo. Devolva exatamente ${texts.length} traduções, na mesma ordem.\n\n${JSON.stringify(texts)}`,
    name: "textos_traduzidos",
    schema: SCHEMA,
    reasoningEffort: "low",
    signal,
  });
  return traducoes;
}

export async function translateRecord({ apiKey, data, lang, signal }) {
  const entries = collectTexts(data);
  const texts = entries.map((e) => e.text);
  let translated = await translateTexts({ apiKey, texts, lang, signal });
  // Lista de tamanho diferente: tenta mais uma vez antes de desistir.
  if (translated.length !== texts.length) translated = await translateTexts({ apiKey, texts, lang, signal });
  if (translated.length !== texts.length) throw new FriendlyError("A tradução veio incompleta. Tente novamente.");

  const result = structuredClone(data);
  entries.forEach((entry, i) => setAt(result, entry.path, translated[i]));
  return result;
}
