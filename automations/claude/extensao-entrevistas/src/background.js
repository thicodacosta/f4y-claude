/**
 * Coordenador da gravação. O painel e o offscreen document nunca falam
 * direto: tudo passa por aqui. O estado vive em chrome.storage.session
 * (chave `capture`), porque o Chrome pode suspender este service worker a
 * qualquer momento; o painel apenas reflete esse estado.
 *
 * Fases de `capture.phase`: recording → paused ↔ recording → finishing →
 * analyzing → (registro salvo em `result`) | error.
 */

import { registrar } from "./atividades.js";
import { loadKeys } from "./keys.js";

const OFFSCREEN_URL = "offscreen.html";

// Abrir o painel a partir do clique no ícone amarra a invocação àquela
// aba (activeTab), condição do Chrome para capturar o áudio dela.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
  startPending(tab.id);
});

// O painel continua aberto ao trocar de aba, então a recrutadora pode clicar
// em "Iniciar gravação" numa aba onde o ícone nunca foi clicado. Nesse caso o
// painel deixa o pedido em `pendingStart` e a gravação começa no próximo
// clique no ícone, já com a aba da reunião liberada.
const PENDING_START_MS = 3 * 60_000;

async function startPending(tabId) {
  const { pendingStart } = await chrome.storage.session.get("pendingStart");
  if (!pendingStart) return;
  await chrome.storage.session.remove("pendingStart");
  if (Date.now() - pendingStart.at > PENDING_START_MS) return;
  try {
    await start({ tabId, meta: pendingStart.meta });
  } catch (error) {
    await chrome.storage.session.set({
      startError: { message: error.message, code: error.code ?? null, tabId, meta: pendingStart.meta },
    });
  }
}

// Plataformas de reunião no navegador. Gravar outra aba (ex.: Agenda) só
// capta silêncio: acontece quando a reunião está aberta como aplicativo
// (janela sem barra de endereço), onde o ícone da extensão não aparece.
const MEETING_HOST =
  /(^|\.)(meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|teams\.cloud\.microsoft|zoom\.us|zoom\.com|zoomgov\.com|webex\.com|whereby\.com|meet\.jit\.si|8x8\.vc|skype\.com|discord\.com)$/i;

function isMeetingTab(tab) {
  try {
    return MEETING_HOST.test(new URL(tab.url).hostname);
  } catch {
    return true; // sem URL (aba não liberada): a checagem fica para depois
  }
}

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

async function start({ tabId, meta, force = false }) {
  const { capture } = await chrome.storage.session.get("capture");
  if (capture && capture.phase !== "error") throw new Error("Já existe uma gravação em andamento.");

  const { apiKey, groqKey } = await loadKeys();
  // A Groq transcreve (obrigatória); o registro sai pelo Claude ou pela Groq.
  if (!groqKey) throw new Error("Cadastre a chave da Groq em Configurações antes de gravar.");
  if (tabId === undefined) throw new Error("Não foi possível identificar a aba da reunião.");

  // Título e endereço da aba (liberados pelo clique no ícone, activeTab).
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!force && tab?.url && !isMeetingTab(tab)) {
    throw Object.assign(
      new Error(
        `A aba escolhida não é uma reunião (“${tab.title || "sem título"}”). Abra a reunião numa aba do Chrome, ` +
          "clique no ícone do Candydate nessa aba e inicie de novo. Se o Meet, o Teams ou o Zoom estiver aberto " +
          "como aplicativo (janela sem barra de endereço), use o menu ⋮ dessa janela → “Abrir no Chrome”.",
      ),
      { code: "not_meeting", tabId },
    );
  }

  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (error) {
    console.warn("tabCapture:", error);
    const notInvoked = /not been invoked|activeTab/i.test(error?.message ?? "");
    throw Object.assign(
      new Error(
        notInvoked
          ? "Falta liberar o áudio desta aba."
          : "O Chrome não permite gravar esta aba. Abra a aba da reunião (Meet, Teams ou Zoom no navegador) e tente de novo.",
      ),
      { code: notInvoked ? "not_invoked" : "capture_blocked" },
    );
  }

  await ensureOffscreen();
  const response = await toOffscreen({ type: "START", streamId, keys: { anthropic: apiKey, groq: groqKey }, meta });
  if (!response?.ok) {
    await closeOffscreen();
    throw new Error(response?.error ?? "Não foi possível iniciar a gravação.");
  }

  await chrome.storage.session.remove(["result", "pendingStart", "startError"]);
  await chrome.storage.session.set({
    capture: {
      phase: "recording",
      meta,
      tabTitle: tab?.title ?? null,
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
    case "LEVEL":
      await updateCapture((c) => {
        const prev = c.levels?.[message.role] ?? { max: 0 };
        const level = { last: message.rms, max: Math.max(prev.max, message.rms), at: Date.now() };
        return { ...c, levels: { ...c.levels, [message.role]: level } };
      });
      return;
    case "WARNING_CLEAR":
      await updateCapture((c) => ({ ...c, warnings: c.warnings.filter((w) => w !== message.message) }));
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
      registrar("entrevista", {
        candidato: meta.candidato?.trim() ?? "",
        vaga: meta.vagaTitulo?.trim() ?? "",
        origem: "gravacao",
        duracaoMin: capture ? Math.round(((capture.pausedAt ?? Date.now()) - capture.startedAt - capture.pausedMs) / 6000) / 10 : null,
        semCandidato: Boolean(message.aviso),
      });
      await chrome.storage.session.set({
        result: {
          data: message.data,
          transcricao: message.transcricao,
          aviso: message.aviso ?? null,
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
    (error) => sendResponse({ ok: false, error: error.message, code: error.code, tabId: error.tabId }),
  );
  return true;
});
