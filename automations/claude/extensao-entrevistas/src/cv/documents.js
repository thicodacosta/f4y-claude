/**
 * Gera o currículo padronizado em PDF (pdfmake) e em Word (docx) a partir dos
 * mesmos dados, com a identidade visual configurada pelo usuário (logo, cor,
 * nome da empresa no rodapé) e o layout do modelo de currículo da empresa
 * (src/cv/layout.js): posição do logo, nome, estilo dos títulos, ordem das
 * seções e formato das experiências e da formação.
 *
 * `options`: { layout, cargo }. O cargo da vaga, digitado no painel, aparece
 * logo abaixo do nome (sem ele, o título profissional do próprio currículo).
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
import { DEFAULT_ACCENT, INK, MUTED, RULE, logoSize, renderBrandedPdf, section, sectionHeading } from "../pdf/branded.js";
import { DEFAULT_LAYOUT } from "./layout.js";

// Títulos "escuros" do modelo: azul quase preto, como nos modelos em tons de cinza.
const DARK_TITLE = "#3A4A5E";

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

const joinDot = (...parts) => parts.filter(Boolean).join(" · ");
const languageLine = (i) => (i.nivel ? `${i.idioma}: ${i.nivel}` : i.idioma);
const certificationLine = (c) => [c.nome, c.instituicao, c.ano].filter(Boolean).join(" · ");
const footerText = (branding) =>
  branding.empresa ? `Apresentado por ${branding.empresa} · Documento confidencial` : "Documento confidencial";

/** Partes do currículo que dependem do layout, iguais no PDF e no Word. */
function parts(cv, branding, layout, cargo) {
  const accent = branding.cor || DEFAULT_ACCENT;
  const companyFirst = layout.experienciaCabecalho === "empresa_primeiro";
  return {
    accent,
    titleColor: layout.corTitulos === "escuro" ? DARK_TITLE : accent,
    name: layout.nomeMaiusculo ? cv.nome.toUpperCase() : cv.nome,
    subtitle: cargo.trim() || cv.tituloProfissional || "",
    headingText: (title) => (layout.titulosMaiusculos ? title.toUpperCase() : title),
    // Experiência em blocos: linha principal (com período à direita) e secundária.
    expMain: (e) => (companyFirst ? e.empresa : e.cargo),
    expSecondary: (e) => (companyFirst ? joinDot(e.cargo, e.local) : joinDot(e.empresa, e.local)),
    // Experiência em linha única: "Empresa — Cargo | Período".
    expLine: (e) =>
      [companyFirst ? e.empresa : e.cargo, companyFirst ? e.cargo : e.empresa].filter(Boolean).join(" — ") +
      (e.periodo ? ` | ${e.periodo}` : ""),
    // Formação em lista: "Instituição — Curso (nível) | Período".
    educationLine: (f) =>
      [f.instituicao, f.nivel && !f.curso.toLowerCase().includes(f.nivel.toLowerCase()) ? `${f.curso} (${f.nivel})` : f.curso]
        .filter(Boolean)
        .join(" — ") + (f.periodo ? ` | ${f.periodo}` : ""),
  };
}

// ---- PDF --------------------------------------------------------------------

const PDF_ALIGN = { esquerda: "left", centro: "center", direita: "right" };

