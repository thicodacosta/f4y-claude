import { logout, requireAuth } from "./auth/gate.js";
import { isOnboarded, markOnboarded } from "./auth/onboarding.js";
import { initHeader } from "./header.js";
import { normalizeLayout } from "./cv/layout.js";
import { FriendlyError } from "./errors.js";
import { hasEmbeddedKeys, loadKeys } from "./keys.js";
import { getTheme, initTheme, setTheme } from "./theme.js";
import { DEFAULT_NOTE, loadLinkedInSettings, saveLinkedInSettings } from "./shortlist/settings.js";
import { LINKEDIN_PEOPLE_SEARCH, findLinkedInTab, linkedInStatus } from "./shortlist/runner.js";

const $ = (id) => document.getElementById(id);

// Configurações também exigem login.
await initTheme();
const user = await requireAuth();
if (user) {
  $("account-section").hidden = false;
  $("account-email").textContent = user.email;
  $("account-logout").addEventListener("click", logout);
}

// Pacote com chaves embutidas: a equipe não tem nada a configurar.
if (hasEmbeddedKeys) $("keys-section").hidden = true;

// Campo do formulário → chave em chrome.storage.local, com o prefixo esperado.
const KEYS = [
  { field: "apiKey", prefix: "sk-ant-", name: "Anthropic" },
  { field: "groqKey", prefix: "gsk_", name: "Groq" },
];

function setStatus(message) {
  $("status").textContent = message;
}

function showSaved(stored) {
  for (const { field, prefix } of KEYS) {
    $(field).value = "";
    $(field).placeholder = stored[field] ? `Chave salva (termina em …${stored[field].slice(-4)})` : `${prefix}…`;
  }
}

showSaved(await chrome.storage.local.get(KEYS.map((k) => k.field)));

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const updates = {};
  for (const { field, prefix, name } of KEYS) {
    const value = $(field).value.trim();
    if (!value) continue;
    if (!value.startsWith(prefix)) {
      setStatus(`A chave da ${name} deve começar com “${prefix}”.`);
      $(field).focus();
      return;
    }
    updates[field] = value;
  }
  if (Object.keys(updates).length === 0) {
    setStatus("Nenhuma chave nova para salvar.");
    return;
  }
  await chrome.storage.local.set(updates);
  showSaved(await chrome.storage.local.get(KEYS.map((k) => k.field)));
  setStatus("Chaves salvas. Já pode usar o painel lateral.");
});

$("clear-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove(KEYS.map((k) => k.field));
  showSaved({});
  setStatus("Chaves removidas deste navegador.");
});

// ---- Identidade dos currículos -------------------------------------------

const MAX_LOGO_BYTES = 1024 * 1024;
let branding = (await chrome.storage.local.get("branding")).branding ?? { cor: "#082043", ocultarContatos: true };

function setBrandingStatus(message) {
  $("branding-status").textContent = message;
}

function renderLogo() {
  const preview = $("logo-preview");
  if (branding.logoDataUrl) {
    preview.replaceChildren(Object.assign(document.createElement("img"), { src: branding.logoDataUrl, alt: "Logo atual" }));
  } else {
    preview.replaceChildren(Object.assign(document.createElement("span"), { className: "hint", textContent: "Nenhum logo" }));
  }
  $("logo-remove-btn").hidden = !branding.logoDataUrl;
  $("logo-btn").textContent = branding.logoDataUrl ? "Trocar imagem" : "Escolher imagem";
}

function renderBranding() {
  $("empresa").value = branding.empresa ?? "";
  $("cor").value = branding.cor ?? "#082043";
  $("cor-value").textContent = $("cor").value.toUpperCase();
  $("ocultarContatos").checked = branding.ocultarContatos ?? true;
  renderLogo();
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = dataUrl;
  });
}

$("logo-btn").addEventListener("click", () => $("logo-file").click());
$("logo-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!["image/png", "image/jpeg"].includes(file.type)) return setBrandingStatus("Use uma imagem PNG ou JPG.");
  if (file.size > MAX_LOGO_BYTES) return setBrandingStatus("A imagem passa de 1 MB. Use uma versão menor.");
  try {
    const logoDataUrl = await readAsDataUrl(file);
    const { width, height } = await imageSize(logoDataUrl);
    branding = { ...branding, logoDataUrl, logoType: file.type === "image/png" ? "png" : "jpg", logoWidth: width, logoHeight: height };
    renderLogo();
    setBrandingStatus("Logo carregado. Clique em “Salvar identidade” para aplicar.");
  } catch {
    setBrandingStatus("Não foi possível ler esta imagem.");
  }
});

