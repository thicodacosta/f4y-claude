/**
 * Renderiza o registro no painel e o exporta em Markdown, em português,
 * inglês ou espanhol. Todo texto vindo do modelo entra via textContent,
 * nunca como HTML.
 */

export const LANGUAGES = { pt: "Português", en: "English", es: "Español" };

const LABELS = {
  pt: {
    resumoExecutivo: "Resumo executivo",
    experienciaProfissional: "Experiência profissional",
    experienciaRelacionadaVaga: "Experiência relacionada à vaga",
    semRequisitos: "Sem requisitos de vaga para comparar ou nenhuma evidência mencionada.",
    competenciasTecnicas: "Competências técnicas mencionadas",
    competenciasComportamentais: "Competências comportamentais observadas",
    momento: "Momento e condições",
    motivacaoProfissional: "Motivação profissional",
    disponibilidade: "Disponibilidade",
    expectativaSalarial: "Expectativa salarial",
    pontosPositivos: "Pontos positivos",
    pontosAtencao: "Pontos de atenção",
    resumoFinal: "Resumo final",
    naoAbordado: "Não abordado nesta entrevista.",
    titulo: "Registro de entrevista",
    candidato: "Candidato",
    vaga: "Vaga",
    data: "Data",
    aviso: "Registro de apoio gerado por IA a partir da transcrição. Não é avaliação, nota ou decisão.",
  },
  en: {
    resumoExecutivo: "Executive summary",
    experienciaProfissional: "Professional experience",
    experienciaRelacionadaVaga: "Experience related to the role",
    semRequisitos: "No role requirements to compare, or no evidence mentioned.",
    competenciasTecnicas: "Technical skills mentioned",
    competenciasComportamentais: "Behavioral competencies observed",
    momento: "Career moment and conditions",
    motivacaoProfissional: "Career motivation",
    disponibilidade: "Availability",
    expectativaSalarial: "Salary expectation",
    pontosPositivos: "Strengths",
    pontosAtencao: "Points to validate",
    resumoFinal: "Closing summary",
    naoAbordado: "Not covered in this interview.",
    titulo: "Interview record",
    candidato: "Candidate",
    vaga: "Role",
    data: "Date",
    aviso: "AI-generated support record based on the transcript. Not an assessment, score or hiring decision.",
  },
  es: {
    resumoExecutivo: "Resumen ejecutivo",
    experienciaProfissional: "Experiencia profesional",
    experienciaRelacionadaVaga: "Experiencia relacionada con el puesto",
    semRequisitos: "Sin requisitos del puesto para comparar o sin evidencias mencionadas.",
    competenciasTecnicas: "Competencias técnicas mencionadas",
    competenciasComportamentais: "Competencias conductuales observadas",
    momento: "Momento y condiciones",
    motivacaoProfissional: "Motivación profesional",
    disponibilidade: "Disponibilidad",
    expectativaSalarial: "Expectativa salarial",
    pontosPositivos: "Puntos positivos",
    pontosAtencao: "Puntos a validar",
    resumoFinal: "Resumen final",
    naoAbordado: "No abordado en esta entrevista.",
    titulo: "Registro de entrevista",
    candidato: "Candidato",
    vaga: "Puesto",
    data: "Fecha",
    aviso: "Registro de apoyo generado por IA a partir de la transcripción. No es una evaluación, nota ni decisión.",
  },
};

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

