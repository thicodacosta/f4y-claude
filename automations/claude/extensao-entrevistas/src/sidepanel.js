import { analyzeInterview, AnalysisError } from "./analyze.js";
import { initCompareArea } from "./compare/panel.js";
import { initCvArea } from "./cv/panel.js";
import { initPromptsArea } from "./prompts/panel.js";
import { initSalaryArea } from "./salary/panel.js";
import { initTurnoverArea } from "./turnover/panel.js";
import { renderAnalysis, toMarkdown } from "./render.js";

const FIELDS = ["candidato", "vagaTitulo", "vagaRequisitos", "transcricao"];
// Abaixo disso não há conversa suficiente para um registro útil.
const MIN_TRANSCRIPT_CHARS = 200;
// Depois disso sem nenhuma fala captada numa trilha, vale avisar.
const SILENCE_WARNING_MS = 60_000;

const CONSENT_TEXT = {
  gravar: "Informei o candidato e ele autorizou a gravação e a transcrição desta entrevista.",
  colar: "Confirmo que o candidato foi informado e autorizou o registro desta entrevista.",
};
const SUBMIT_TEXT = { gravar: "Iniciar gravação", colar: "Gerar registro" };

const $ = (id) => document.getElementById(id);
const views = {
  form: $("view-form"),
  recording: $("view-recording"),
  loading: $("view-loading"),
  result: $("view-result"),
};

let keys = {};
let current = null; // registro exibido: { data, meta, transcricao }
let capture = null; // estado da gravação (espelho de storage.session.capture)
let pasteAbort = null; // análise de transcrição colada em andamento
let tickTimer = null;
let cvArea = null;

function showView(name) {
  for (const [key, node] of Object.entries(views)) node.hidden = key !== name;
  window.scrollTo(0, 0);
}

function mode() {
  return document.querySelector('input[name="modo"]:checked').value;
}

function readForm() {
  return Object.fromEntries(FIELDS.map((f) => [f, $(f).value]));
}

function showError(id, message) {
  $(id).textContent = message ?? "";
  $(id).hidden = !message;
}

const showFormError = (message) => showError("form-error", message);

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function toBackground(message) {
  return chrome.runtime.sendMessage({ target: "background", ...message });
}

// ---- Modo e configuração -------------------------------------------------

function applyMode() {
  const m = mode();
  $("paste-fields").hidden = m !== "colar";
  $("record-help").hidden = m !== "gravar";
  $("consent-text").textContent = CONSENT_TEXT[m];
  $("submit-btn").textContent = SUBMIT_TEXT[m];
  updateBanner();
}

function setMode(m) {
  document.querySelector(`input[name="modo"][value="${m}"]`).checked = true;
  applyMode();
}

for (const radio of document.querySelectorAll('input[name="modo"]')) {
  radio.addEventListener("change", () => {
    applyMode();
    showFormError(null);
    chrome.storage.session.set({ modo: mode() });
  });
}

function updateBanner() {
  const missing = [];
  if (!keys.apiKey) missing.push("Anthropic");
  if (mode() === "gravar" && !keys.groqKey) missing.push("Groq");
  const banner = $("setup-banner");
  banner.hidden = missing.length === 0;
  if (missing.length) {
    banner.replaceChildren(
      `Para começar, cadastre a chave da ${missing.join(" e da ")} em `,
      Object.assign(document.createElement("a"), { href: "options.html", target: "_blank", textContent: "Configurações" }),
      ".",
    );
  }
}

async function loadKeys() {
  keys = await chrome.storage.local.get(["apiKey", "groqKey"]);
  updateBanner();
  cvArea?.refresh();
}

// ---- Rascunho --------------------------------------------------------------
// Transcrições têm dados pessoais: rascunho e resultado ficam em
// storage.session (memória), que o Chrome apaga ao ser fechado.

let draftTimer;
function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => chrome.storage.session.set({ draft: readForm() }), 300);
}

function updateCharCount() {
  $("char-count").textContent = $("transcricao").value.length.toLocaleString("pt-BR");
}

for (const f of FIELDS) $(f).addEventListener("input", saveDraftSoon);
$("transcricao").addEventListener("input", updateCharCount);

// ---- Importação de arquivo -----------------------------------------------

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

// ---- Envio do formulário -------------------------------------------------

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = readForm();
  const m = mode();

  if (!keys.apiKey || (m === "gravar" && !keys.groqKey)) {
    return showFormError("Cadastre as chaves de API em Configurações antes de continuar.");
  }
  if (m === "colar" && input.transcricao.trim().length < MIN_TRANSCRIPT_CHARS) {
    $("transcricao").focus();
    return showFormError("A transcrição está vazia ou curta demais para gerar um registro.");
  }
  if (!$("consent").checked) {
    $("consent").focus();
    return showFormError(
      m === "gravar"
        ? "Confirme que o candidato autorizou a gravação antes de iniciar."
        : "Confirme que o candidato autorizou o registro da entrevista.",
    );
  }
  showFormError(null);

  if (m === "gravar") await startRecording(input);
  else await analyzePasted(input);
});

