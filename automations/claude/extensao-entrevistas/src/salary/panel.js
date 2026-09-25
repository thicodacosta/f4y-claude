/** Aba "Salários": pesquisa de remuneração nas bases públicas. */
import { ClaudeError } from "../claude.js";
import { $, copyText, el, formatBRL, showError, startElapsed } from "../ui.js";
import { researchSalary } from "./research.js";

let getApiKey = () => null;
let abort = null;
let result = null;

function show(section) {
  $("sal-form").hidden = section !== "form";
  $("sal-loading").hidden = section !== "loading";
  $("sal-result").hidden = section !== "result";
}

function readForm() {
  return {
    cargo: $("sal-cargo").value,
    senioridade: $("sal-senioridade").value,
    localidade: $("sal-local").value,
    regime: $("sal-regime").value,
    setor: $("sal-setor").value,
    observacoes: $("sal-obs").value,
  };
}

function rangeBlock(title, values) {
  const card = el("section", "card");
  const dl = el("dl", "range");
  dl.style.gridTemplateColumns = `repeat(${values.length}, 1fr)`;
  for (const [label, value, mid] of values) {
    const div = el("div", mid ? "is-mid" : null);
    div.append(el("dt", null, label), el("dd", null, formatBRL(value)));
    dl.append(div);
  }
  card.append(el("h2", null, title), dl);
  return card;
}

