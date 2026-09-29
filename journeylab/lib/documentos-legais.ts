import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

/**
 * Lê as minutas direto de docs/journeylab/juridico/ (fonte única, sem cópia
 * no app). Ao publicar a versão aprovada, atualize VERSAO_TERMOS /
 * VERSAO_PRIVACIDADE em lib/legal.ts para exigir novo aceite.
 */
const PASTA = path.join(process.cwd(), "..", "docs", "journeylab", "juridico");

export async function carregarDocumentoLegal(arquivo: "termos-de-uso" | "politica-de-privacidade") {
  const bruto = await readFile(path.join(PASTA, `${arquivo}.md`), "utf8");
  // Remove a nota interna de minuta (blockquote inicial) — a página mostra aviso próprio.
  const semNota = bruto.replace(/^(# .+\n)\n(?:>.*\n)+/m, "$1");
  return marked.parse(semNota, { async: false }) as string;
}
