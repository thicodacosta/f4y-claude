/**
 * Renderiza o registro no painel e o exporta em Markdown. Todo texto vindo
 * do modelo entra via textContent, nunca como HTML.
 */

const NOT_MENTIONED = "Não abordado nesta entrevista.";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function card(title, ...children) {
  const section = el("section", "card");
  section.append(el("h2", null, title), ...children);
  return section;
}

function paragraph(text) {
  return text ? el("p", null, text) : el("p", "empty", NOT_MENTIONED);
}

function itemList(items, renderItem) {
  if (!items?.length) return el("p", "empty", NOT_MENTIONED);
  const wrap = el("div");
  for (const item of items) {
    const row = el("div", "item");
    row.append(...renderItem(item));
    wrap.append(row);
  }
  return wrap;
}

function bulletList(items) {
  if (!items?.length) return el("p", "empty", NOT_MENTIONED);
  const ul = el("ul", "list");
  for (const text of items) ul.append(el("li", null, text));
  return ul;
}

export function renderAnalysis(container, data) {
  container.replaceChildren();

  container.append(card("Resumo executivo", paragraph(data.resumoExecutivo)));

  container.append(
    card(
      "Experiência profissional",
      itemList(data.experienciaProfissional, (exp) => {
        const meta = [exp.cargo, exp.periodo].filter(Boolean).join(" · ");
        return [
          el("div", "item__title", exp.empresa),
          ...(meta ? [el("div", "item__meta", meta)] : []),
          el("p", null, exp.descricao),
        ];
      }),
    ),
  );

  container.append(
    card(
      "Experiência relacionada à vaga",
      data.experienciaRelacionadaVaga?.length
        ? itemList(data.experienciaRelacionadaVaga, (r) => [el("div", "item__title", r.requisito), el("p", null, r.evidencia)])
        : el("p", "empty", "Sem requisitos de vaga para comparar ou nenhuma evidência mencionada."),
    ),
  );

  const tags = el("ul", "tags");
  for (const skill of data.competenciasTecnicas ?? []) tags.append(el("li", null, skill));
  container.append(
    card("Competências técnicas mencionadas", data.competenciasTecnicas?.length ? tags : paragraph(null)),
  );

  container.append(
    card(
      "Competências comportamentais observadas",
      itemList(data.competenciasComportamentais, (c) => [el("div", "item__title", c.competencia), el("p", null, c.evidencia)]),
    ),
  );

  const facts = el("dl", "facts");
  for (const [label, value] of [
    ["Motivação profissional", data.motivacaoProfissional],
    ["Disponibilidade", data.disponibilidade],
    ["Expectativa salarial", data.expectativaSalarial],
  ]) {
    facts.append(el("dt", null, label), el("dd", value ? null : "empty", value || NOT_MENTIONED));
  }
  container.append(card("Momento e condições", facts));

  container.append(
    card(
      "Pontos positivos",
      itemList(data.pontosPositivos, (p) => [
        el("p", null, p.descricao),
        ...(p.trechoTranscricao ? [el("blockquote", "quote", `“${p.trechoTranscricao}”`)] : []),
      ]),
    ),
  );

  container.append(card("Pontos de atenção", bulletList(data.pontosAtencao?.map((p) => p.descricao))));

  container.append(card("Resumo final", paragraph(data.resumoFinal)));
}

/** Versão em Markdown, para colar em ATS, e-mail ou documento. */
export function toMarkdown(data, meta) {
  const lines = [];
  const push = (...l) => lines.push(...l);
  const orNA = (v) => v || `_${NOT_MENTIONED}_`;

  push(`# Registro de entrevista — ${meta.candidato || "Candidato"}`);
  const sub = [meta.vagaTitulo && `Vaga: ${meta.vagaTitulo}`, `Data: ${meta.data}`].filter(Boolean).join(" · ");
  push(sub, "");

  push("## Resumo executivo", orNA(data.resumoExecutivo), "");

  push("## Experiência profissional");
  if (data.experienciaProfissional?.length) {
    for (const exp of data.experienciaProfissional) {
      const meta = [exp.cargo, exp.periodo].filter(Boolean).join(" · ");
      push(`- **${exp.empresa}**${meta ? ` — ${meta}` : ""}: ${exp.descricao}`);
    }
  } else push(orNA(null));
  push("");

  push("## Experiência relacionada à vaga");
  if (data.experienciaRelacionadaVaga?.length) {
    for (const r of data.experienciaRelacionadaVaga) push(`- **${r.requisito}**: ${r.evidencia}`);
  } else push("_Sem requisitos de vaga para comparar ou nenhuma evidência mencionada._");
  push("");

  push("## Competências técnicas mencionadas", data.competenciasTecnicas?.length ? data.competenciasTecnicas.join(", ") : orNA(null), "");

  push("## Competências comportamentais observadas");
  if (data.competenciasComportamentais?.length) {
    for (const c of data.competenciasComportamentais) push(`- **${c.competencia}**: ${c.evidencia}`);
  } else push(orNA(null));
  push("");

  push("## Momento e condições");
  push(`- **Motivação profissional:** ${orNA(data.motivacaoProfissional)}`);
  push(`- **Disponibilidade:** ${orNA(data.disponibilidade)}`);
  push(`- **Expectativa salarial:** ${orNA(data.expectativaSalarial)}`, "");

  push("## Pontos positivos");
  if (data.pontosPositivos?.length) {
    for (const p of data.pontosPositivos) {
      push(`- ${p.descricao}`);
      if (p.trechoTranscricao) push(`  > “${p.trechoTranscricao}”`);
    }
  } else push(orNA(null));
  push("");

  push("## Pontos de atenção");
  if (data.pontosAtencao?.length) for (const p of data.pontosAtencao) push(`- ${p.descricao}`);
  else push(orNA(null));
  push("");

  push("## Resumo final", orNA(data.resumoFinal), "");
  push("---", "_Registro de apoio gerado por IA a partir da transcrição. Não é avaliação, nota ou decisão._");

  return lines.join("\n");
}
