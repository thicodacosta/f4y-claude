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

/**
 * Primeiras páginas de um PDF como imagens PNG (data URL), para a IA ver o
 * visual do documento. Precisa de DOM (canvas): roda nas páginas da extensão.
 */
export async function pdfPageImages(file, { maxPages = 2, width = 1100 } = {}) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const pdf = await task.promise;
  const images = [];
  try {
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      images.push(canvas.toDataURL("image/png"));
    }
  } finally {
    await task.destroy();
  }
  return images;
}

/** HTML simplificado de um .docx (títulos, negrito, listas), sem imagens. */
export async function docxToHtml(file) {
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })) },
  );
  return value.replace(/<img[^>]*>/g, "[imagem]");
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
