/**
 * Base dos PDFs com a identidade do usuário (currículos e registros de
 * entrevista): logo no cabeçalho, linha na cor da empresa e rodapé com o nome
 * da empresa e a numeração de páginas. Carregado sob demanda (pdfmake e
 * fontes somam ~2 MB).
 */
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.addVirtualFileSystem(pdfFonts);

export const INK = "#2B2E3A";
export const MUTED = "#6B6F7B";
export const RULE = "#D9DCE1";
export const DEFAULT_ACCENT = "#0E7AB8";
// Largura útil da página A4 com as margens abaixo, em pontos.
const CONTENT_WIDTH = 499;
// Área máxima do logo no cabeçalho, em pontos.
const LOGO_BOX = { width: 150, height: 44 };

export function logoSize(branding) {
  const { logoWidth: w = LOGO_BOX.width, logoHeight: h = LOGO_BOX.height } = branding;
  const scale = Math.min(LOGO_BOX.width / w, LOGO_BOX.height / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export const accentOf = (branding) => branding.cor || DEFAULT_ACCENT;

/** Título de seção: caixa-alta na cor da empresa, com fio abaixo. */
export function sectionHeading(title, branding) {
  return {
    stack: [
      { text: title.toUpperCase(), style: "sectionTitle", color: accentOf(branding) },
      { canvas: [{ type: "line", x1: 0, y1: 3, x2: CONTENT_WIDTH, y2: 3, lineWidth: 0.6, lineColor: RULE }] },
    ],
    margin: [0, 16, 0, 8],
  };
}

/**
 * Seção: título + itens, com o título sempre na mesma página do primeiro
 * item (nunca sozinho no fim da página).
 */
export function section(title, items, branding, heading = sectionHeading(title, branding)) {
  const [first, ...rest] = Array.isArray(items) ? items : [items];
  return [{ stack: [heading, first], unbreakable: true }, ...rest];
}

const PDF_ALIGN = { esquerda: "left", centro: "center", direita: "right" };

/**
 * Monta e gera o PDF (Blob) com cabeçalho e rodapé da marca. `header`
 * ajusta o cabeçalho ao modelo de currículo: posição do logo e linha abaixo.
 */
export function renderBrandedPdf({ branding, title, footer, content, styles = {}, header = {} }) {
  const accent = accentOf(branding);
  const { logoPosicao = "esquerda", linha = true } = header;
  const logo = branding.logoDataUrl
    ? { image: branding.logoDataUrl, ...logoSize(branding), alignment: PDF_ALIGN[logoPosicao] ?? "left" }
    : { text: "" };
  const doc = {
    pageSize: "A4",
    pageMargins: [48, 96, 48, 56],
    info: { title, author: branding.empresa || undefined },
    header: () => ({
      margin: [48, 28, 48, 0],
      stack: [
        logo,
        ...(linha ? [{ canvas: [{ type: "line", x1: 0, y1: 10, x2: CONTENT_WIDTH, y2: 10, lineWidth: 1.5, lineColor: accent }] }] : []),
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [48, 16, 48, 0],
      columns: [
        { text: footer, style: "footer" },
        { text: `${currentPage} / ${pageCount}`, style: "footer", alignment: "right", width: "auto" },
      ],
    }),
    content,
    defaultStyle: { font: "Roboto", fontSize: 10, color: INK, lineHeight: 1.3 },
    styles: {
      name: { fontSize: 22, bold: true, lineHeight: 1.1 },
      title: { fontSize: 12, margin: [0, 2, 0, 0] },
      contact: { fontSize: 9, color: MUTED, margin: [0, 6, 0, 0] },
      sectionTitle: { fontSize: 9, bold: true, characterSpacing: 1 },
      itemTitle: { fontSize: 10.5, bold: true },
      itemSubtitle: { fontSize: 9.5, margin: [0, 1, 0, 0] },
      period: { fontSize: 9, color: MUTED },
      body: { fontSize: 9.5 },
      footer: { fontSize: 7.5, color: MUTED },
      ...styles,
    },
  };
  return pdfMake.createPdf(doc).getBlob();
}
