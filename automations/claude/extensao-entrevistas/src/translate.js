/** Tradução do registro de entrevista (inglês ou espanhol) via Groq. */
import { groqStructured } from "./groq.js";
import { INTERVIEW_OUTPUT_FORMAT } from "./schema.js";

const TARGET = { en: "inglês (en-US)", es: "espanhol (es)" };

const SYSTEM_PROMPT = `Você é tradutor profissional de uma consultoria de Recruitment & Executive Search. Traduza registros de entrevista do português para o idioma pedido, com tom consultivo e corporativo.

REGRAS
- Traduza todos os textos, mantendo exatamente a mesma estrutura, a mesma quantidade de itens e os mesmos null.
- Não acrescente, não remova e não reinterprete informações. Não resuma.
- Mantenha como estão: nomes de pessoas e empresas, siglas, tecnologias, certificações e valores monetários (ex.: R$ 12.000).
- Datas e períodos: traduza apenas as palavras (ex.: "3 anos" → "3 years").
- Trechos literais da transcrição (trechoTranscricao): traduza também, fielmente. Nenhum texto pode ficar em português.
- Linguagem de evidência continua de evidência (ex.: "demonstrou" → "demonstrated").`;

export function translateRecord({ apiKey, data, lang, signal }) {
  return groqStructured({
    apiKey,
    system: SYSTEM_PROMPT,
    user: `Traduza para ${TARGET[lang]} o registro abaixo (JSON):\n\n${JSON.stringify(data)}`,
    name: "registro_traduzido",
    schema: INTERVIEW_OUTPUT_FORMAT.schema,
    reasoningEffort: "low",
    signal,
  });
}