export function renderAnalysis(container, data, lang = "pt") {
  const t = LABELS[lang];
  const paragraph = (text) => (text ? el("p", null, text) : el("p", "empty", t.naoAbordado));
  const itemList = (items, renderItem) => {
    if (!items?.length) return el("p", "empty", t.naoAbordado);
    const wrap = el("div");
    for (const item of items) {
      const row = el("div", "item");
      row.append(...renderItem(item));
      wrap.append(row);
    }
    return wrap;
  };
  const bulletList = (items) => {
    if (!items?.length) return el("p", "empty", t.naoAbordado);
    const ul = el("ul", "list");
    for (const text of items) ul.append(el("li", null, text));
    return ul;
  };

  container.replaceChildren();
  container.lang = lang === "pt" ? "pt-BR" : lang;

  container.append(card(t.resumoExecutivo, paragraph(data.resumoExecutivo)));

  container.append(
    card(
      t.experienciaProfissional,
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
      t.experienciaRelacionadaVaga,
      data.experienciaRelacionadaVaga?.length
        ? itemList(data.experienciaRelacionadaVaga, (r) => [el("div", "item__title", r.requisito), el("p", null, r.evidencia)])
        : el("p", "empty", t.semRequisitos),
    ),
  );

  const tags = el("ul", "tags");
  for (const skill of data.competenciasTecnicas ?? []) tags.append(el("li", null, skill));
  container.append(card(t.competenciasTecnicas, data.competenciasTecnicas?.length ? tags : paragraph(null)));

  container.append(
    card(
      t.competenciasComportamentais,
      itemList(data.competenciasComportamentais, (c) => [el("div", "item__title", c.competencia), el("p", null, c.evidencia)]),
    ),
  );

  const facts = el("dl", "facts");
  for (const key of ["motivacaoProfissional", "disponibilidade", "expectativaSalarial"]) {
    facts.append(el("dt", null, t[key]), el("dd", data[key] ? null : "empty", data[key] || t.naoAbordado));
  }
  container.append(card(t.momento, facts));

  container.append(
    card(
      t.pontosPositivos,
      itemList(data.pontosPositivos, (p) => [
        el("p", null, p.descricao),
        ...(p.trechoTranscricao ? [el("blockquote", "quote", `“${p.trechoTranscricao}”`)] : []),
      ]),
    ),
  );

  container.append(card(t.pontosAtencao, bulletList(data.pontosAtencao?.map((p) => p.descricao))));

  container.append(card(t.resumoFinal, paragraph(data.resumoFinal)));
}

/** Versão em Markdown, para colar em ATS, e-mail ou documento. */
export function toMarkdown(data, meta, lang = "pt") {
  const t = LABELS[lang];
  const lines = [];
  const push = (...l) => lines.push(...l);
  const orNA = (v) => v || `_${t.naoAbordado}_`;

  push(`# ${t.titulo}: ${meta.candidato || t.candidato}`);
  push([meta.vagaTitulo && `${t.vaga}: ${meta.vagaTitulo}`, `${t.data}: ${meta.data}`].filter(Boolean).join(" · "), "");

  push(`## ${t.resumoExecutivo}`, orNA(data.resumoExecutivo), "");

  push(`## ${t.experienciaProfissional}`);
  if (data.experienciaProfissional?.length) {
    for (const exp of data.experienciaProfissional) {
      const detail = [exp.cargo, exp.periodo].filter(Boolean).join(" · ");
      push(`- **${exp.empresa}**${detail ? `: ${detail}` : ""}. ${exp.descricao}`);
    }
  } else push(orNA(null));
  push("");

  push(`## ${t.experienciaRelacionadaVaga}`);
  if (data.experienciaRelacionadaVaga?.length) {
    for (const r of data.experienciaRelacionadaVaga) push(`- **${r.requisito}**: ${r.evidencia}`);
  } else push(`_${t.semRequisitos}_`);
  push("");

  push(`## ${t.competenciasTecnicas}`, data.competenciasTecnicas?.length ? data.competenciasTecnicas.join(", ") : orNA(null), "");

  push(`## ${t.competenciasComportamentais}`);
  if (data.competenciasComportamentais?.length) {
    for (const c of data.competenciasComportamentais) push(`- **${c.competencia}**: ${c.evidencia}`);
  } else push(orNA(null));
  push("");

  push(`## ${t.momento}`);
  for (const key of ["motivacaoProfissional", "disponibilidade", "expectativaSalarial"]) {
    push(`- **${t[key]}:** ${orNA(data[key])}`);
  }
  push("");

  push(`## ${t.pontosPositivos}`);
  if (data.pontosPositivos?.length) {
    for (const p of data.pontosPositivos) {
      push(`- ${p.descricao}`);
      if (p.trechoTranscricao) push(`  > “${p.trechoTranscricao}”`);
    }
  } else push(orNA(null));
  push("");

  push(`## ${t.pontosAtencao}`);
  if (data.pontosAtencao?.length) for (const p of data.pontosAtencao) push(`- ${p.descricao}`);
  else push(orNA(null));
  push("");

  push(`## ${t.resumoFinal}`, orNA(data.resumoFinal), "");
  push("---", `_${t.aviso}_`);

  return lines.join("\n");
}
