/**
 * Relatório: formato único que cada funcionalidade monta a partir dos seus
 * dados. Alimenta o "Baixar PDF", o "Gerar Motion" e o contexto do Chat.
 *
 * {
 *   modulo, titulo, subtitulo, colaboradorId?,
 *   kpis:      [{ rotulo, valor: "texto", detalhe? }],
 *   graficos:  [{ titulo, tipo: "barras" | "linha" | "colunas", itens: [{ rotulo, valor, projetado? }], max?, sufixo?, casas? }],
 *   tabelas:   [{ titulo, colunas: [..], linhas: [[..]] }],
 *   destaques: ["frase"],
 *   textos:    [{ titulo, texto }],
 * }
 */
import { renderBrandedPdf, sectionHeading, accentOf, MUTED, RULE } from "../../../extensao-entrevistas/src/pdf/branded.js";
import { salvarDocumento, store } from "./db.js";
import { saveBlob } from "./toolskit.js";

const LARGURA = 499;

export async function branding() {
  return (await chrome.storage.local.get("branding")).branding ?? {};
}

const fmt = (v, casas = 1) => (v == null ? "—" : Number(v).toFixed(casas).replace(".", ","));

/** Gráfico do relatório desenhado com primitivas do pdfmake. */
function graficoPdf(g, cor) {
  const itens = g.itens.filter((i) => i.valor != null);
  if (!itens.length) return { text: "Sem dados no período.", color: MUTED, fontSize: 9 };
  if (g.tipo === "barras") {
    const max = g.max ?? Math.max(...itens.map((i) => i.valor), 1);
    return {
      table: {
        widths: [150, "*", 46],
        body: itens.map((i) => [
          { text: i.rotulo, fontSize: 8.5, margin: [0, 2, 0, 2] },
          { canvas: [{ type: "rect", x: 0, y: 4, w: 250, h: 8, r: 3, color: "#EEF1F4" }, { type: "rect", x: 0, y: 4, w: Math.max(2, (i.valor / max) * 250), h: 8, r: 3, color: cor }] },
          { text: `${fmt(i.valor, g.casas ?? 1)}${g.sufixo ?? ""}`, fontSize: 8.5, alignment: "right", margin: [0, 2, 0, 2] },
        ]),
      },
      layout: "noBorders",
    };
  }
  // Linha e colunas: colunas verticais; projeção em tom claro.
  const max = g.max ?? Math.max(...itens.map((i) => i.valor), 1);
  const altura = 90;
  const slot = LARGURA / itens.length;
  const larg = Math.min(22, slot - 6);
  const canvas = [{ type: "line", x1: 0, y1: altura, x2: LARGURA, y2: altura, lineWidth: 0.5, lineColor: RULE }];
  const rotulos = [];
  itens.forEach((i, k) => {
    const h = Math.max(1, (i.valor / max) * (altura - 14));
    canvas.push({ type: "rect", x: k * slot + (slot - larg) / 2, y: altura - h, w: larg, h, r: 2, color: i.projetado ? "#A9DCD6" : cor });
    rotulos.push({ text: `${fmt(i.valor, g.casas ?? 1)}${g.sufixo ?? ""}\n${i.rotulo}${i.projetado ? "*" : ""}`, fontSize: 6.5, alignment: "center", color: i.projetado ? MUTED : "#2B2E3A" });
  });
  const temProj = itens.some((i) => i.projetado);
  return {
    stack: [
      { canvas },
      { columns: rotulos.map((r) => ({ ...r, width: slot })), columnGap: 0, margin: [0, 3, 0, 0] },
      temProj ? { text: "* projeção pela tendência dos meses anteriores", fontSize: 7, color: MUTED, margin: [0, 4, 0, 0] } : null,
    ].filter(Boolean),
  };
}

export async function gerarPdf(rel) {
  const marca = await branding();
  const cor = accentOf(marca);
  const content = [
    { text: rel.titulo, style: "name" },
    rel.subtitulo ? { text: rel.subtitulo, style: "title", color: MUTED } : null,
    { text: `Gerado em ${new Date().toLocaleString("pt-BR")} · ${store.empresaNome || marca.empresa || ""}`, style: "contact" },
  ].filter(Boolean);

  if (rel.kpis?.length) {
    const linhas = [];
    for (let i = 0; i < rel.kpis.length; i += 3) linhas.push(rel.kpis.slice(i, i + 3));
    content.push({
      margin: [0, 16, 0, 0],
      table: {
        widths: ["*", "*", "*"],
        body: linhas.map((l) =>
          [0, 1, 2].map((k) =>
            l[k]
              ? { stack: [{ text: l[k].rotulo.toUpperCase(), fontSize: 7, bold: true, color: MUTED, characterSpacing: 0.6 }, { text: l[k].valor, fontSize: 17, bold: true, color: cor, margin: [0, 2, 0, 0] }, l[k].detalhe ? { text: l[k].detalhe, fontSize: 7.5, color: MUTED } : null].filter(Boolean), margin: [8, 8, 8, 8] }
              : { text: "" },
          ),
        ),
      },
      layout: { hLineColor: () => RULE, vLineColor: () => RULE, hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
    });
  }
  if (rel.destaques?.length) {
    content.push(sectionHeading("Destaques", marca), { ul: rel.destaques.map((d) => ({ text: d, style: "body", margin: [0, 0, 0, 3] })) });
  }
  for (const g of rel.graficos ?? []) {
    content.push({ stack: [sectionHeading(g.titulo, marca), graficoPdf(g, cor)], unbreakable: true });
  }
  for (const t of rel.tabelas ?? []) {
    if (!t.linhas.length) continue;
    content.push(sectionHeading(t.titulo, marca), {
      table: {
        headerRows: 1,
        widths: t.colunas.map((_, i) => (i === 0 ? "*" : "auto")),
        body: [t.colunas.map((c) => ({ text: c, bold: true, fontSize: 8, color: MUTED })), ...t.linhas.map((l) => l.map((c) => ({ text: String(c ?? "—"), fontSize: 8.5 })))],
      },
      layout: { hLineColor: () => RULE, hLineWidth: (i) => (i === 1 ? 0.8 : 0.4), vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 4 },
    });
  }
  for (const t of rel.textos ?? []) {
    if (!t.texto) continue;
    content.push(sectionHeading(t.titulo, marca), { text: t.texto, style: "body" });
  }

  const footer = `${marca.empresa || store.empresaNome || "Candydate"} · Candydate BP · Documento interno e confidencial`;
  const blob = await renderBrandedPdf({ branding: marca, title: rel.titulo, footer, content });
  const nome = `${(marca.empresa || store.empresaNome || "BP").trim()} - ${rel.titulo}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  saveBlob(blob, nome);
  // Guarda o que foi exportado (reconstrução e histórico).
  salvarDocumento({ tipo: "pdf", modulo: rel.modulo, titulo: rel.titulo, conteudo: rel, colaboradorId: rel.colaboradorId ?? null }).catch((e) => console.warn(e));
}
