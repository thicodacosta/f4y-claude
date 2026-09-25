/**
 * Gera o currículo padronizado em PDF (pdfmake) e em Word (docx) a partir dos
 * mesmos dados, com a identidade visual configurada pelo usuário: logo no
 * cabeçalho, cor de destaque e nome da empresa no rodapé.
 */
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";

pdfMake.addVirtualFileSystem(pdfFonts);

const INK = "#2B2E3A";
const MUTED = "#6B6F7B";
const RULE = "#D9DCE1";
const DEFAULT_ACCENT = "#0B6FA6";
// Área máxima do logo no cabeçalho, em pontos (PDF) / pixels (Word).
const LOGO_BOX = { width: 150, height: 44 };

function logoSize(branding) {
  const { logoWidth: w = LOGO_BOX.width, logoHeight: h = LOGO_BOX.height } = branding;
  const scale = Math.min(LOGO_BOX.width / w, LOGO_BOX.height / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Linha de contato: localização sempre; e-mail, telefone e LinkedIn só se permitidos. */
function contactLine(cv, branding) {
  const parts = [cv.localizacao];
  if (!branding.ocultarContatos) parts.push(cv.contato?.email, cv.contato?.telefone, cv.contato?.linkedin);
  return parts.filter(Boolean).join("  ·  ");
}

/** Seções na ordem do documento; seções vazias são omitidas. */
function sections(cv) {
  return [
    ["Resumo profissional", cv.resumo ? "resumo" : null],
    ["Experiência profissional", cv.experiencias?.length ? "experiencias" : null],
    ["Formação acadêmica", cv.formacao?.length ? "formacao" : null],
    ["Idiomas", cv.idiomas?.length ? "idiomas" : null],
    ["Competências", cv.competencias?.length ? "competencias" : null],
    ["Certificações e cursos", cv.certificacoes?.length ? "certificacoes" : null],
    ["Informações adicionais", cv.informacoesAdicionais?.length ? "informacoesAdicionais" : null],
  ].filter(([, key]) => key);
}

const joinDot = (...parts) => parts.filter(Boolean).join(" · ");
const languageLine = (i) => (i.nivel ? `${i.idioma}: ${i.nivel}` : i.idioma);
const certificationLine = (c) => [c.nome, c.instituicao, c.ano].filter(Boolean).join(" · ");
const footerText = (branding) =>
  branding.empresa ? `Apresentado por ${branding.empresa} · Documento confidencial` : "Documento confidencial";

// ---- PDF --------------------------------------------------------------------

export async function buildCvPdf(cv, branding) {
  const accent = branding.cor || DEFAULT_ACCENT;
  const logo = branding.logoDataUrl ? { image: branding.logoDataUrl, ...logoSize(branding) } : { text: "" };

  const sectionHeading = (title) => ({
    stack: [
      { text: title.toUpperCase(), style: "sectionTitle", color: accent },
      { canvas: [{ type: "line", x1: 0, y1: 3, x2: 499, y2: 3, lineWidth: 0.6, lineColor: RULE }] },
    ],
    margin: [0, 16, 0, 8],
  });

  const body = {
    resumo: () => [{ text: cv.resumo, style: "body" }],
    experiencias: () =>
      cv.experiencias.map((e) => ({
        stack: [
          {
            columns: [
              { text: e.cargo, style: "itemTitle" },
              { text: e.periodo ?? "", style: "period", width: "auto" },
            ],
          },
          { text: joinDot(e.empresa, e.local), style: "itemSubtitle", color: accent },
          e.atividades?.length ? { ul: e.atividades, style: "body", margin: [0, 4, 0, 0] } : { text: "" },
        ],
        margin: [0, 0, 0, 10],
        unbreakable: e.atividades?.length <= 4,
      })),
    formacao: () =>
      cv.formacao.map((f) => ({
        stack: [
          { columns: [{ text: f.curso, style: "itemTitle" }, { text: f.periodo ?? "", style: "period", width: "auto" }] },
          { text: joinDot(f.instituicao, f.nivel), style: "itemSubtitle", color: MUTED },
        ],
        margin: [0, 0, 0, 6],
      })),
    idiomas: () => [{ ul: cv.idiomas.map(languageLine), style: "body" }],
    competencias: () => [{ text: cv.competencias.join("  ·  "), style: "body" }],
    certificacoes: () => [{ ul: cv.certificacoes.map(certificationLine), style: "body" }],
    informacoesAdicionais: () => [{ ul: cv.informacoesAdicionais, style: "body" }],
  };

  const content = [
    { text: cv.nome, style: "name" },
    cv.tituloProfissional ? { text: cv.tituloProfissional, style: "title", color: accent } : null,
    contactLine(cv, branding) ? { text: contactLine(cv, branding), style: "contact" } : null,
    ...sections(cv).flatMap(([title, key]) => [sectionHeading(title), ...body[key]()]),
  ].filter(Boolean);

  const doc = {
    pageSize: "A4",
    pageMargins: [48, 96, 48, 56],
    info: { title: `Currículo - ${cv.nome}`, author: branding.empresa || undefined },
    header: () => ({
      margin: [48, 28, 48, 0],
      stack: [
        { columns: [logo, { text: "CURRÍCULO", style: "headerLabel", width: "auto", margin: [0, 14, 0, 0] }] },
        { canvas: [{ type: "line", x1: 0, y1: 10, x2: 499, y2: 10, lineWidth: 1.5, lineColor: accent }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [48, 16, 48, 0],
      columns: [
        { text: footerText(branding), style: "footer" },
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
      headerLabel: { fontSize: 8, color: MUTED, characterSpacing: 1.5 },
      footer: { fontSize: 7.5, color: MUTED },
    },
  };

  return pdfMake.createPdf(doc).getBlob();
}

// ---- Word -------------------------------------------------------------------

// Medidas do Word em twips (1/20 de ponto). A4 com margens de 2 cm.
const PAGE_WIDTH = 11906;
const MARGIN = 1134;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const hex = (color) => color.replace("#", "").toUpperCase();
const FONT = "Arial";

/** Texto com fonte, tamanho (meio-pontos) e cor explícitos em cada trecho:
 * nem todo leitor de .docx (Google Docs, LibreOffice, visualizadores)
 * aplica o estilo padrão do documento. */
const run = (text, options = {}) => new TextRun({ text, font: FONT, size: 19, color: hex(INK), ...options });

function dataUrlToBytes(dataUrl) {
  const binary = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildCvDocx(cv, branding) {
  const accent = hex(branding.cor || DEFAULT_ACCENT);
  const muted = hex(MUTED);
  const rightTab = [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }];

  const sectionHeading = (title) =>
    new Paragraph({
      spacing: { before: 320, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(RULE), space: 4 } },
      children: [run(title.toUpperCase(), { bold: true, size: 18, color: accent, characterSpacing: 20 })],
    });

  const bullet = (text) => new Paragraph({ children: [run(text)], bullet: { level: 0 }, spacing: { after: 40 } });

  const titleWithPeriod = (title, period) =>
    new Paragraph({
      tabStops: rightTab,
      spacing: { before: 120 },
      children: [
        run(title, { bold: true, size: 21 }),
        ...(period ? [run(`\t${period}`, { size: 18, color: muted })] : []),
      ],
    });

  const body = {
    resumo: () => [new Paragraph({ children: [run(cv.resumo)], spacing: { after: 80 } })],
    experiencias: () =>
      cv.experiencias.flatMap((e) => [
        titleWithPeriod(e.cargo, e.periodo),
        new Paragraph({
          spacing: { after: 60 },
          children: [run(joinDot(e.empresa, e.local), { color: accent })],
        }),
        ...(e.atividades ?? []).map(bullet),
      ]),
    formacao: () =>
      cv.formacao.flatMap((f) => [
        titleWithPeriod(f.curso, f.periodo),
        new Paragraph({ children: [run(joinDot(f.instituicao, f.nivel), { color: muted })] }),
      ]),
    idiomas: () => cv.idiomas.map((i) => bullet(languageLine(i))),
    competencias: () => [new Paragraph({ children: [run(cv.competencias.join("  ·  "))] })],
    certificacoes: () => cv.certificacoes.map((c) => bullet(certificationLine(c))),
    informacoesAdicionais: () => cv.informacoesAdicionais.map(bullet),
  };

  const headerChildren = [];
  if (branding.logoDataUrl) {
    headerChildren.push(
      new ImageRun({
        type: branding.logoType === "jpg" ? "jpg" : "png",
        data: dataUrlToBytes(branding.logoDataUrl),
        transformation: logoSize(branding),
      }),
    );
  }
  headerChildren.push(run("\tCURRÍCULO", { size: 16, color: muted, characterSpacing: 30 }));

  const doc = new Document({
    creator: branding.empresa || "Registro de Entrevistas",
    title: `Currículo - ${cv.nome}`,
    styles: { default: { document: { run: { font: FONT, size: 19, color: hex(INK) } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: 16838 },
            margin: { top: 1700, bottom: 1134, left: MARGIN, right: MARGIN, header: 567, footer: 567 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: rightTab,
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 6 } },
                children: headerChildren,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: rightTab,
                children: [
                  run(footerText(branding), { size: 15, color: muted }),
                  new TextRun({ children: ["\t", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: muted }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ children: [run(cv.nome, { bold: true, size: 44 })] }),
          ...(cv.tituloProfissional
            ? [new Paragraph({ children: [run(cv.tituloProfissional, { size: 24, color: accent })] })]
            : []),
          ...(contactLine(cv, branding)
            ? [
                new Paragraph({
                  spacing: { before: 120 },
                  children: [run(contactLine(cv, branding), { size: 18, color: muted })],
                }),
              ]
            : []),
          ...sections(cv).flatMap(([title, key]) => [sectionHeading(title), ...body[key]()]),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/** Nome de arquivo: "CV - Nome do Candidato - Empresa". */
export function cvFileName(cv, branding, extension) {
  const clean = (s) => s.replace(/[\\/:*?"<>|]+/g, "").trim();
  return `${["CV", clean(cv.nome), branding.empresa && clean(branding.empresa)].filter(Boolean).join(" - ")}.${extension}`;
}
