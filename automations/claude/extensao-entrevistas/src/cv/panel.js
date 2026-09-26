/**
 * Aba "Currículos" do painel: recebe vários arquivos, padroniza cada um com o
 * Claude e oferece o resultado em PDF e Word com a identidade configurada.
 *
 * Os dados padronizados ficam em chrome.storage.session (apagados ao fechar o
 * Chrome); o arquivo original fica só em memória, para permitir "tentar de
 * novo" enquanto o painel estiver aberto.
 */
import { FriendlyError } from "../errors.js";

// Leitura de Word e geração de PDF/Word somam ~2,5 MB (bibliotecas e
// fontes): só carregam quando a aba de currículos é usada.
const loadStructure = () => import("./structure.js");
const loadDocuments = () => import("./documents.js");

// Chamadas simultâneas ao Claude: acelera lotes sem estourar limite de taxa.
const CONCURRENCY = 3;
const ACCEPTED = /\.(pdf|docx|doc)$/i;

const $ = (id) => document.getElementById(id);

let items = []; // { id, fileName, status: "fila"|"processando"|"pronto"|"erro", cv?, error? }
const files = new Map(); // id → File (só em memória)
let branding = {};
let getApiKey = () => null;
let getGroqKey = () => null;
let running = 0;

function persist() {
  chrome.storage.session.set({ cvs: items });
}

function statusText(item) {
  switch (item.status) {
    case "fila":
      return "Na fila";
    case "processando":
      return "Lendo e padronizando…";
    case "pronto":
      return [item.cv.tituloProfissional, item.fileName].filter(Boolean).join(" · ");
    default:
      return item.error;
  }
}

function button(label, onClick, className = "btn btn--ghost btn--sm") {
  const node = Object.assign(document.createElement("button"), { type: "button", className, textContent: label });
  node.addEventListener("click", onClick);
  return node;
}

function render() {
  const list = $("cv-list");
  list.replaceChildren(
    ...items.map((item) => {
      const li = Object.assign(document.createElement("li"), { className: "cv-item" });
      const top = Object.assign(document.createElement("div"), { className: "cv-item__top" });
      const text = Object.assign(document.createElement("div"), { className: "cv-item__text" });
      text.append(
        Object.assign(document.createElement("p"), {
          className: "cv-item__name",
          textContent: item.cv?.nome ?? item.fileName,
        }),
        Object.assign(document.createElement("p"), {
          className: `cv-item__status${item.status === "erro" ? " is-error" : ""}${
            item.status === "processando" ? " is-working" : ""
          }`,
          textContent: statusText(item),
        }),
      );
      const remove = button("×", () => removeItem(item.id), "cv-item__remove");
      remove.setAttribute("aria-label", `Remover ${item.cv?.nome ?? item.fileName}`);
      remove.disabled = item.status === "processando";
      top.append(text, remove);
      li.append(top);

      if (item.status === "pronto") {
        const actions = Object.assign(document.createElement("div"), { className: "cv-item__actions" });
        actions.append(
          button("Visualizar", (e) => preview(item, e.currentTarget)),
          button("Baixar PDF", (e) => downloadAs(item, "pdf", e.currentTarget), "btn btn--primary btn--sm"),
          button("Baixar Word", (e) => downloadAs(item, "docx", e.currentTarget)),
        );
        li.append(actions);
      } else if (item.status === "erro" && files.has(item.id)) {
        const actions = Object.assign(document.createElement("div"), { className: "cv-item__actions" });
        actions.append(button("Tentar de novo", () => retry(item.id)));
        li.append(actions);
      }
      return li;
    }),
  );

  const done = items.filter((i) => i.status === "pronto").length;
  const pending = items.filter((i) => i.status === "fila" || i.status === "processando").length;
  $("cv-list-header").hidden = items.length === 0;
  $("cv-summary").textContent = pending
    ? `${done} de ${items.length} prontos · processando…`
    : `${done} de ${items.length} prontos`;
  $("cv-clear").disabled = pending > 0;
}

function update(id, patch) {
  items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  persist();
  render();
}

function removeItem(id) {
  items = items.filter((i) => i.id !== id);
  files.delete(id);
  persist();
  render();
}

function addFiles(fileList) {
  for (const file of fileList) {
    const id = crypto.randomUUID();
    if (!ACCEPTED.test(file.name)) {
      items.push({ id, fileName: file.name, status: "erro", error: "Formato não suportado. Use PDF ou Word (.docx)." });
      continue;
    }
    files.set(id, file);
    items.push({ id, fileName: file.name, status: "fila" });
  }
  persist();
  render();
  pump();
}

