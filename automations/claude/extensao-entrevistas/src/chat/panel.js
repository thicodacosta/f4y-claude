/** Aba "Chat": conversa com IA, prompts favoritos ("/" ou "+") e anexos. */
import DOMPurify from "dompurify";
import { marked } from "marked";
import { FriendlyError } from "../errors.js";
import { stripCitations } from "../groq.js";
import { getFavoritePrompts, onFavoritesChange } from "../prompts/favorites.js";
import { $, el, normalize } from "../ui.js";
import { prepareAttachment, sendChat } from "./engine.js";

const MAX_ATTACHMENTS = 5;

let getKeys = () => ({});
// Conversa: { role, text, attachments: [{ kind, name, ... }], provider }.
// Texto e nomes dos anexos ficam em storage.session; o conteúdo dos anexos,
// só em memória (o limite do storage é pequeno para imagens e PDFs).
let messages = [];
let pending = []; // anexos do próximo envio
let favorites = [];
let abort = null;
let slash = { open: false, items: [], index: 0, start: 0 };

// Links das respostas abrem em nova aba, sem acesso à extensão.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const renderMarkdown = (text) => DOMPurify.sanitize(marked.parse(stripCitations(text ?? "")));

function persist() {
  chrome.storage.session.set({
    chat: messages.map((m) => ({
      role: m.role,
      text: m.text,
      provider: m.provider ?? null,
      sources: m.sources ?? [],
      attachments: (m.attachments ?? []).map((a) => ({ kind: a.kind, name: a.name })),
    })),
  });
}

function showError(message) {
  $("chat-error").textContent = message ?? "";
  $("chat-error").hidden = !message;
}

// ---- Mensagens ------------------------------------------------------------------

function emptyState() {
  const box = el("div", "chat__empty");
  box.append(
    el("p", "title", "Como posso ajudar no seu processo seletivo hoje?"),
    el("p", "hint", "Digite / ou use o + para aplicar um prompt favorito, ou anexe documentos e imagens."),
  );
  if (favorites.length) {
    const chips = el("div", "chips");
    for (const p of favorites.slice(0, 4)) {
      const chip = el("button", "chip", `★ ${p.titulo}`);
      chip.type = "button";
      chip.addEventListener("click", () => insertPrompt(p));
      chips.append(chip);
    }
    box.append(chips);
  } else {
    box.append(el("p", "hint", "Dica: marque prompts com ☆ na aba Prompts para usá-los aqui."));
  }
  return box;
}

function messageNode(m, index) {
  const node = el("div", `msg msg--${m.role}`);
  if (m.role === "user") {
    if (m.attachments?.length) {
      const files = el("div", "msg__files");
      for (const a of m.attachments) files.append(el("span", "msg__file", `${a.kind === "image" ? "🖼" : "📄"} ${a.name}`));
      node.append(files);
    }
    if (m.text) node.append(el("div", "msg__bubble", m.text));
    return node;
  }

  const bubble = el("div", "msg__bubble");
  bubble.dataset.index = index;
  if (m.streaming && !m.text) bubble.append(el("span", "msg__typing", "Pensando"));
  else bubble.innerHTML = renderMarkdown(m.text);
  node.append(bubble);

  if (!m.streaming && m.sources?.length) {
    const sources = el("div", "msg__sources");
    sources.append(el("span", null, "Fontes:"));
    // Uma fonte por site, no máximo 4.
    const bySite = new Map();
    for (const src of m.sources) {
      const host = new URL(src.url).hostname.replace(/^www\./, "");
      if (!bySite.has(host)) bySite.set(host, src);
    }
    for (const [host, src] of [...bySite].slice(0, 4)) {
      const link = el("a", null, host);
      link.href = src.url;
      link.title = src.title;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      sources.append(link);
    }
    node.append(sources);
  }

  if (!m.streaming) {
    const meta = el("div", "msg__meta");
    const copy = el("button", "btn-link", "Copiar");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(m.text).catch(() => {});
      copy.textContent = "Copiado";
      setTimeout(() => (copy.textContent = "Copiar"), 2000);
    });
    meta.append(copy);
    if (m.provider) meta.append(el("span", null, m.provider === "claude" ? "Claude" : "Groq"));
    node.append(meta);
  }
  return node;
}