export async function buildCvPdf(cv, branding, { layout = DEFAULT_LAYOUT, cargo = "" } = {}) {
  const p = parts(cv, branding, layout, cargo);

  const heading = (title) => {
    const text = p.headingText(title);
    if (layout.estiloTitulos === "destaque") {
      return { text, fontSize: 13.5, bold: true, color: p.titleColor, margin: [0, 14, 0, 6] };
    }
    if (layout.estiloTitulos === "sublinhado") {
      return {
        stack: [
          { text, fontSize: 11, bold: true, color: p.titleColor },
          { canvas: [{ type: "line", x1: 0, y1: 3, x2: 499, y2: 3, lineWidth: 0.6, lineColor: RULE }] },
        ],
        margin: [0, 14, 0, 6],
      };
    }
    return sectionHeading(text, { ...branding, cor: p.titleColor });
  };

  const activities = (list) =>
    !list?.length
      ? { text: "" }
      : layout.atividadesFormato === "paragrafo"
        ? { text: list.join(" "), style: "body", margin: [0, 3, 0, 0] }
        : { ul: list, style: "body", margin: [0, 4, 0, 0] };

  const body = {
    resumo: () => [{ text: cv.resumo, style: "body" }],
    experiencias: () =>
      cv.experiencias.map((e) => ({
        stack:
          layout.experienciaFormato === "linha_unica"
            ? [{ text: p.expLine(e), style: "itemTitle" }, activities(e.atividades)]
            : [
                { columns: [{ text: p.expMain(e), style: "itemTitle" }, { text: e.periodo ?? "", style: "period", width: "auto" }] },
                { text: p.expSecondary(e), style: "itemSubtitle", color: p.accent },
                activities(e.atividades),
              ],
        margin: [0, 0, 0, 10],
        unbreakable: e.atividades?.length <= 4,
      })),
    formacao: () =>
      layout.formacaoFormato === "lista"
        ? [{ ul: cv.formacao.map(p.educationLine), style: "body" }]
        : cv.formacao.map((f) => ({
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

  const nameAlign = PDF_ALIGN[layout.nomeAlinhamento];
  const subAlign = PDF_ALIGN[layout.subtituloAlinhamento];
  const content = [
    { text: p.name, style: "name", alignment: nameAlign, bold: layout.nomeMaiusculo || undefined },
    p.subtitle ? { text: p.subtitle, style: "title", color: p.accent, alignment: subAlign } : null,
    contactLine(cv, branding) ? { text: contactLine(cv, branding), style: "contact", alignment: subAlign } : null,
    ...sections(cv, layout).flatMap(([title, key]) => section(title, body[key](), branding, heading(title))),
  ].filter(Boolean);

  return renderBrandedPdf({
    branding,
    title: documentTitle(cv, branding, cargo),
    footer: footerText(branding),
    content,
    header: { logoPosicao: layout.logoPosicao, linha: layout.linhaCabecalho },
  });
}

// ---- Word -------------------------------------------------------------------

// Medidas do Word em twips (1/20 de ponto). A4 com margens de 2 cm.
const PAGE_WIDTH = 11906;
const MARGIN = 1134;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const hex = (color) => color.replace("#", "").toUpperCase();
const FONT = "Arial";
const DOCX_ALIGN = { esquerda: AlignmentType.LEFT, centro: AlignmentType.CENTER, direita: AlignmentType.RIGHT };

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
  const p = parts(cv, branding, layout, cargo);
  const accent = hex(p.accent);
  const titleColor = hex(p.titleColor);
  const muted = hex(MUTED);
  const rightTab = [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }];
  const rule = { bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(RULE), space: 4 } };

  const sectionHeading = (title) => {
    const text = p.headingText(title);
    if (layout.estiloTitulos === "destaque") {
      return new Paragraph({ spacing: { before: 300, after: 100 }, children: [run(text, { bold: true, size: 27, color: titleColor })] });
    }
    if (layout.estiloTitulos === "sublinhado") {
      return new Paragraph({
        spacing: { before: 300, after: 120 },
        border: rule,
        children: [run(text, { bold: true, size: 22, color: titleColor })],
      });
    }
    return new Paragraph({
      spacing: { before: 320, after: 120 },
      border: rule,
      children: [run(text, { bold: true, size: 18, color: titleColor, characterSpacing: 20 })],
    });
  };

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

  const activities = (list) =>
    layout.atividadesFormato === "paragrafo" && list?.length
      ? [new Paragraph({ children: [run(list.join(" "))], spacing: { after: 60 } })]
      : (list ?? []).map(bullet);

  const body = {
    resumo: () => [new Paragraph({ children: [run(cv.resumo)], spacing: { after: 80 } })],
    experiencias: () =>
      cv.experiencias.flatMap((e) =>
        layout.experienciaFormato === "linha_unica"
          ? [
              new Paragraph({ spacing: { before: 140, after: 60 }, children: [run(p.expLine(e), { bold: true, size: 20 })] }),
              ...activities(e.atividades),
            ]
          : [
              titleWithPeriod(p.expMain(e), e.periodo),
              new Paragraph({ spacing: { after: 60 }, children: [run(p.expSecondary(e), { color: accent })] }),
              ...activities(e.atividades),
            ],
      ),
    formacao: () =>
      layout.formacaoFormato === "lista"
        ? cv.formacao.map((f) => bullet(p.educationLine(f)))
        : cv.formacao.flatMap((f) => [
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

  const nameAlign = DOCX_ALIGN[layout.nomeAlinhamento];
  const subAlign = DOCX_ALIGN[layout.subtituloAlinhamento];

  const doc = new Document({
    creator: branding.empresa || "Candydate",
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
          default: new Header({
            children: [
              new Paragraph({
                alignment: DOCX_ALIGN[layout.logoPosicao],
                ...(layout.linhaCabecalho
                  ? { border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 6 } } }
                  : {}),
                children: logoRun,
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
          new Paragraph({ alignment: nameAlign, children: [run(p.name, { bold: true, size: 44 })] }),
          ...(p.subtitle ? [new Paragraph({ alignment: subAlign, children: [run(p.subtitle, { size: 24, color: accent })] })] : []),
          ...(contactLine(cv, branding)
            ? [
                new Paragraph({
                  alignment: subAlign,
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
