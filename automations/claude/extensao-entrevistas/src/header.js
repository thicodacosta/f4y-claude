/**
 * Logo do cabeçalho: o da empresa do usuário (Configurações → Currículos
 * padronizados). Sem logo, mostra o nome da empresa; sem nada configurado,
 * a marca da plataforma (Candydate).
 */
const DEFAULT_LOGO = "icons/candydate-logo.png";

function render(branding = {}) {
  const img = document.getElementById("header-logo");
  const name = document.getElementById("header-name");
  if (!img || !name) return;
  if (branding.logoDataUrl) {
    img.src = branding.logoDataUrl;
    img.classList.remove("topbar__logo--marca");
    img.alt = branding.empresa || "Logo da empresa";
    img.hidden = false;
    name.hidden = true;
  } else if (branding.empresa) {
    name.textContent = branding.empresa;
    name.hidden = false;
    img.hidden = true;
  } else {
    img.src = DEFAULT_LOGO;
    // Logo da plataforma: já funciona em fundo claro e escuro, sem moldura.
    img.classList.add("topbar__logo--marca");
    img.alt = "Candydate";
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
