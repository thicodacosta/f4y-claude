/**
 * Gera o currículo padronizado em PDF (pdfmake) e em Word (docx) a partir dos
 * mesmos dados, com a identidade visual configurada pelo usuário: logo e cargo
 * da vaga no cabeçalho, cor de destaque e nome da empresa no rodapé. A ordem,
 * os títulos e o formato das seções seguem o modelo de currículo da empresa
 * (src/cv/model.js), quando houver.
 *
 * `options`: { layout, cargo }.
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
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { DEFAULT_ACCENT, INK, MUTED, RULE, logoSize, renderBrandedPdf, section } from "../pdf/branded.js";
import { DEFAULT_LAYOUT } from "./layout.js";

/** Linha de contato: localização sempre; e-mail, telefone e LinkedIn só se permitidos. */
function contactLine(cv, branding) {
  const parts = [cv.localizacao];
  if (!branding.ocultarContatos) parts.push(cv.contato?.email, cv.contato?.telefone, cv.contato?.linkedin);
  return parts.filter(Boolean).join("  ·  ");
}

const hasContent = (cv, key) => (key === "resumo" ? Boolean(cv.resumo) : cv[key]?.length > 0);

/** Seções [título, chave] na ordem do modelo; seções vazias são omitidas. */
function sections(cv, layout) {
  return layout.secoes.filter((s) => hasContent(cv, s.chave)).map((s) => [s.titulo, s.chave]);
}

const headingText = (title, layout) => (layout.titulosMaiusculos ? title.toUpperCase() : title);

const joinDot = (...parts) => parts.filter(Boolean).join(" · ");
const languageLine = (i) => (i.nivel ? `${i.idioma}: ${i.nivel}` : i.idioma);
const certificationLine = (c) => [c.nome, c.instituicao, c.ano].filter(Boolean).join(" · ");
const footerText = (branding) =>
  branding.empresa ? `Apresentado por ${branding.empresa} · Documento confidencial` : "Documento confidencial";

// ---- PDF --------------------------------------------------------------------

