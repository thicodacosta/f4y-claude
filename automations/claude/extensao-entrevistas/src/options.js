const $ = (id) => document.getElementById(id);

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
let branding = (await chrome.storage.local.get("branding")).branding ?? { cor: "#0b6fa6", ocultarContatos: true };

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
  $("cor").value = branding.cor ?? "#0b6fa6";
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
  setBrandingStatus("Identidade salva. Os próximos currículos já sairão neste padrão.");
});

renderBranding();

// Aberta pelo painel com #curriculos: rola direto até a identidade.
if (location.hash === "#curriculos") $("branding-title").scrollIntoView();
