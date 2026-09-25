import { analyzeInterview, AnalysisError } from "./analyze.js";
import { renderAnalysis, toMarkdown } from "./render.js";

const FIELDS = ["candidato", "vagaTitulo", "vagaRequisitos", "transcricao"];
// Abaixo disso não há conversa suficiente para um registro útil.
const MIN_TRANSCRIPT_CHARS = 200;

const $ = (id) => document.getElementById(id);
const views = { form: $("view-form"), loading: $("view-loading"), result: $("view-result") };

let apiKey = null;
let current = null; // { data, meta } do último registro exibido
let abortController = null;

function showView(name) {
  for (const [key, node] of Object.entries(views)) node.hidden = key !== name;
  window.scrollTo(0, 0);
}

function readForm() {
  return Object.fromEntries(FIELDS.map((f) => [f, $(f).value]));
}

function showFormError(message) {
  const node = $("form-error");
  node.textContent = message ?? "";
  node.hidden = !message;
}

function updateCharCount() {
  $("char-count").textContent = $("transcricao").value.length.toLocaleString("pt-BR");
}

// ---- Persistência -------------------------------------------------------
// Transcrições têm dados pessoais: rascunho e resultado ficam em
// storage.session (memória), que o Chrome apaga ao ser fechado.

let draftTimer;
function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => chrome.storage.session.set({ draft: readForm() }), 300);
}

async function restore() {
  const { draft, result } = await chrome.storage.session.get(["draft", "result"]);
  for (const f of FIELDS) $(f).value = draft?.[f] ?? "";
  updateCharCount();
  if (result) showResult(result);
}

async function loadApiKey() {
  ({ apiKey } = await chrome.storage.local.get("apiKey"));
  $("setup-banner").hidden = Boolean(apiKey);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "apiKey" in changes) loadApiKey();
});

// ---- Importação de arquivo ---------------------------------------------

/** Remove cabeçalho, numeração e marcações de tempo de legendas .vtt/.srt. */
function cleanSubtitles(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => !/^WEBVTT/.test(line) && !/-->/.test(line) && !/^\d+$/.test(line.trim()) && !/^NOTE\b/.test(line))
    .map((line) => line.replace(/<v\s+([^>]+)>/g, "$1: ").replace(/<\/?[^>]+>/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const raw = await file.text();
  $("transcricao").value = /\.(vtt|srt)$/i.test(file.name) ? cleanSubtitles(raw) : raw.trim();
  updateCharCount();
  saveDraftSoon();
  showFormError(null);
});

// ---- Análise -------------------------------------------------------------

for (const f of FIELDS) $(f).addEventListener("input", saveDraftSoon);
$("transcricao").addEventListener("input", updateCharCount);

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = readForm();

  if (!apiKey) return showFormError("Cadastre sua chave de API em Configurações antes de gerar o registro.");
  if (input.transcricao.trim().length < MIN_TRANSCRIPT_CHARS) {
    $("transcricao").focus();
    return showFormError("A transcrição está vazia ou curta demais para gerar um registro.");
  }
  if (!$("consent").checked) {
    $("consent").focus();
    return showFormError("Confirme que o candidato autorizou o registro da entrevista.");
  }
  showFormError(null);

  abortController = new AbortController();
  const startedAt = Date.now();
  $("elapsed").textContent = "0s";
  const timer = setInterval(() => {
    $("elapsed").textContent = `${Math.round((Date.now() - startedAt) / 1000)}s`;
  }, 1000);
  showView("loading");
  $("cancel-btn").focus();

  try {
    const data = await analyzeInterview({ apiKey, input, signal: abortController.signal });
    const result = {
      data,
      meta: {
        candidato: input.candidato.trim(),
        vagaTitulo: input.vagaTitulo.trim(),
        data: new Date().toLocaleDateString("pt-BR"),
      },
    };
    await chrome.storage.session.set({ result });
    showResult(result);
  } catch (error) {
    console.error(error);
    showView("form");
    showFormError(error instanceof AnalysisError ? error.message : "Erro inesperado ao gerar o registro. Tente novamente.");
  } finally {
    clearInterval(timer);
    abortController = null;
  }
});

$("cancel-btn").addEventListener("click", () => abortController?.abort());

// ---- Resultado -----------------------------------------------------------

function showResult(result) {
  current = result;
  const { meta } = result;
  $("result-title").textContent = meta.candidato || "Candidato não informado";
  $("result-meta").textContent = [meta.vagaTitulo, meta.data].filter(Boolean).join(" · ");
  $("copy-status").textContent = "";
  renderAnalysis($("result"), result.data);
  showView("result");
}

function fileBaseName() {
  const slug = (current.meta.candidato || "candidato")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `registro-entrevista-${slug}-${new Date().toISOString().slice(0, 10)}`;
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("copy-btn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(toMarkdown(current.data, current.meta));
    $("copy-status").textContent = "Registro copiado para a área de transferência.";
  } catch {
    $("copy-status").textContent = "Não foi possível copiar. Use “Baixar .md”.";
  }
});

$("download-md-btn").addEventListener("click", () =>
  download(toMarkdown(current.data, current.meta), `${fileBaseName()}.md`, "text/markdown;charset=utf-8"),
);

$("download-json-btn").addEventListener("click", () =>
  download(JSON.stringify({ ...current.meta, registro: current.data }, null, 2), `${fileBaseName()}.json`, "application/json"),
);

$("edit-btn").addEventListener("click", () => {
  showView("form");
  $("transcricao").focus();
});

$("new-btn").addEventListener("click", async () => {
  await chrome.storage.session.remove(["draft", "result"]);
  current = null;
  $("form").reset();
  updateCharCount();
  showFormError(null);
  showView("form");
  $("candidato").focus();
});

await loadApiKey();
await restore();