function retry(id) {
  update(id, { status: "fila", error: null });
  pump();
}

/** Processa a fila respeitando o limite de chamadas simultâneas. */
function pump() {
  while (running < CONCURRENCY) {
    const next = items.find((i) => i.status === "fila");
    if (!next) return;
    const apiKey = getApiKey();
    const groqKey = getGroqKey();
    if (!apiKey && !groqKey) {
      for (const i of items.filter((x) => x.status === "fila")) {
        update(i.id, { status: "erro", error: "Cadastre uma chave da Anthropic ou da Groq em Configurações." });
      }
      return;
    }
    running++;
    update(next.id, { status: "processando" });
    loadStructure()
      .then(({ structureCv }) => structureCv({ apiKey, groqKey, file: files.get(next.id) }))
      .then((cv) => update(next.id, { status: "pronto", cv }))
      .catch((error) => {
        console.error(`Falha ao padronizar ${next.fileName}`, error);
        update(next.id, {
          status: "erro",
          error: error instanceof FriendlyError ? error.message : "Não foi possível ler este arquivo.",
        });
      })
      .finally(() => {
        running--;
        pump();
      });
  }
}

async function withBusy(buttonEl, fn) {
  const label = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = "Gerando…";
  try {
    await fn();
  } catch (error) {
    console.error(error);
    alert("Não foi possível gerar o documento. Verifique o logo em Configurações e tente de novo.");
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = label;
  }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAs(item, extension, buttonEl) {
  return withBusy(buttonEl, async () => {
    const { buildCvDocx, buildCvPdf, cvFileName } = await loadDocuments();
    const blob = extension === "pdf" ? await buildCvPdf(item.cv, branding) : await buildCvDocx(item.cv, branding);
    saveBlob(blob, cvFileName(item.cv, branding, extension));
  });
}

function preview(item, buttonEl) {
  return withBusy(buttonEl, async () => {
    const { buildCvPdf } = await loadDocuments();
    const url = URL.createObjectURL(await buildCvPdf(item.cv, branding));
    window.open(url, "_blank");
    // A aba já carregou o PDF; libera a memória depois de um tempo.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}

function renderBranding() {
  const banner = $("cv-banner");
  const missingKey = !getApiKey() && !getGroqKey();
  const missingLogo = !branding.logoDataUrl;
  banner.hidden = !missingKey && !missingLogo;
  if (!banner.hidden) {
    const what = [missingKey && "a chave da Anthropic", missingLogo && "o logo da sua empresa"].filter(Boolean).join(" e ");
    banner.replaceChildren(
      `Para começar, configure ${what} em `,
      Object.assign(document.createElement("a"), {
        href: missingKey ? "options.html" : "options.html#curriculos",
        target: "_blank",
        textContent: "Configurações",
      }),
      ".",
    );
  }
  $("cv-brand").hidden = missingLogo;
  if (!missingLogo) {
    $("cv-brand-logo").src = branding.logoDataUrl;
    $("cv-brand-name").textContent = branding.empresa || "Sua empresa";
  }
}

export async function initCvArea({ apiKeyGetter, groqKeyGetter }) {
  getApiKey = apiKeyGetter;
  getGroqKey = groqKeyGetter;
  ({ branding = {} } = await chrome.storage.local.get("branding"));

  // Itens que estavam em processamento quando o painel fechou não têm mais
  // o arquivo em memória.
  const { cvs = [] } = await chrome.storage.session.get("cvs");
  items = cvs.map((i) =>
    i.status === "fila" || i.status === "processando"
      ? { ...i, status: "erro", error: "Processamento interrompido. Envie o arquivo de novo." }
      : i,
  );
  persist();
  render();
  renderBranding();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("branding" in changes)) return;
    branding = changes.branding.newValue ?? {};
    renderBranding();
  });

  $("cv-files").addEventListener("change", (event) => {
    addFiles([...event.target.files]);
    event.target.value = "";
  });

  const drop = $("cv-drop");
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("is-dragging");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-dragging");
    addFiles([...event.dataTransfer.files]);
  });

  $("cv-clear").addEventListener("click", () => {
    items = [];
    files.clear();
    persist();
    render();
  });

  return { refresh: renderBranding };
}
