/**
 * Utilitários de interface do BP. Texto sempre por textContent (nunca HTML
 * vindo de dados ou do modelo).
 */

export const $ = (id) => document.getElementById(id);

/**
 * Cria um elemento: h("button", { class: "btn", onclick }, "Texto", filho).
 * Atributos `on*` viram ouvintes; `true` vira atributo vazio; null/false somem.
 */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "value" && "value" in node) node.value = v;
    else if (k === "checked" || k === "selected" || k === "disabled") node[k] = Boolean(v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

/** replaceChildren que aceita listas e ignora null/false (como h()). */
export function encher(node, ...filhos) {
  node.replaceChildren(...filhos.flat(Infinity).filter((f) => f != null && f !== false));
  return node;
}

/** SVG a partir de marcação fixa do próprio código (ícones). */
export function icone(nome) {
  const span = document.createElement("span");
  span.className = "ico";
  span.setAttribute("aria-hidden", "true");
  // Marcação fixa, sem dados do usuário.
  span.innerHTML = ICONES[nome] ?? "";
  return span;
}

const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONES = {
  pdf: s('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 18v-6M9 15l3 3 3-3"/>'),
  motion: s('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
  mais: s('<path d="M12 5v14M5 12h14"/>'),
  link: s('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  voltar: s('<path d="M15 18l-6-6 6-6"/>'),
  ia: s('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  lixo: s('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
};

/** Mensagem de erro/estado em um nó (texto). */
export function aviso(node, mensagem, tipo = "error") {
  node.className = tipo;
  node.textContent = mensagem ?? "";
  node.hidden = !mensagem;
}

/** Notificação breve no rodapé do painel. */
export function toast(mensagem) {
  let box = $("toast");
  if (!box) {
    box = h("div", { id: "toast", class: "toast", role: "status", "aria-live": "polite" });
    document.body.append(box);
  }
  box.textContent = mensagem;
  box.classList.add("is-on");
  clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.remove("is-on"), 3200);
}

/**
 * Janela modal (<dialog>). `conteudo(fechar)` monta o corpo; devolve uma
 * Promise resolvida com o valor passado a `fechar(valor)`.
 */
export function modal(titulo, conteudo, { largo = false } = {}) {
  return new Promise((resolve) => {
    const dialog = h("dialog", { class: `modal${largo ? " modal--largo" : ""}`, "aria-label": titulo });
    const fechar = (valor) => {
      dialog.close();
      dialog.remove();
      resolve(valor);
    };
    const corpo = h("div", { class: "modal__corpo" });
    dialog.append(
      h("div", { class: "modal__topo" }, h("h2", { class: "subtitle", text: titulo }), h("button", { type: "button", class: "btn-link", onclick: () => fechar(null), "aria-label": "Fechar" }, "Fechar")),
      corpo,
    );
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      fechar(null);
    });
    document.body.append(dialog);
    corpo.append(conteudo(fechar));
    dialog.showModal();
    dialog.querySelector("input, select, textarea")?.focus();
  });
}

export async function confirmar(texto, acao = "Confirmar") {
  return modal("Confirmar", (fechar) =>
    h(
      "div",
      {},
      h("p", { text: texto }),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn btn--primary", onclick: () => fechar(true) }, acao),
        h("button", { type: "button", class: "btn btn--ghost", onclick: () => fechar(false) }, "Cancelar"),
      ),
    ),
  );
}

/** Campo rotulado. */
export function campo(rotulo, controle, dica) {
  const id = controle.id || `c${Math.random().toString(36).slice(2, 9)}`;
  controle.id = id;
  return h("div", { class: "field" }, h("label", { for: id, text: rotulo }), controle, dica ? h("p", { class: "hint", text: dica }) : null);
}

export function select(opcoes, valor, attrs = {}) {
  return h(
    "select",
    attrs,
    opcoes.map(([v, rotulo]) => h("option", { value: v, selected: v === valor }, rotulo)),
  );
}

/** Indicador (número de destaque). */
export function kpi(rotulo, valor, detalhe, tom) {
  return h(
    "div",
    { class: `kpi${tom ? ` kpi--${tom}` : ""}` },
    h("span", { class: "kpi__rotulo", text: rotulo }),
    h("strong", { class: "kpi__valor", text: valor }),
    detalhe ? h("span", { class: "kpi__detalhe", text: detalhe }) : null,
  );
}

/** Etiqueta de estado com texto (cor nunca sozinha). */
export function selo(texto, tom = "neutro") {
  return h("span", { class: `selo selo--${tom}`, text: texto });
}

export function vazio(texto, acao) {
  return h("div", { class: "vazio" }, h("p", { text: texto }), acao ?? null);
}

/** Botão de carregamento: desabilita e troca o texto enquanto `fn` roda. */
export async function ocupado(botao, textoOcupado, fn) {
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoOcupado;
  try {
    return await fn();
  } finally {
    botao.disabled = false;
    botao.textContent = original;
  }
}
