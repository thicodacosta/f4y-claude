/**
 * Texto de um arquivo PDF, Word (.docx) ou texto simples, extraído no próprio
 * navegador, para modelos que não leem PDF diretamente.
 */
import mammoth from "mammoth/mammoth.browser.js";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import { FriendlyError } from "./errors.js";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("dist/pdf.worker.mjs");

async function pdfToText(file) {
  // Extensões não permitem eval: o pdf.js precisa saber disso.
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const pdf = await task.promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    let line = "";
    const lines = [];
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) {
        line += " ";
      }
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n"));
  }
  await task.destroy();
  return pages.join("\n\n");
}

export async function fileToText(file) {
  const name = file.name.toLowerCase();
  let text;
  if (name.endsWith(".pdf") || file.type === "application/pdf") text = await pdfToText(file);
  else if (name.endsWith(".docx")) text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  else if (name.endsWith(".txt") || name.endsWith(".md")) text = await file.text();
  else if (name.endsWith(".doc")) throw new FriendlyError(`"${file.name}": formato .doc antigo não é suportado. Salve como .docx ou PDF.`);
  else throw new FriendlyError(`"${file.name}": formato não suportado. Use PDF ou Word (.docx).`);

  if (text.replace(/\s/g, "").length < 50) {
    throw new FriendlyError(
      `"${file.name}" não tem texto legível (provavelmente é um PDF escaneado). Envie uma versão com texto selecionável.`,
    );
  }
  return text.trim();
}
