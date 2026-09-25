/** Utilitários de interface compartilhados pelas abas do painel. */

export const $ = (id) => document.getElementById(id);

/** Cria um elemento; texto sempre via textContent (nunca HTML do modelo). */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function showError(id, message) {
  $(id).textContent = message ?? "";
  $(id).hidden = !message;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlCents = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** R$ sem centavos (faixas de mercado) ou com centavos (cálculos). */
export function formatBRL(value, { cents = false } = {}) {
  if (value == null || Number.isNaN(value)) return "—";
  return (cents ? brlCents : brl).format(value);
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text, statusId, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    $(statusId).textContent = successMessage;
  } catch {
    $(statusId).textContent = "Não foi possível copiar. Selecione o texto manualmente.";
  }
}

/** Cronômetro de "processando" que escreve os segundos em `elementId`. */
export function startElapsed(elementId) {
  const startedAt = Date.now();
  $(elementId).textContent = "";
  const id = setInterval(() => {
    $(elementId).textContent = `${Math.round((Date.now() - startedAt) / 1000)}s`;
  }, 1000);
  return () => clearInterval(id);
}

/** Remove acentos e caixa para buscas. */
export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