$("logo-remove-btn").addEventListener("click", () => {
  const { logoDataUrl, logoType, logoWidth, logoHeight, ...rest } = branding;
  branding = rest;
  renderLogo();
  setBrandingStatus("Logo removido. Clique em “Salvar identidade” para aplicar.");
});

$("cor").addEventListener("input", () => {
  $("cor-value").textContent = $("cor").value.toUpperCase();
});

$("branding-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  branding = {
    ...branding,
    empresa: $("empresa").value.trim(),
    cor: $("cor").value,
    ocultarContatos: $("ocultarContatos").checked,
  };
  await chrome.storage.local.set({ branding });
  await markOnboarded(user);
  setBrandingStatus("Identidade salva. O painel e os próximos currículos já usam este padrão.");
  if (!$("welcome").hidden) {
    $("welcome").hidden = true;
    $("welcome-done").hidden = false;
    $("page-title").textContent = "Configurações";
    $("welcome-done").scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

renderBranding();

// ---- Modelo de currículo -------------------------------------------------------

const MAX_MODEL_BYTES = 10 * 1024 * 1024;
/** Resumo, em português, do que foi reconhecido no modelo. */
function describeLayout(l) {
  const where = { esquerda: "à esquerda", centro: "centralizado", direita: "à direita" };
  return [
    `logo ${where[l.logoPosicao]}${l.linhaCabecalho ? " com linha abaixo" : ", sem linha"}`,
    `nome ${where[l.nomeAlinhamento]}${l.nomeMaiusculo ? " em maiúsculas" : ""}`,
    { faixa: "títulos pequenos com linha", destaque: "títulos grandes em negrito", sublinhado: "títulos em negrito com linha" }[l.estiloTitulos],
    l.experienciaFormato === "linha_unica"
      ? `experiência em uma linha (${l.experienciaCabecalho === "empresa_primeiro" ? "Empresa — Cargo" : "Cargo — Empresa"} | Período)`
      : `experiência com ${l.experienciaCabecalho === "empresa_primeiro" ? "a empresa" : "o cargo"} em destaque`,
    l.atividadesFormato === "paragrafo" ? "atividades em parágrafo" : "atividades em tópicos",
    l.formacaoFormato === "lista" ? "formação em lista" : "formação em blocos",
  ].join(" · ");
}

async function renderCvModel() {
  const { cvModelo } = await chrome.storage.local.get("cvModelo");
  const list = $("cv-model-sections");
  $("cv-model-remove").hidden = !cvModelo;
  $("cv-model-btn").textContent = cvModelo ? "Trocar modelo" : "Enviar modelo";
  if (!cvModelo) {
    $("cv-model-status").textContent = "Nenhum modelo: os currículos saem no padrão.";
    list.hidden = true;
    return;
  }
  const layout = normalizeLayout(cvModelo.layout);
  $("cv-model-status").textContent = `Modelo: ${cvModelo.fileName}. Reconhecido: ${describeLayout(layout)}. Seções, nesta ordem:`;
  list.replaceChildren(...layout.secoes.map((s) => Object.assign(document.createElement("li"), { textContent: s.titulo })));
  list.hidden = false;
}

$("cv-model-btn").addEventListener("click", () => $("cv-model-file").click());
$("cv-model-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!/\.(pdf|docx)$/i.test(file.name)) return ($("cv-model-status").textContent = "Use um arquivo PDF ou Word (.docx).");
  if (file.size > MAX_MODEL_BYTES) return ($("cv-model-status").textContent = "O arquivo passa de 10 MB. Use uma versão menor.");
  const { groqKey } = await loadKeys();
  if (!groqKey) return ($("cv-model-status").textContent = "Cadastre a chave da Groq antes de enviar o modelo.");
  const button = $("cv-model-btn");
  button.disabled = true;
  $("cv-model-status").textContent = "Lendo o modelo e reconhecendo o visual… (10 a 30 segundos)";
  try {
    const { analyzeCvModel } = await import("./cv/model.js");
    const layout = await analyzeCvModel({ groqKey, file });
    await chrome.storage.local.set({ cvModelo: { fileName: file.name, layout, savedAt: Date.now() } });
    await renderCvModel();
  } catch (error) {
    console.error(error);
    $("cv-model-status").textContent =
      error instanceof FriendlyError ? error.message : "Não foi possível ler este modelo. Tente outro arquivo.";
  } finally {
    button.disabled = false;
  }
});
$("cv-model-remove").addEventListener("click", async () => {
  await chrome.storage.local.remove("cvModelo");
  await renderCvModel();
});
await renderCvModel();

