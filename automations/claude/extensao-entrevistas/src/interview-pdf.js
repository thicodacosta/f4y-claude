/**
 * PDF do registro de entrevista com a identidade do usuário (logo, cor e nome
 * da empresa), no idioma exibido no painel.
 */
import { MUTED, accentOf, renderBrandedPdf, section } from "./pdf/branded.js";
import { labelsFor } from "./render.js";

export function buildInterviewPdf(data, meta, lang, branding) {
  const t = labelsFor(lang);
  const accent = accentOf(branding);
  const empty = { text: t.naoAbordado, style: "empty" };
  const paragraph = (text) => (text ? { text, style: "body" } : empty);
  const bullets = (items) => (items?.length ? { ul: items, style: "body" } : empty);

  const blocks = [
    [t.resumoExecutivo, paragraph(data.resumoExecutivo)],
    [
      t.experienciaProfissional,
      data.experienciaProfissional?.length
        ? data.experienciaProfissional.map((e) => ({
            stack: [
              { text: e.empresa, style: "itemTitle" },
              [e.cargo, e.periodo].filter(Boolean).length
                ? { text: [e.cargo, e.periodo].filter(Boolean).join(" · "), style: "itemSubtitle", color: accent }
                : { text: "" },
              { text: e.descricao, style: "body", margin: [0, 2, 0, 0] },
            ],
            margin: [0, 0, 0, 8],
            unbreakable: true,
          }))
        : empty,
    ],
    [
      t.experienciaRelacionadaVaga,
      data.experienciaRelacionadaVaga?.length
        ? data.experienciaRelacionadaVaga.map((r) => ({
            text: [{ text: `${r.requisito}: `, bold: true }, r.evidencia],
            style: "body",
            margin: [0, 0, 0, 4],
          }))
        : { text: t.semRequisitos, style: "empty" },
    ],
    [t.competenciasTecnicas, data.competenciasTecnicas?.length ? { text: data.competenciasTecnicas.join("  ·  "), style: "body" } : empty],
    [
      t.competenciasComportamentais,
      data.competenciasComportamentais?.length
        ? data.competenciasComportamentais.map((c) => ({
            text: [{ text: `${c.competencia}: `, bold: true }, c.evidencia],
            style: "body",
            margin: [0, 0, 0, 4],
          }))
        : empty,
    ],
    [
      t.momento,
      ["motivacaoProfissional", "disponibilidade", "expectativaSalarial"].map((key) => ({
        text: [{ text: `${t[key]}: `, bold: true }, data[key] ? data[key] : { text: t.naoAbordado, italics: true, color: MUTED }],
        style: "body",
        margin: [0, 0, 0, 4],
      })),
    ],
    [
      t.pontosPositivos,
      data.pontosPositivos?.length
        ? {
            ul: data.pontosPositivos.map((p) =>
              p.trechoTranscricao
                ? { stack: [p.descricao, { text: `“${p.trechoTranscricao}”`, italics: true, color: MUTED, margin: [0, 2, 0, 0] }] }
                : p.descricao,
            ),
            style: "body",
          }
        : empty,
    ],
    [t.pontosAtencao, bullets(data.pontosAtencao?.map((p) => p.descricao))],
    [t.resumoFinal, paragraph(data.resumoFinal)],
  ];

  const content = [
    { text: t.titulo.toUpperCase(), style: "eyebrow", color: accent },
    { text: meta.candidato || t.candidato, style: "name" },
    { text: [meta.vagaTitulo && `${t.vaga}: ${meta.vagaTitulo}`, `${t.data}: ${meta.data}`].filter(Boolean).join("  ·  "), style: "contact" },
    ...blocks.flatMap(([title, body]) => section(title, body, branding)),
    { text: t.aviso, style: "disclaimer" },
  ];

  const footer = [branding.empresa, t.titulo, t.confidencial].filter(Boolean).join(" · ");
  return renderBrandedPdf({
    branding,
    title: `${t.titulo} - ${meta.candidato || t.candidato}`,
    footer,
    content,
    styles: {
      eyebrow: { fontSize: 8.5, bold: true, characterSpacing: 1.2, margin: [0, 0, 0, 4] },
      empty: { fontSize: 9.5, italics: true, color: MUTED },
      disclaimer: { fontSize: 8, italics: true, color: MUTED, margin: [0, 20, 0, 0] },
    },
  });
}
