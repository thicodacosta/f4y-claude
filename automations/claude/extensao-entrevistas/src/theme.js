/**
 * Tema da interface: "auto" (segue o sistema), "light" ou "dark". Guardado em
 * chrome.storage.local (vale para todas as páginas da extensão) e espelhado
 * em localStorage para o theme-init.js aplicar antes da primeira pintura.
 */

const media = window.matchMedia("(prefers-color-scheme: dark)");

function apply(tema) {
  if (tema === "light" || tema === "dark") document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem("tema", tema);
  } catch {
    // opcional
  }
  document.dispatchEvent(new CustomEvent("themechange"));
}

/** Tema efetivamente em uso agora: "light" ou "dark". */
export function effectiveTheme() {
  return document.documentElement.dataset.theme ?? (media.matches ? "dark" : "light");
}

export async function getTheme() {
  return (await chrome.storage.local.get("tema")).tema ?? "auto";
}

export function setTheme(tema) {
  return chrome.storage.local.set({ tema });
}

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

/** Botão do cabeçalho que alterna entre claro e escuro. */
function bindToggle(button) {
  const render = () => {
    const dark = effectiveTheme() === "dark";
    // Ícones fixos (sem conteúdo do usuário): seguro usar innerHTML.
    button.innerHTML = dark ? SUN : MOON;
    const label = dark ? "Usar tema claro" : "Usar tema escuro";
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  button.addEventListener("click", () => setTheme(effectiveTheme() === "dark" ? "light" : "dark"));
  document.addEventListener("themechange", render);
  media.addEventListener("change", render);
  render();
}

export async function initTheme() {
  apply(await getTheme());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "tema" in changes) apply(changes.tema.newValue ?? "auto");
  });
  const toggle = document.getElementById("theme-toggle");
  if (toggle) bindToggle(toggle);
}
