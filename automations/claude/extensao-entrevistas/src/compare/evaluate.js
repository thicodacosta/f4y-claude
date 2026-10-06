/**
 * Comparativo de candidatos: 2 a 5 currículos frente à JD, via Groq, com o
 * método único de avaliação (method.js), o mesmo da Shortlist.
 */
import { fileToText } from "../text-extract.js";
import { evaluateCandidates, extractRequirements } from "./method.js";

/**
 * Compara 2 a 5 currículos com a JD. `jd` é `{ text }` ou `{ file }`. O texto
 * dos arquivos é extraído no navegador. Devolve { vaga, requisitos,
 * candidatos, sintese }, com os candidatos do mais para o menos compatível.
 */
export async function compareCandidates({ apiKey, jd, cvFiles, signal }) {
  const jdText = jd.file ? await fileToText(jd.file) : jd.text.trim();
  const [{ vaga, requisitos }, cvTexts] = await Promise.all([
    extractRequirements({ apiKey, jdText, signal }),
    Promise.all(cvFiles.map(fileToText)),
  ]);
  const { candidatos, sintese } = await evaluateCandidates({
    apiKey,
    vaga,
    requisitos,
    candidatos: cvTexts.map((texto, i) => ({ rotulo: cvFiles[i].name, texto })),
    signal,
  });
  return {
    vaga,
    requisitos,
    sintese,
    candidatos: candidatos
      .map((c) => ({ ...c, arquivo: cvFiles[c.ordem - 1]?.name ?? null }))
      .sort((a, b) => b.compatibilidade - a.compatibilidade),
  };
}