// ---- Aparência ---------------------------------------------------------------

initHeader();
const temaAtual = await getTheme();
for (const radio of document.querySelectorAll('input[name="tema"]')) {
  radio.checked = radio.value === temaAtual;
  radio.addEventListener("change", () => setTheme(radio.value));
}
// Alternado pelo botão do painel: mantém a opção marcada em sincronia.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !("tema" in changes)) return;
  for (const radio of document.querySelectorAll('input[name="tema"]')) {
    radio.checked = radio.value === (changes.tema.newValue ?? "auto");
  }
});

// ---- Primeiro acesso ----------------------------------------------------------
// Aberta na instalação (ou pelo painel) antes da identidade ser configurada:
// modo de boas-vindas, direto no que precisa ser ajustado.

if (!(await isOnboarded(user))) {
  $("welcome").hidden = false;
  $("page-title").textContent = "Configure sua empresa";
}

// Aberta pelo painel com #curriculos: rola direto até a identidade.
if (location.hash === "#curriculos") $("branding-title").scrollIntoView();

// ---- Integração com o LinkedIn ---------------------------------------------------

function renderLinkedInStatus(settings) {
  const node = $("li-status");
  node.textContent = settings.conectado ? "Conectado ao LinkedIn neste Chrome." : "Não conectado.";
  node.classList.toggle("is-ok", settings.conectado);
  $("li-connect").textContent = settings.conectado ? "Verificar de novo" : "Conectar ao LinkedIn";
}

function renderNoteCount() {
  $("li-modelo-count").textContent = $("li-modelo").value.length;
}

const liSettings = await loadLinkedInSettings();
$("li-assinatura").value = liSettings.assinatura;
$("li-incluir-nota").checked = liSettings.incluirNota;
$("li-personalizar").checked = liSettings.personalizarNota;
$("li-modelo").value = liSettings.modeloNota;
$("li-aderencia").value = String(liSettings.aderenciaMinima);
$("li-sem-nota").checked = liSettings.enviarSemNota;
renderNoteCount();
renderLinkedInStatus(liSettings);

$("li-modelo").addEventListener("input", renderNoteCount);
$("li-reset").addEventListener("click", () => {
  $("li-modelo").value = DEFAULT_NOTE;
  renderNoteCount();
});

$("li-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveLinkedInSettings({
    assinatura: $("li-assinatura").value.trim(),
    incluirNota: $("li-incluir-nota").checked,
    personalizarNota: $("li-personalizar").checked,
    modeloNota: $("li-modelo").value.trim() || DEFAULT_NOTE,
    aderenciaMinima: Number($("li-aderencia").value),
    enviarSemNota: $("li-sem-nota").checked,
  });
  $("li-form-status").textContent = "Configurações do LinkedIn salvas.";
});

/**
 * "Conectar": não existe API oficial para isso; a integração usa a sessão do
 * LinkedIn aberta neste Chrome. Abre o LinkedIn (se preciso) e confirma o login.
 */
$("li-connect").addEventListener("click", async () => {
  const button = $("li-connect");
  button.disabled = true;
  $("li-status").textContent = "Verificando o LinkedIn…";
  try {
    let tab = await findLinkedInTab();
    if (!tab) {
      tab = await chrome.tabs.create({ url: LINKEDIN_PEOPLE_SEARCH, active: false });
      await new Promise((resolve) => {
        const listener = (id, info) => {
          if (id === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
    const status = await linkedInStatus(tab.id);
    await saveLinkedInSettings({ conectado: status.loggedIn });
    renderLinkedInStatus({ conectado: status.loggedIn });
    if (!status.loggedIn) {
      $("li-status").textContent = "Faça login no LinkedIn na aba que abriu e clique em “Verificar de novo”.";
      chrome.tabs.update(tab.id, { active: true });
    }
  } catch (error) {
    console.error(error);
    $("li-status").textContent = "Não foi possível verificar. Abra o LinkedIn, faça login e tente de novo.";
  } finally {
    button.disabled = false;
  }
});