function renderMessages() {
  const box = $("chat-messages");
  box.replaceChildren(...(messages.length ? messages.map(messageNode) : [emptyState()]));
}

let frame = 0;
function updateStreaming(index) {
  // Atualiza no máximo uma vez por quadro, sem refazer a conversa inteira.
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const bubble = $("chat-messages").querySelector(`.msg__bubble[data-index="${index}"]`);
    if (bubble) bubble.innerHTML = renderMarkdown(messages[index].text);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
}

// ---- Anexos ----------------------------------------------------------------------

function renderAttachments() {
  $("chat-attachments").replaceChildren(
    ...pending.map((a, i) => {
      const li = el("li", null, `${a.kind === "image" ? "🖼" : "📄"} ${a.name}`);
      const remove = el("button", null, "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remover ${a.name}`);
      remove.addEventListener("click", () => {
        pending.splice(i, 1);
        renderAttachments();
      });
      li.append(remove);
      return li;
    }),
  );
}

async function addFiles(fileList) {
  showError(null);
  for (const file of fileList) {
    if (pending.length >= MAX_ATTACHMENTS) {
      showError(`Até ${MAX_ATTACHMENTS} anexos por mensagem.`);
      break;
    }
    try {
      pending.push(await prepareAttachment(file));
    } catch (error) {
      showError(error instanceof FriendlyError ? error.message : `Não foi possível ler "${file.name}".`);
    }
  }
  renderAttachments();
}

// ---- Prompts favoritos ("/" e "+") ------------------------------------------------

function autosize() {
  const input = $("chat-input");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function insertPrompt(prompt) {
  const input = $("chat-input");
  const value = input.value;
  // Substitui o "/termo" digitado (se houver) pelo texto do prompt.
  const before = slash.open ? value.slice(0, slash.start) : value;
  const after = slash.open ? value.slice(input.selectionStart) : "";
  const joiner = before && !before.endsWith("\n") && !slash.open ? "\n" : "";
  input.value = `${before}${joiner}${prompt.prompt}${after}`;
  closeSlash();
  autosize();
  input.focus();
  // Leva o cursor ao primeiro campo [ENTRE COLCHETES] para preencher.
  const field = input.value.indexOf("[", before.length);
  if (field >= 0) input.setSelectionRange(field, input.value.indexOf("]", field) + 1);
}

function renderSlash() {
  const box = $("chat-slash");
  box.hidden = !slash.open;
  if (!slash.open) return;
  if (!favorites.length) {
    box.replaceChildren(el("p", "slash__empty", "Nenhum prompt favorito. Marque prompts com ☆ na aba Prompts."));
    return;
  }
  if (!slash.items.length) {
    box.replaceChildren(el("p", "slash__empty", "Nenhum favorito com esse termo."));
    return;
  }
  box.replaceChildren(
    ...slash.items.map((p, i) => {
      const item = el("button", "slash__item");
      item.type = "button";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(i === slash.index));
      item.append(el("span", "slash__cat", p.categoria), p.titulo);
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // mantém o foco no campo
        insertPrompt(p);
      });
      return item;
    }),
  );
  box.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}

function openSlash(start, query = "") {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  slash = {
    open: true,
    start,
    index: 0,
    items: favorites.filter((p) => terms.every((t) => normalize(`${p.titulo} ${p.categoria} ${p.descricao}`).includes(t))),
  };
  renderSlash();
}

function closeSlash() {
  slash = { open: false, items: [], index: 0, start: 0 };
  renderSlash();
}

/** Abre a lista quando o texto antes do cursor termina em "/termo". */
function detectSlash() {
  const input = $("chat-input");
  const upToCaret = input.value.slice(0, input.selectionStart);
  const match = upToCaret.match(/(^|\s)\/([^\s/]*)$/);
  if (match) openSlash(upToCaret.length - match[2].length - 1, match[2]);
  else if (slash.open) closeSlash();
}

function toggleMenu(open) {
  const menu = $("chat-menu");
  const show = open ?? menu.hidden;
  menu.hidden = !show;
  $("chat-add").setAttribute("aria-expanded", String(show));
}

// ---- Envio -------------------------------------------------------------------------

