/** Aba "Comparativo": JD + 2 a 5 currículos → compatibilidade por candidato. */
import { FriendlyError } from "../errors.js";
import { $, copyText, el, saveBlob, showError, startElapsed } from "../ui.js";

// A leitura de Word (mammoth) só carrega quando a comparação é usada.
const loadEvaluate = () => import("./evaluate.js");

const MIN = 2;
const MAX = 5;
const LEVEL_LABEL = { atende: "Atende", parcial: "Parcial", nao_evidenciado: "Não evidenciado" };
const LEVEL_SYMBOL = { atende: "●", parcial: "◐", nao_evidenciado: "○" };

let getApiKey = () => null;
let cvFiles = []; // File[] (só em memória)
let jdFile = null;
let abort = null;
let result = null;

function renderFiles() {
  $("cmp-file-list").replaceChildren(
    ...cvFiles.map((file, i) => {
      const li = el("li");
      const remove = el("button", "btn-link", "Remover");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remover ${file.name}`);
      remove.addEventListener("click", () => {
        cvFiles.splice(i, 1);
        renderFiles();
      });
      li.append(el("span", null, `${i + 1}. ${file.name}`), remove);
      return li;
    }),
  );
  $("cmp-drop").hidden = cvFiles.length >= MAX;
}

function addFiles(list) {
  showError("cmp-error", null);
  const accepted = [...list].filter((f) => /\.(pdf|docx)$/i.test(f.name));
  if (accepted.length < list.length) showError("cmp-error", "Alguns arquivos foram ignorados: use PDF ou Word (.docx).");
  const room = MAX - cvFiles.length;
  if (accepted.length > room) showError("cmp-error", `Máximo de ${MAX} currículos por comparação.`);
  cvFiles.push(...accepted.slice(0, room));
  renderFiles();
}

function renderJdFile() {
  const box = $("cmp-jd-attached");
  box.hidden = !jdFile;
  $("cmp-jd").hidden = Boolean(jdFile);
  if (!jdFile) return;
  const remove = el("button", "btn-link", "Remover");
  remove.type = "button";
  remove.addEventListener("click", () => {
    jdFile = null;
    renderJdFile();
  });
  box.replaceChildren(el("span", null, `JD anexada: ${jdFile.name}`), remove);
}

function show(section) {
  $("cmp-form").hidden = section !== "form";
  $("cmp-loading").hidden = section !== "loading";
  $("cmp-result").hidden = section !== "result";
}

// ---- Resultado --------------------------------------------------------------

function list(title, items) {
  if (!items?.length) return [];
  const ul = el("ul", "list");
  for (const item of items) ul.append(el("li", null, item));
  return [el("h3", null, title), ul];
}

function candidateCard(c, requisitos, position) {
  const card = el("section", "card");
  const rank = el("div", "rank");
  const bar = el("div", "bar");
  const fill = el("div", "bar__fill");
  fill.style.width = `${c.compatibilidade}%`;
  bar.append(fill);
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", `Compatibilidade de ${c.compatibilidade}%`);
  rank.append(el("span", "rank__score", `${c.compatibilidade}%`), el("p", "rank__name", `${position}º · ${c.nome}`), bar);
  card.append(rank, el("p", "hint", c.arquivo ?? ""), el("p", null, c.resumo));

  const details = el("details");
  details.append(el("summary", null, "Evidências e perguntas sugeridas"));
  const reqList = el("ul", "list");
  for (const req of requisitos) {
    const a = c.avaliacoes.find((x) => x.requisitoId === req.id);
    const li = el("li");
    const head = el("strong", `level--${a?.nivel ?? "nao_evidenciado"}`, `${LEVEL_LABEL[a?.nivel] ?? "Não evidenciado"}: `);
    li.append(head, `${req.descricao}. ${a?.evidencia ?? ""}`);
    reqList.append(li);
  }
  details.append(
    ...list("Pontos fortes", c.pontosFortes),
    ...list("Lacunas", c.lacunas),
    el("h3", null, "Por requisito"),
    reqList,
    ...list("Perguntas para a entrevista", c.perguntasSugeridas),
  );
  card.append(details);
  return card;
}

function matrix(r) {
  const wrap = el("div", "matrix-wrap");
  const table = el("table", "matrix");
  const thead = el("thead");
  const headRow = el("tr");
  headRow.append(el("th", null, "Requisito"));
  r.candidatos.forEach((c, i) => {
    const th = el("th", null, `${i + 1}º`);
    th.scope = "col";
    th.title = c.nome;
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = el("tbody");
  for (const req of r.requisitos) {
    const row = el("tr");
    const th = el("th", null, req.descricao);
    th.scope = "row";
    th.append(el("span", "tag", req.tipo === "obrigatorio" ? "obrigatório" : "desejável"));
    row.append(th);
    for (const c of r.candidatos) {
      const nivel = c.avaliacoes.find((x) => x.requisitoId === req.id)?.nivel ?? "nao_evidenciado";
      const td = el("td", `level level--${nivel}`, LEVEL_SYMBOL[nivel]);
      td.title = `${c.nome}: ${LEVEL_LABEL[nivel]}`;
      td.setAttribute("aria-label", LEVEL_LABEL[nivel]);
      row.append(td);
    }
    tbody.append(row);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function renderResult(r) {
  const out = $("cmp-output");
  const header = el("section", "card");
  header.append(el("h2", null, r.vaga.titulo), el("p", null, r.vaga.resumo), el("h3", null, "Síntese"), el("p", null, r.sintese));
  const matrixCard = el("section", "card");
  matrixCard.append(
    el("h2", null, "Requisito por candidato"),
    matrix(r),
    el("p", "legend", "● atende   ◐ parcial   ○ não evidenciado · obrigatórios valem o dobro no cálculo"),
  );
  out.replaceChildren(header, ...r.candidatos.map((c, i) => candidateCard(c, r.requisitos, i + 1)), matrixCard);
}

function toMarkdown(r) {
  const lines = [`# Comparativo de candidatos: ${r.vaga.titulo}`, "", r.vaga.resumo, "", "## Ranking"];
  r.candidatos.forEach((c, i) => lines.push(`${i + 1}. **${c.nome}**: ${c.compatibilidade}% de compatibilidade`));
  lines.push("", "## Síntese", r.sintese, "");
  for (const c of r.candidatos) {
    lines.push(`## ${c.nome} (${c.compatibilidade}%)`, c.resumo, "");
    if (c.pontosFortes.length) lines.push("**Pontos fortes**", ...c.pontosFortes.map((p) => `- ${p}`), "");
    if (c.lacunas.length) lines.push("**Lacunas**", ...c.lacunas.map((p) => `- ${p}`), "");
    lines.push("**Por requisito**");
    for (const req of r.requisitos) {
      const a = c.avaliacoes.find((x) => x.requisitoId === req.id);
      lines.push(`- ${LEVEL_LABEL[a?.nivel] ?? "Não evidenciado"}: ${req.descricao}. ${a?.evidencia ?? ""}`);
    }
    if (c.perguntasSugeridas.length) lines.push("", "**Perguntas para a entrevista**", ...c.perguntasSugeridas.map((p) => `- ${p}`));
    lines.push("");
  }
  lines.push("---", "_Análise de apoio gerada por IA com base nos currículos enviados. Obrigatórios pesam o dobro dos desejáveis. A decisão é do recrutador._");
  return lines.join("\n");
}

// ---- Envio --------------------------------------------------------------------

async function submit(event) {
  event.preventDefault();
  showError("cmp-error", null);
  const apiKey = getApiKey();
  const jdText = $("cmp-jd").value.trim();
  if (!apiKey) return showError("cmp-error", "Cadastre a chave da Groq em Configurações.");
  if (!jdFile && jdText.length < 100) return showError("cmp-error", "Cole a descrição completa da vaga ou importe o arquivo.");
  if (cvFiles.length < MIN) return showError("cmp-error", `Envie pelo menos ${MIN} currículos.`);

  abort = new AbortController();
  show("loading");
  const stop = startElapsed("cmp-elapsed");
  try {
    const { compareCandidates } = await loadEvaluate();
    result = await compareCandidates({
      apiKey,
      jd: jdFile ? { file: jdFile } : { text: jdText },
      cvFiles,
      signal: abort.signal,
    });
    await chrome.storage.session.set({ comparativo: result });
    renderResult(result);
    show("result");
  } catch (error) {
    console.error(error);
    show("form");
    showError("cmp-error", error instanceof FriendlyError ? error.message : "Não foi possível concluir a comparação.");
  } finally {
    stop();
    abort = null;
  }
}

export async function initCompareArea({ apiKeyGetter }) {
  getApiKey = apiKeyGetter;

  $("cmp-form").addEventListener("submit", submit);
  $("cmp-cancel").addEventListener("click", () => abort?.abort());
  $("cmp-files").addEventListener("change", (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  });
  const drop = $("cmp-drop");
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("is-dragging");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-dragging");
    addFiles(e.dataTransfer.files);
  });

  $("cmp-jd-import").addEventListener("click", () => $("cmp-jd-file").click());
  $("cmp-jd-file").addEventListener("change", (e) => {
    jdFile = e.target.files?.[0] ?? null;
    e.target.value = "";
    renderJdFile();
  });

  $("cmp-copy").addEventListener("click", () => copyText(toMarkdown(result), "cmp-copy-status", "Relatório copiado."));
  $("cmp-download").addEventListener("click", () =>
    saveBlob(new Blob([toMarkdown(result)], { type: "text/markdown;charset=utf-8" }), `comparativo-${new Date().toISOString().slice(0, 10)}.md`),
  );
  $("cmp-new").addEventListener("click", async () => {
    result = null;
    cvFiles = [];
    jdFile = null;
    $("cmp-jd").value = "";
    renderFiles();
    renderJdFile();
    await chrome.storage.session.remove("comparativo");
    show("form");
  });

  const { comparativo } = await chrome.storage.session.get("comparativo");
  if (comparativo) {
    result = comparativo;
    renderResult(result);
    show("result");
  } else {
    show("form");
  }
  renderFiles();
}
