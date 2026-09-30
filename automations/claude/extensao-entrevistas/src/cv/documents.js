/**
 * Gera o currículo padronizado em PDF (pdfmake) e em Word (docx) a partir dos
 * mesmos dados, com a identidade visual configurada pelo usuário: logo no
 * cabeçalho, cor de destaque e nome da empresa no rodapé.
 */
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
import { DEFAULT_ACCENT, INK, MUTED, RULE, logoSize, renderBrandedPdf, section } from "../pdf/branded.js";

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
    ...sections(cv).flatMap(([title, key]) => section(title, body[key](), branding)),
  ].filter(Boolean);

  return renderBrandedPdf({ branding, title: `Currículo - ${cv.nome}`, footer: footerText(branding), content });
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

  const doc = new Document({
    creator: branding.empresa || "JourneyLab",
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