async function startRecording(input) {
  // O aviso de permissão do microfone só aparece de forma confiável numa aba
  // comum. Se o usuário já negou, a gravação segue só com o áudio da reunião.
  const permission = await navigator.permissions.query({ name: "microphone" }).catch(() => null);
  if (permission?.state === "prompt") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("permission.html") });
    return showFormError("Libere o microfone na aba que abriu e depois clique em “Iniciar gravação” de novo.");
  }

  const submit = $("submit-btn");
  submit.disabled = true;
  submit.textContent = "Iniciando…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const meta = { candidato: input.candidato, vagaTitulo: input.vagaTitulo, vagaRequisitos: input.vagaRequisitos };
    const response = await toBackground({ type: "START", tabId: tab?.id, meta });
    if (!response?.ok) showFormError(response?.error ?? "Não foi possível iniciar a gravação.");
  } finally {
    submit.disabled = false;
    submit.textContent = SUBMIT_TEXT[mode()];
  }
}

async function analyzePasted(input) {
  pasteAbort = new AbortController();
  const startedAt = Date.now();
  showLoading("Estruturando o registro…", "Costuma levar entre 20 e 60 segundos.");
  const timer = setInterval(() => {
    $("elapsed").textContent = `${Math.round((Date.now() - startedAt) / 1000)}s`;
  }, 1000);

  try {
    const data = await analyzeInterview({ apiKey: keys.apiKey, input, signal: pasteAbort.signal });
    await chrome.storage.session.set({
      result: {
        data,
        transcricao: input.transcricao.trim(),
        meta: {
          candidato: input.candidato.trim(),
          vagaTitulo: input.vagaTitulo.trim(),
          data: new Date().toLocaleDateString("pt-BR"),
        },
      },
    });
    // a exibição vem do listener de storage
  } catch (error) {
    console.error(error);
    showView("form");
    showFormError(error instanceof AnalysisError ? error.message : "Erro inesperado ao gerar o registro. Tente novamente.");
  } finally {
    clearInterval(timer);
    pasteAbort = null;
  }
}

// ---- Processando ------------------------------------------------------------

function showLoading(title, hint) {
  $("loading-title").textContent = title;
  $("loading-hint").textContent = hint;
  $("elapsed").textContent = "";
  showView("loading");
}

$("cancel-btn").addEventListener("click", async () => {
  if (pasteAbort) return pasteAbort.abort();
  if (!confirm("Cancelar descarta a gravação e a transcrição desta entrevista. Continuar?")) return;
  await toBackground({ type: "CANCEL" });
});

// ---- Gravação ---------------------------------------------------------------

function elapsedMs(c) {
  return (c.pausedAt ?? Date.now()) - c.startedAt - c.pausedMs;
}

function healthLine(id, label, count, available, elapsed) {
  const node = $(id);
  if (!available) {
    node.className = "warn";
    node.textContent = `${label}: indisponível`;
  } else if (count > 0) {
    node.className = "ok";
    node.textContent = `${label}: captando falas`;
  } else if (elapsed > SILENCE_WARNING_MS) {
    node.className = "warn";
    node.textContent = `${label}: nenhuma fala captada até agora`;
  } else {
    node.className = "";
    node.textContent = `${label}: aguardando falas`;
  }
}

function renderRecording() {
  const c = capture;
  const elapsed = elapsedMs(c);
  const paused = c.phase === "paused";
  $("recording-title").textContent = c.meta.candidato?.trim() || "Candidato não informado";
  $("recording-meta").textContent = c.meta.vagaTitulo?.trim() ?? "";
  $("recording-status").classList.toggle("is-paused", paused);
  $("recording-label").textContent = paused ? "Pausado" : "Gravando";
  $("recording-timer").textContent = formatDuration(elapsed);
  $("pause-btn").textContent = paused ? "Retomar" : "Pausar";
  healthLine("health-candidato", "Áudio da reunião", c.stats.candidato, true, elapsed);
  healthLine("health-recrutador", "Seu microfone", c.stats.recrutador, c.hasMic, elapsed);

  const warnings = [...c.warnings];
  if (c.stats.falhas > 0) {
    warnings.push(`${c.stats.falhas} trecho(s) de áudio não puderam ser transcritos e ficarão marcados no registro.`);
  }
  $("recording-warnings").replaceChildren(...warnings.map((w) => Object.assign(document.createElement("li"), { textContent: w })));
}

function stopTicking() {
  clearInterval(tickTimer);
  tickTimer = null;
}

async function recordingAction(type, button) {
  button.disabled = true;
  showError("recording-error", null);
  try {
    const response = await toBackground({ type });
    if (!response?.ok) showError("recording-error", response?.error ?? "Não foi possível concluir a ação.");
  } finally {
    button.disabled = false;
  }
}

$("pause-btn").addEventListener("click", (e) =>
  recordingAction(capture?.phase === "paused" ? "RESUME" : "PAUSE", e.currentTarget),
);
$("finish-btn").addEventListener("click", (e) => recordingAction("STOP", e.currentTarget));
$("discard-btn").addEventListener("click", (e) => {
  if (confirm("Descartar a gravação? Nada desta entrevista será guardado.")) recordingAction("CANCEL", e.currentTarget);
});

