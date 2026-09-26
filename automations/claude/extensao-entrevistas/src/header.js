/**
 * Logo do cabeçalho: o da empresa do usuário (Configurações → Currículos
 * padronizados). Sem logo, mostra o nome da empresa; sem nada configurado,
 * a marca do produto.
 */
const DEFAULT_LOGO = "icons/wordmark.png";

function render(branding = {}) {
  const img = document.getElementById("header-logo");
  const name = document.getElementById("header-name");
  if (!img || !name) return;
  if (branding.logoDataUrl) {
    img.src = branding.logoDataUrl;
    img.alt = branding.empresa || "Logo da empresa";
    img.hidden = false;
    name.hidden = true;
  } else if (branding.empresa) {
    name.textContent = branding.empresa;
    name.hidden = false;
    img.hidden = true;
  } else {
    img.src = DEFAULT_LOGO;
    img.alt = "Find4You";
    img.hidden = false;
    name.hidden = true;
  }
}

export async function initHeader() {
  render((await chrome.storage.local.get("branding")).branding);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "branding" in changes) render(changes.branding.newValue);
  });
}
