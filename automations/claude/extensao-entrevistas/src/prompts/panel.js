/** Aba "Prompts": biblioteca com busca e filtro por categoria. */
import { $, el, normalize } from "../ui.js";
import { CATEGORIES, PROMPTS } from "./library.js";

const ALL = "Todos";
let category = ALL;

// Índice de busca pré-calculado (título, descrição, categoria e texto).
const index = PROMPTS.map((p) => ({ prompt: p, haystack: normalize(`${p.titulo} ${p.descricao} ${p.categoria} ${p.prompt}`) }));

function renderChips() {
  $("pr-cats").replaceChildren(
    ...[ALL, ...CATEGORIES].map((name) => {
      const chip = el("button", "chip", name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(name === category));
      chip.addEventListener("click", () => {
        category = name;
        renderChips();
        renderList();
      });
      return chip;
    }),
  );
}

function promptItem(p) {
  const li = el("li", "prompt-item");
  const details = el("details");
  const pre = el("pre", null, p.prompt);
  const copy = el("button", "btn btn--primary btn--sm", "Copiar prompt");
  copy.type = "button";
  const status = el("span", "hint");
  status.setAttribute("role", "status");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(p.prompt);
      status.textContent = "Copiado.";
    } catch {
      status.textContent = "Não foi possível copiar.";
    }
    setTimeout(() => (status.textContent = ""), 2500);
  });
  const actions = el("div", "prompt-item__actions");
  actions.append(copy, status);
  details.append(el("summary", null, "Ver prompt"), pre);
  li.append(
    el("p", "prompt-item__cat", p.categoria),
    el("p", "prompt-item__title", p.titulo),
    el("p", "prompt-item__desc", p.descricao),
    details,
    actions,
  );
  return li;
}

/** Radical simples: "salário", "salarial" e "salariais" encontram uns aos outros. */
const stem = (term) => (term.length > 4 ? term.replace(/(ais|al|is|os|as|es|o|a|e|s)$/, "") : term);

function renderList() {
  const terms = normalize($("pr-search").value).split(/\s+/).filter(Boolean).map(stem);
  const matches = index
    .filter(({ prompt }) => category === ALL || prompt.categoria === category)
    .filter(({ haystack }) => terms.every((t) => haystack.includes(t)))
    .map(({ prompt }) => prompt);

  $("pr-count").textContent =
    matches.length === 1 ? "1 prompt encontrado" : `${matches.length} prompts encontrados`;
  $("pr-list").replaceChildren(
    ...(matches.length ? matches.map(promptItem) : [el("li", "empty", "Nenhum prompt encontrado. Tente outro termo.")]),
  );
}

export function initPromptsArea() {
  $("pr-search").addEventListener("input", renderList);
  renderChips();
  renderList();
}