export async function buildCvPdf(cv, branding, { layout = DEFAULT_LAYOUT, cargo = "" } = {}) {
  const accent = branding.cor || DEFAULT_ACCENT;
  const companyFirst = layout.experienciaCabecalho === "empresa_primeiro";
  const activities = (list) =>
    !list?.length
      ? { text: "" }
      : layout.atividadesFormato === "paragrafo"
        ? { text: list.join(" "), style: "body", margin: [0, 4, 0, 0] }
        : { ul: list, style: "body", margin: [0, 4, 0, 0] };

  const body = {
    resumo: () => [{ text: cv.resumo, style: "body" }],
    experiencias: () =>
      cv.experiencias.map((e) => ({
        stack: [
          {
            columns: [
              { text: companyFirst ? e.empresa : e.cargo, style: "itemTitle" },
              { text: e.periodo ?? "", style: "period", width: "auto" },
            ],
          },
          { text: companyFirst ? joinDot(e.cargo, e.local) : joinDot(e.empresa, e.local), style: "itemSubtitle", color: accent },
          activities(e.atividades),
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
    competencias: () =>
      layout.competenciasFormato === "topicos"
        ? [{ ul: cv.competencias, style: "body" }]
        : [{ text: cv.competencias.join("  ·  "), style: "body" }],
    certificacoes: () => [{ ul: cv.certificacoes.map(certificationLine), style: "body" }],
    informacoesAdicionais: () => [{ ul: cv.informacoesAdicionais, style: "body" }],
  };

  const content = [
    { text: cv.nome, style: "name" },
    cv.tituloProfissional ? { text: cv.tituloProfissional, style: "title", color: accent } : null,
    contactLine(cv, branding) ? { text: contactLine(cv, branding), style: "contact" } : null,
    ...sections(cv, layout).flatMap(([title, key]) => section(headingText(title, layout), body[key](), branding)),
  ].filter(Boolean);

  return renderBrandedPdf({
    branding,
    title: documentTitle(cv, branding, cargo),
    footer: footerText(branding),
    content,
    headerText: cargo.trim(),
  });
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

export async function buildCvDocx(cv, branding, { layout = DEFAULT_LAYOUT, cargo = "" } = {}) {
  const accent = hex(branding.cor || DEFAULT_ACCENT);
  const companyFirst = layout.experienciaCabecalho === "empresa_primeiro";
  const muted = hex(MUTED);
  const rightTab = [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }];

  const sectionHeading = (title) =>
    new Paragraph({
      spacing: { before: 320, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(RULE), space: 4 } },
      children: [run(headingText(title, layout), { bold: true, size: 18, color: accent, characterSpacing: 20 })],
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
        titleWithPeriod(companyFirst ? e.empresa : e.cargo, e.periodo),
        new Paragraph({
          spacing: { after: 60 },
          children: [run(companyFirst ? joinDot(e.cargo, e.local) : joinDot(e.empresa, e.local), { color: accent })],
        }),
        ...(layout.atividadesFormato === "paragrafo" && e.atividades?.length
          ? [new Paragraph({ children: [run(e.atividades.join(" "))], spacing: { after: 60 } })]
          : (e.atividades ?? []).map(bullet)),
      ]),
    formacao: () =>
      cv.formacao.flatMap((f) => [
        titleWithPeriod(f.curso, f.periodo),
        new Paragraph({ children: [run(joinDot(f.instituicao, f.nivel), { color: muted })] }),
      ]),
    idiomas: () => cv.idiomas.map((i) => bullet(languageLine(i))),
    competencias: () =>
      layout.competenciasFormato === "topicos"
        ? cv.competencias.map(bullet)
        : [new Paragraph({ children: [run(cv.competencias.join("  ·  "))] })],
    certificacoes: () => cv.certificacoes.map((c) => bullet(certificationLine(c))),
    informacoesAdicionais: () => cv.informacoesAdicionais.map(bullet),
  };

  const logoRun = branding.logoDataUrl
    ? [
        new ImageRun({
          type: branding.logoType === "jpg" ? "jpg" : "png",
          data: dataUrlToBytes(branding.logoDataUrl),
          transformation: logoSize(branding),
        }),
      ]
    : [];
  const headerLine = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 1 } },
    spacing: { after: 0 },
    children: [],
  });
  // Logo à esquerda e cargo da vaga à direita, centralizados na mesma linha.
  // Tabela sem bordas: alinha igual no Word, no Google Docs e no LibreOffice.
  const noBorders = Object.fromEntries(
    ["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }]),
  );
  const headerContent = cargo.trim()
    ? [
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [CONTENT_WIDTH / 2, CONTENT_WIDTH / 2],
          borders: noBorders,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: noBorders,
                  children: [new Paragraph({ children: logoRun })],
                }),
                new TableCell({
                  width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: noBorders,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [run(cargo.trim(), { bold: true, size: 24, color: accent })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        headerLine,
      ]
    : [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 6 } },
          children: logoRun,
        }),
      ];

  const doc = new Document({
    creator: branding.empresa || "JourneyLab",
    title: documentTitle(cv, branding, cargo),
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
          default: new Header({ children: headerContent }),
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
          ...sections(cv, layout).flatMap(([title, key]) => [sectionHeading(title), ...body[key]()]),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

/** "Nome da Empresa - Cargo | Nome do Candidato" (partes vazias são omitidas). */
function documentTitle(cv, branding, cargo = "") {
  const left = [branding.empresa?.trim(), cargo.trim()].filter(Boolean).join(" - ");
  return [left, cv.nome?.trim()].filter(Boolean).join(" | ");
}

/**
 * Nome do arquivo no formato "Nome da Empresa - Cargo | Nome do Candidato".
 * O Chrome troca "|" por "_" em nomes de arquivo (caractere proibido no
 * Windows); por isso a barra usada é a "｜" (U+FF5C), visualmente igual.
 */
export function cvFileName(cv, branding, extension, cargo = "") {
  const clean = (s) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
  const left = [branding.empresa && clean(branding.empresa), cargo && clean(cargo)].filter(Boolean).join(" - ");
  return `${[left, clean(cv.nome ?? "Candidato")].filter(Boolean).join(" ｜ ")}.${extension}`;
}