/** Reflete o estado da gravação guardado pelo background. */
async function applyCapture(next) {
  capture = next;
  stopTicking();
  if (!capture) return;

  switch (capture.phase) {
    case "recording":
    case "paused":
      renderRecording();
      showView("recording");
      tickTimer = setInterval(renderRecording, 1000);
      return;
    case "finishing":
      showLoading("Concluindo a transcrição…", "Transcrevendo os últimos trechos de áudio.");
      return;
    case "analyzing":
      showLoading("Estruturando o registro…", "Costuma levar entre 20 e 60 segundos.");
      return;
    case "error": {
      // A transcrição captada não se perde: volta no modo "colar" para
      // tentar gerar o registro de novo.
      const { transcricao, meta, error } = capture;
      await chrome.storage.session.remove("capture");
      capture = null;
      for (const f of ["candidato", "vagaTitulo", "vagaRequisitos"]) $(f).value = meta[f] ?? "";
      if (transcricao) {
        $("transcricao").value = transcricao;
        setMode("colar");
        $("consent").checked = true;
      }
      updateCharCount();
      saveDraftSoon();
      showView("form");
      showFormError(
        transcricao ? `${error} A transcrição foi preservada abaixo: clique em “Gerar registro” para tentar de novo.` : error,
      );
      return;
    }
  }
}

// ---- Resultado ---------------------------------------------------------------

function showResult(result) {
  current = result;
  const { meta } = result;
  $("result-title").textContent = meta.candidato || "Candidato não informado";
  $("result-meta").textContent = [meta.vagaTitulo, meta.data].filter(Boolean).join(" · ");
  $("copy-status").textContent = "";
  renderAnalysis($("result"), result.data);
  $("transcript-details").hidden = !result.transcricao;
  $("transcript-details").open = false;
  $("transcript-text").textContent = result.transcricao ?? "";
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
  download(
    JSON.stringify({ ...current.meta, registro: current.data, transcricao: current.transcricao ?? null }, null, 2),
    `${fileBaseName()}.json`,
    "application/json",
  ),
);

$("download-txt-btn").addEventListener("click", () =>
  download(current.transcricao ?? "", `${fileBaseName()}-transcricao.txt`, "text/plain;charset=utf-8"),
);

$("edit-btn").addEventListener("click", () => {
  if (current?.transcricao && !$("transcricao").value.trim()) {
    $("transcricao").value = current.transcricao;
    updateCharCount();
    saveDraftSoon();
  }
  setMode("colar");
  showView("form");
  $("transcricao").focus();
});

$("new-btn").addEventListener("click", async () => {
  await chrome.storage.session.remove(["draft", "result"]);
  current = null;
  $("form").reset();
  setMode("gravar");
  updateCharCount();
  showFormError(null);
  showView("form");
  $("candidato").focus();
});

// ---- Sincronização com o storage ------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && ("apiKey" in changes || "groqKey" in changes)) loadKeys();
  if (area !== "session") return;
  if ("result" in changes) {
    if (changes.result.newValue) showResult(changes.result.newValue);
    else current = null; // limpo ao iniciar uma nova gravação
  }
  if ("capture" in changes && changes.capture.newValue) applyCapture(changes.capture.newValue);
  else if ("capture" in changes && capture) {
    // Gravação encerrada: o background salva o registro antes de limpar o
    // estado; sem registro, ela foi descartada.
    capture = null;
    stopTicking();
    showView(current ? "result" : "form");
  }
});

// ---- Abas do painel -------------------------------------------------------

const TABS = Object.fromEntries(
  ["entrevistas", "curriculos", "comparativo", "salarios", "turnover", "prompts"].map((name) => [name, $(`tab-${name}`)]),
);

function selectTab(name) {
  for (const [key, tab] of Object.entries(TABS)) {
    const selected = key === name;
    tab.setAttribute("aria-selected", String(selected));
    $(`area-${key}`).hidden = !selected;
  }
  chrome.storage.session.set({ aba: name });
}

for (const [name, tab] of Object.entries(TABS)) tab.addEventListener("click", () => selectTab(name));

async function init() {
  await loadKeys();
  const apiKeyGetter = () => keys.apiKey;
  cvArea = await initCvArea({ apiKeyGetter });
  await initCompareArea({ apiKeyGetter });
  await initSalaryArea({ apiKeyGetter });
  initTurnoverArea();
  initPromptsArea();
  const stored = await chrome.storage.session.get(["draft", "result", "capture", "modo", "aba"]);
  // Uma gravação em andamento sempre traz a aba de entrevistas para frente.
  selectTab(stored.capture || !TABS[stored.aba] ? "entrevistas" : stored.aba);
  for (const f of FIELDS) $(f).value = stored.draft?.[f] ?? "";
  updateCharCount();
  setMode(stored.modo ?? "gravar");

  if (stored.capture) await applyCapture(stored.capture);
  else if (stored.result) showResult(stored.result);
  else showView("form");
}

await init();
