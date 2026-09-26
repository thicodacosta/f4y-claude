/**
 * Coordenador da gravação. O painel e o offscreen document nunca falam
 * direto: tudo passa por aqui. O estado vive em chrome.storage.session
 * (chave `capture`), porque o Chrome pode suspender este service worker a
 * qualquer momento; o painel apenas reflete esse estado.
 *
 * Fases de `capture.phase`: recording → paused ↔ recording → finishing →
 * analyzing → (registro salvo em `result`) | error.
 */

import { loadKeys } from "./keys.js";

const OFFSCREEN_URL = "offscreen.html";

// Abrir o painel a partir do clique no ícone amarra a invocação àquela
// aba (activeTab), condição do Chrome para capturar o áudio dela.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
});

// Primeiro acesso: abre direto em Configurações para a empresa configurar
// logo e identidade uma única vez. (Quando houver login, este gatilho passa
// a ser o primeiro login.)
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const { onboardingDone } = await chrome.storage.local.get("onboardingDone");
  if (!onboardingDone) chrome.runtime.openOptionsPage();
});

// Mensagens chegam em paralelo (as duas trilhas transcrevem ao mesmo
// tempo); a fila evita que uma atualização sobrescreva a outra.
let queue = Promise.resolve();
function updateCapture(fn) {
  queue = queue
    .then(async () => {
      const { capture } = await chrome.storage.session.get("capture");
      if (!capture) return;
      const next = fn(capture);
      if (next) await chrome.storage.session.set({ capture: next });
      else await chrome.storage.session.remove("capture");
    })
    .catch(console.error);
  return queue;
}

function toOffscreen(message) {
  return chrome.runtime.sendMessage({ target: "offscreen", ...message });
}

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Captura o áudio da reunião e o microfone para transcrever a entrevista.",
  });
}

async function closeOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length > 0) await chrome.offscreen.closeDocument().catch(() => {});
}

async function start({ tabId, meta }) {
  const { capture } = await chrome.storage.session.get("capture");
  if (capture && capture.phase !== "error") throw new Error("Já existe uma gravação em andamento.");

  const { apiKey, groqKey } = await loadKeys();
  // A Groq transcreve (obrigatória); o registro sai pelo Claude ou pela Groq.
  if (!groqKey) throw new Error("Cadastre a chave da Groq em Configurações antes de gravar.");
  if (tabId === undefined) throw new Error("Não foi possível identificar a aba da reunião.");

  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (error) {
    throw new Error(
      "O Chrome não liberou o áudio desta aba. Com a reunião aberta, clique no ícone da extensão na barra " +
        `do Chrome e tente de novo. (Detalhe: ${error?.message ?? error})`,
    );
  }

  await ensureOffscreen();
  const response = await toOffscreen({ type: "START", streamId, keys: { anthropic: apiKey, groq: groqKey }, meta });
  if (!response?.ok) {
    await closeOffscreen();
    throw new Error(response?.error ?? "Não foi possível iniciar a gravação.");
  }

  await chrome.storage.session.remove("result");
  await chrome.storage.session.set({
    capture: {
      phase: "recording",
      meta,
      startedAt: Date.now(),
      pausedAt: null,
      pausedMs: 0,
      hasMic: response.hasMic,
      stats: { candidato: 0, recrutador: 0, falhas: 0 },
      warnings: response.warnings ?? [],
      error: null,
      transcricao: null,
    },
  });
}

async function handle(message) {
  switch (message.type) {
    // Vindas do painel
    case "START":
      await start(message);
      return;
    case "PAUSE":
      await toOffscreen({ type: "PAUSE" });
      await updateCapture((c) => (c.phase === "recording" ? { ...c, phase: "paused", pausedAt: Date.now() } : c));
      return;
    case "RESUME":
      await toOffscreen({ type: "RESUME" });
      await updateCapture((c) =>
        c.phase === "paused" ? { ...c, phase: "recording", pausedMs: c.pausedMs + (Date.now() - c.pausedAt), pausedAt: null } : c,
      );
      return;
    case "STOP":
      await updateCapture((c) => ({ ...c, phase: "finishing" }));
      await toOffscreen({ type: "STOP" });
      return;
    case "CANCEL":
      await toOffscreen({ type: "CANCEL" }).catch(() => {});
      await closeOffscreen();
      await chrome.storage.session.remove("capture");
      return;

    // Vindas do offscreen document
    case "CHUNK":
      await updateCapture((c) => {
        const stats = { ...c.stats };
        if (!message.ok) stats.falhas += 1;
        else if (message.speech) stats[message.role] += 1;
        return { ...c, stats };
      });
      return;
    case "WARNING":
      await updateCapture((c) =>
        c.warnings.includes(message.message) ? c : { ...c, warnings: [...c.warnings, message.message] },
      );
      return;
    case "PHASE":
      await updateCapture((c) => ({ ...c, phase: message.phase }));
      return;
    case "DONE": {
      const { capture } = await chrome.storage.session.get("capture");
      const meta = capture?.meta ?? {};
      await chrome.storage.session.set({
        result: {
          data: message.data,
          transcricao: message.transcricao,
          meta: {
            candidato: meta.candidato?.trim() ?? "",
            vagaTitulo: meta.vagaTitulo?.trim() ?? "",
            data: new Date().toLocaleDateString("pt-BR"),
          },
        },
      });
      await chrome.storage.session.remove("capture");
      await closeOffscreen();
      return;
    }
    case "FAILED":
      await updateCapture((c) => ({ ...c, phase: "error", error: message.error, transcricao: message.transcricao }));
      await closeOffscreen();
      return;
    default:
      return;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "background") return false;
  handle(message).then(
    () => sendResponse({ ok: true }),
    (error) => sendResponse({ ok: false, error: error.message }),
  );
  return true;
});
