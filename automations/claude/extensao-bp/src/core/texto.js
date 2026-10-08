/** Relatório (ver relatorio.js) em texto: contexto do Chat e da IA. Sem pdfmake. */
const fmt = (v, casas = 1) => (v == null ? "—" : Number(v).toFixed(casas).replace(".", ","));

/** Relatório em texto (contexto do Chat e da IA). */
export function relatorioTexto(rel) {
  const partes = [`# ${rel.titulo}${rel.subtitulo ? ` — ${rel.subtitulo}` : ""}`];
  if (rel.kpis?.length) partes.push(rel.kpis.map((k) => `- ${k.rotulo}: ${k.valor}${k.detalhe ? ` (${k.detalhe})` : ""}`).join("\n"));
  if (rel.destaques?.length) partes.push(`Destaques:\n${rel.destaques.map((d) => `- ${d}`).join("\n")}`);
  for (const g of rel.graficos ?? []) partes.push(`${g.titulo}: ${g.itens.map((i) => `${i.rotulo}${i.projetado ? " (projeção)" : ""}=${fmt(i.valor, g.casas ?? 1)}${g.sufixo ?? ""}`).join("; ")}`);
  for (const t of rel.tabelas ?? []) if (t.linhas.length) partes.push(`${t.titulo} (${t.colunas.join(" | ")}):\n${t.linhas.slice(0, 40).map((l) => `- ${l.join(" | ")}`).join("\n")}`);
  for (const t of rel.textos ?? []) if (t.texto) partes.push(`${t.titulo}: ${t.texto}`);
  return partes.join("\n\n");
}