function sourceValues(ref) {
  return [
    ref.minimo != null && `mín. ${formatBRL(ref.minimo)}`,
    ref.medio != null && `média ${formatBRL(ref.medio)}`,
    ref.maximo != null && `máx. ${formatBRL(ref.maximo)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderResult(r) {
  const out = $("sal-output");
  const header = el("section", "card");
  header.append(el("h2", null, `${r.cargoPesquisado} · ${r.localidade}`), el("p", null, r.observacoes));

  const nodes = [
    header,
    rangeBlock("Faixa mensal CLT consolidada", [
      ["Mínimo", r.consolidado.minimo],
      ["Mediana", r.consolidado.mediana, true],
      ["Máximo", r.consolidado.maximo],
    ]),
  ];

  const pj = rangeBlock("Estimativa mensal PJ", [
    ["Mínimo", r.estimativaPJ.minimo],
    ["Máximo", r.estimativaPJ.maximo],
  ]);
  if (r.estimativaPJ.observacao) pj.append(el("p", "hint", r.estimativaPJ.observacao));
  nodes.push(pj);

  const sources = el("section", "card");
  sources.append(el("h2", null, "Referências por fonte"));
  if (!r.referencias.length) sources.append(el("p", "empty", "Nenhuma referência encontrada."));
  for (const ref of r.referencias) {
    const item = el("div", "source-item");
    item.append(el("p", "item__title", [ref.fonte, ref.regime, ref.referenciaData].filter(Boolean).join(" · ")));
    item.append(el("p", "source-item__values", sourceValues(ref) || "sem valores numéricos"));
    item.append(el("p", "item__meta", ref.descricao));
    if (ref.url && /^https:\/\//.test(ref.url)) {
      const link = el("a", null, "Abrir fonte");
      link.href = ref.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(link);
    }
    sources.append(item);
  }
  if (r.fontesSemDado.length) {
    sources.append(el("p", "hint", `Sem dado público encontrado em: ${r.fontesSemDado.join(", ")}.`));
  }
  nodes.push(sources);

  for (const [title, items] of [
    ["O que mais altera a remuneração", r.fatoresDeVariacao],
    ["Benefícios comuns", r.beneficiosComuns],
  ]) {
    if (!items.length) continue;
    const card = el("section", "card");
    const ul = el("ul", "list");
    for (const item of items) ul.append(el("li", null, item));
    card.append(el("h2", null, title), ul);
    nodes.push(card);
  }
  out.replaceChildren(...nodes);
}

function toText(r) {
  const lines = [
    `Pesquisa salarial: ${r.cargoPesquisado} · ${r.localidade}`,
    `Data: ${new Date().toLocaleDateString("pt-BR")}`,
    "",
    `CLT (mensal): mínimo ${formatBRL(r.consolidado.minimo)} · mediana ${formatBRL(r.consolidado.mediana)} · máximo ${formatBRL(r.consolidado.maximo)}`,
    `PJ (mensal): ${formatBRL(r.estimativaPJ.minimo)} a ${formatBRL(r.estimativaPJ.maximo)}${r.estimativaPJ.observacao ? ` (${r.estimativaPJ.observacao})` : ""}`,
    "",
    r.observacoes,
    "",
    "Referências:",
    ...r.referencias.map((ref) => `- ${ref.fonte}${ref.referenciaData ? ` (${ref.referenciaData})` : ""}: ${sourceValues(ref)}. ${ref.descricao}${ref.url ? ` ${ref.url}` : ""}`),
  ];
  if (r.fontesSemDado.length) lines.push(`Sem dado público: ${r.fontesSemDado.join(", ")}.`);
  if (r.fatoresDeVariacao.length) lines.push("", "Fatores de variação:", ...r.fatoresDeVariacao.map((f) => `- ${f}`));
  return lines.join("\n");
}

const SOURCE_BY_DOMAIN = [
  [/glassdoor/i, "Glassdoor"],
  [/roberthalf/i, "Robert Half"],
  [/hays/i, "Hays"],
  [/linkedin/i, "LinkedIn"],
];

/** Mostra o passo atual da pesquisa: busca feita ou página lida. */
function showProgress({ tool, input }) {
  const text = input?.query ?? input?.url ?? "";
  const source = SOURCE_BY_DOMAIN.find(([pattern]) => pattern.test(text))?.[1];
  $("sal-progress").textContent =
    tool === "web_fetch"
      ? `Lendo página${source ? ` do ${source}` : ""}…`
      : `Buscando${source ? ` no ${source}` : ""}: “${text.replace(/site:\S+/g, "").trim()}”`;
}

async function submit(event) {
  event.preventDefault();
  showError("sal-error", null);
  const apiKey = getApiKey();
  const input = readForm();
  if (!apiKey) return showError("sal-error", "Cadastre a chave da Anthropic em Configurações.");
  if (input.cargo.trim().length < 3) {
    $("sal-cargo").focus();
    return showError("sal-error", "Informe o cargo a pesquisar.");
  }

  abort = new AbortController();
  $("sal-progress").textContent = "Iniciando a busca.";
  show("loading");
  const stop = startElapsed("sal-elapsed");
  try {
    result = await researchSalary({ apiKey, input, signal: abort.signal, onProgress: showProgress });
    await chrome.storage.session.set({ salarios: result });
    renderResult(result);
    show("result");
  } catch (error) {
    console.error(error);
    show("form");
    const message = error instanceof ClaudeError ? error.message : "Não foi possível concluir a pesquisa.";
    // Busca na web precisa estar liberada na organização da Anthropic.
    showError(
      "sal-error",
      /web.?search|web.?fetch/i.test(message)
        ? `${message} Verifique se a busca na web está habilitada no Console da Anthropic (Settings → Privacy).`
        : message,
    );
  } finally {
    stop();
    abort = null;
  }
}

export async function initSalaryArea({ apiKeyGetter }) {
  getApiKey = apiKeyGetter;
  $("sal-form").addEventListener("submit", submit);
  $("sal-cancel").addEventListener("click", () => abort?.abort());
  $("sal-copy").addEventListener("click", () => copyText(toText(result), "sal-copy-status", "Pesquisa copiada."));
  $("sal-new").addEventListener("click", async () => {
    result = null;
    await chrome.storage.session.remove("salarios");
    show("form");
    $("sal-cargo").focus();
  });

  const { salarios } = await chrome.storage.session.get("salarios");
  if (salarios) {
    result = salarios;
    renderResult(result);
    show("result");
  } else {
    show("form");
  }
}