function setBusy(busy) {
  const send = $("chat-send");
  send.classList.toggle("is-stop", busy);
  send.setAttribute("aria-label", busy ? "Parar resposta" : "Enviar");
  send.innerHTML = busy
    ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
}

async function send() {
  if (abort) {
    abort.abort();
    return;
  }
  const input = $("chat-input");
  const text = input.value.trim();
  if (!text && !pending.length) return;
  const keys = getKeys();
  if (!keys.apiKey && !keys.groqKey) return showError("Cadastre uma chave da Anthropic ou da Groq em Configurações.");
  showError(null);
  closeSlash();
  toggleMenu(false);

  messages.push({ role: "user", text, attachments: pending });
  pending = [];
  input.value = "";
  autosize();
  renderAttachments();

  const reply = { role: "assistant", text: "", streaming: true };
  messages.push(reply);
  const index = messages.length - 1;
  renderMessages();
  window.scrollTo(0, document.documentElement.scrollHeight);

  abort = new AbortController();
  setBusy(true);
  try {
    const result = await sendChat({
      keys,
      history: messages.slice(0, -1),
      signal: abort.signal,
      onText: (delta) => {
        reply.text += delta;
        updateStreaming(index);
      },
    });
    reply.text = result.text || stripCitations(reply.text);
    reply.provider = result.provider;
    reply.sources = result.sources ?? [];
  } catch (error) {
    console.error(error);
    const interrupted = abort?.signal.aborted;
    if (!reply.text) messages.pop();
    if (!interrupted) {
      showError(error instanceof FriendlyError ? error.message : "Não foi possível responder agora. Tente novamente.");
      // Devolve a mensagem ao campo para reenviar.
      if (!reply.text) {
        const last = messages.pop();
        input.value = last.text;
        pending = last.attachments ?? [];
        renderAttachments();
        autosize();
      }
    }
  } finally {
    reply.streaming = false;
    abort = null;
    setBusy(false);
    renderMessages();
    persist();
    input.focus();
  }
}

// ---- Inicialização ---------------------------------------------------------------------

export async function initChatArea({ keysGetter }) {
  getKeys = keysGetter;
  favorites = await getFavoritePrompts();
  onFavoritesChange(async () => {
    favorites = await getFavoritePrompts();
    if (!messages.length) renderMessages();
    if (slash.open) detectSlash();
  });

  const { chat } = await chrome.storage.session.get("chat");
  messages = chat ?? [];
  renderMessages();

  const input = $("chat-input");
  input.addEventListener("input", () => {
    autosize();
    detectSlash();
  });
  input.addEventListener("keydown", (e) => {
    if (slash.open && slash.items.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        slash.index = (slash.index + (e.key === "ArrowDown" ? 1 : -1) + slash.items.length) % slash.items.length;
        renderSlash();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertPrompt(slash.items[slash.index]);
        return;
      }
    }
    if (e.key === "Escape") {
      closeSlash();
      toggleMenu(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener("blur", () => setTimeout(closeSlash, 150));

  $("chat-send").addEventListener("click", send);
  $("chat-add").addEventListener("click", () => toggleMenu());
  $("chat-menu").addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    toggleMenu(false);
    if (action === "doc") $("chat-doc").click();
    if (action === "image") $("chat-image").click();
    if (action === "prompts") {
      input.focus();
      openSlash(input.selectionStart);
      // Sem "/" digitado: a escolha entra no ponto do cursor.
      slash.start = input.selectionStart;
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#chat-menu, #chat-add")) toggleMenu(false);
  });
  for (const id of ["chat-doc", "chat-image"]) {
    $(id).addEventListener("change", (e) => {
      addFiles([...e.target.files]);
      e.target.value = "";
    });
  }
  // Arrastar arquivos para a conversa também anexa.
  $("area-chat").addEventListener("dragover", (e) => e.preventDefault());
  $("area-chat").addEventListener("drop", (e) => {
    e.preventDefault();
    addFiles([...e.dataTransfer.files]);
  });

  $("chat-new").addEventListener("click", () => {
    abort?.abort();
    messages = [];
    pending = [];
    renderAttachments();
    renderMessages();
    persist();
    showError(null);
    input.focus();
  });
}
