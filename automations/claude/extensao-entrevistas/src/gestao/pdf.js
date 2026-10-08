/**
 * PDF da aba Gestão: período e filtros, indicadores, gráficos (desenhados com
 * primitivas do pdfmake), destaques e o histórico completo do período, com a
 * identidade da empresa (src/pdf/branded.js).
 */
import { MUTED, RULE, accentOf, renderBrandedPdf, section } from "../pdf/branded.js";

const LARGURA = 499;

function kpiGrid(kpis, cor) {
  const celula = (k) => ({
    stack: [
      { text: k.valor, fontSize: 20, bold: true, color: cor },
      { text: k.rotulo, fontSize: 8.5, bold: true, margin: [0, 2, 0, 0] },
      { text: k.detalhe ?? " ", fontSize: 7.5, color: MUTED },
    ],
    margin: [8, 8, 8, 8],
    fillColor: "#F5F8FA",
  });
  const linhas = [];
  for (let i = 0; i < kpis.length; i += 4) {
    const linha = kpis.slice(i, i + 4).map(celula);
    while (linha.length < 4) linha.push({ text: "" });
    linhas.push(linha);
  }
  return {
    table: { widths: ["*", "*", "*", "*"], body: linhas },
    layout: { hLineColor: () => "#FFFFFF", vLineColor: () => "#FFFFFF", hLineWidth: () => 4, vLineWidth: () => 4 },
  };
}

function colunas(g, cor) {
  const itens = g.itens;
  if (!itens.length || itens.every((i) => !i.valor)) return { text: "Sem atividades no período.", color: MUTED, fontSize: 9 };
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const altura = 90;
  const slot = LARGURA / itens.length;
  const larg = Math.max(2, Math.min(22, slot - 4));
  const canvas = [{ type: "line", x1: 0, y1: altura, x2: LARGURA, y2: altura, lineWidth: 0.5, lineColor: RULE }];
  itens.forEach((it, i) => {
    const h = (it.valor / max) * (altura - 12);
    if (h > 0) canvas.push({ type: "rect", x: i * slot + (slot - larg) / 2, y: altura - h, w: larg, h, r: 2, color: cor });
  });
  // Rótulos: no máximo ~10 visíveis, cada um com a largura do grupo de
  // colunas que representa (assim a data não quebra em duas linhas).
  const passo = Math.ceil(itens.length / 10);
  const rotulos = { columns: [], columnGap: 0, margin: [0, 3, 0, 0] };
  for (let i = 0; i < itens.length; i += passo) {
    rotulos.columns.push({ text: itens[i].rotulo, fontSize: 7, color: MUTED, width: slot * Math.min(passo, itens.length - i), noWrap: true });
  }
  return { stack: [{ canvas }, rotulos] };
}

function barras(g, cor) {
  const itens = g.itens.filter((i) => i.valor);
  if (!itens.length) return { text: "Sem atividades no período.", color: MUTED, fontSize: 9 };
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return {
    table: {
      widths: [150, "*", 40],
      body: itens.map((i) => [
        { text: i.rotulo, fontSize: 8.5, margin: [0, 2, 0, 2] },
        { canvas: [{ type: "rect", x: 0, y: 4, w: 260, h: 8, r: 3, color: "#EEF1F4" }, { type: "rect", x: 0, y: 4, w: Math.max(2, (i.valor / max) * 260), h: 8, r: 3, color: cor }] },
        { text: String(i.valor), fontSize: 8.5, alignment: "right", margin: [0, 2, 0, 2] },
      ]),
    },
    layout: "noBorders",
  };
}

function historico(tabela) {
  if (!tabela.linhas.length) return { text: "Nenhuma atividade no período.", color: MUTED, fontSize: 9 };
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [78, 120, "*"],
      body: [
        tabela.colunas.map((c) => ({ text: c, bold: true, fontSize: 8, color: MUTED })),
        ...tabela.linhas.map((l) => l.map((v) => ({ text: v || "—", fontSize: 8 }))),
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 1 ? 0.8 : 0.4),
      vLineWidth: () => 0,
      hLineColor: () => RULE,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

/** Gera o PDF (Blob) do relatório montado em dados.js. */
export function gestaoPdf(rel, branding) {
  const cor = accentOf(branding);
  const [porTempo, porFuncao] = rel.graficos;
  const content = [
    { text: rel.titulo, style: "name" },
    { text: rel.subtitulo, style: "title", color: cor },
    { text: `Gerado em ${new Date().toLocaleString("pt-BR")}`, style: "contact" },
    ...section("Indicadores do período", [kpiGrid(rel.kpis, cor)], branding),
    ...(rel.destaques.length ? section("Destaques", [{ ul: rel.destaques, style: "body" }], branding) : []),
    ...section(porTempo.titulo, [colunas(porTempo, cor)], branding),
    ...section(porFuncao.titulo, [barras(porFuncao, cor)], branding),
    ...section(`Histórico (${rel.tabelas[0].linhas.length})`, [historico(rel.tabelas[0])], branding),
  ];
  const empresa = branding.empresa ? `${branding.empresa} · ` : "";
  return renderBrandedPdf({ branding, title: `${empresa}${rel.titulo}`, footer: `${empresa}Gestão do recrutador · Documento interno`, content });
}
