/**
 * Roda dentro da aba do LinkedIn, injetado pela Shortlist. Lê a busca de
 * pessoas e os perfis, e executa "Conectar → Adicionar nota → Enviar".
 *
 * O LinkedIn troca nomes de classes com frequência: tudo aqui se orienta por
 * textos visíveis e rótulos de acessibilidade (português e inglês), não por
 * classes. Nunca envia nada sem um comando explícito da extensão.
 */
(() => {
  if (window.__f4yLinkedIn) return;
  window.__f4yLinkedIn = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (text) => (text ?? "").replace(/\s+/g, " ").trim();
  // offsetParent não serve: é null em elementos com position: fixed (os
  // diálogos do LinkedIn).
  const visible = (el) =>
    Boolean(el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
  // "1º"/"1st" = já é conexão. (\b não funciona depois de "º".)
  const FIRST_DEGREE = /(^|[^\d])1º|\b1st\b/;

  async function waitFor(fn, timeout = 8000, step = 250) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = fn();
      if (value) return value;
      await sleep(step);
    }
    return null;
  }

  const label = (el) => clean(el.getAttribute("aria-label") || el.innerText || el.textContent);

  /** Botões/itens clicáveis visíveis dentro de `root` cujo texto ou rótulo casa com `pattern`. */
  function findClickable(root, pattern) {
    return [...root.querySelectorAll('button, a, [role="button"], [role="menuitem"], div[tabindex]')].find(
      (el) => visible(el) && pattern.test(label(el)),
    );
  }

  function profileUrl(href) {
    try {
      const url = new URL(href, location.origin);
      const match = url.pathname.match(/^\/in\/[^/]+/);
      return match ? `${url.origin}${match[0]}/` : null;
    } catch {
      return null;
    }
  }

  function status() {
    const loggedIn = !document.querySelector('form[action*="login"], input#session_key, input#username');
    const page = location.pathname.startsWith("/search/results/people")
      ? "search"
      : location.pathname.startsWith("/in/")
        ? "profile"
        : "other";
    return { loggedIn, page, url: location.href };
  }

  // ---- Busca de pessoas -----------------------------------------------------

  // Botão de ação de um cartão de resultado. Cada cartão tem um só.
  const ACTION = /^(conectar|connect|seguir|follow|mensagem|enviar mensagem|message|pendente|pending)$/i;
  const actionCount = (el) =>
    [...el.querySelectorAll("button, a")].filter((b) => ACTION.test(clean(b.innerText || b.textContent))).length;

  /**
   * Cartão do resultado: sobe a partir do link do perfil enquanto o ancestral
   * tiver no máximo um botão de ação. Não depende de tags nem classes, que
   * mudam a cada versão do LinkedIn.
   */
  function cardFor(anchor, root) {
    let el = anchor;
    while (el.parentElement && el.parentElement !== root && actionCount(el.parentElement) <= 1) {
      el = el.parentElement;
    }
    return el;
  }

  /** Cartões dos resultados da busca de pessoas, um por perfil. */
  async function readSearch() {
    const main = document.querySelector("main") ?? document.body;
    // Espera os resultados aparecerem (a página mostra esqueletos antes).
    await waitFor(() => main.querySelectorAll('a[href*="/in/"]').length >= 3, 12000);
    // Os resultados carregam aos poucos: rola até o fim para trazer todos.
    for (let i = 0; i < 4; i++) {
      window.scrollBy(0, window.innerHeight);
      await sleep(700);
    }
    window.scrollTo(0, 0);

    const cards = new Map();
    for (const anchor of main.querySelectorAll('a[href*="/in/"]')) {
      const url = profileUrl(anchor.getAttribute("href"));
      const name = clean(anchor.innerText)
        .split(/ • | · |\n/)[0]
        .replace(/^Ver perfil de /i, "")
        .trim();
      // Links sem nome (foto) ou de conexões em comum não abrem cartão novo.
      if (!url || cards.has(url) || !name || name.length > 80) continue;
      if (/membro do linkedin|linkedin member/i.test(name)) continue;
      const card = cardFor(anchor, main);
      // O dono do cartão é o primeiro perfil com nome; os demais links (ex.:
      // "conexão em comum") não são candidatos.
      const owner = [...card.querySelectorAll('a[href*="/in/"]')].find((a) => clean(a.innerText));
      if (owner && profileUrl(owner.getAttribute("href")) !== url) continue;
      const text = clean(card.innerText);
      if (/^(promovido|promoted)\b/i.test(text)) continue;
      cards.set(url, { url, name, text: text.slice(0, 600), firstDegree: FIRST_DEGREE.test(text) });
    }
    return [...cards.values()];
  }

  // ---- Perfil -----------------------------------------------------------------

  function topCard() {
    const h1 = document.querySelector("main h1");
    return h1?.closest("section") ?? document.querySelector("main") ?? document.body;
  }

  async function readProfile() {
    await waitFor(() => document.querySelector("main h1"), 12000);
    // Carrega as seções de experiência, que aparecem ao rolar.
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, window.innerHeight);
      await sleep(700);
    }
    window.scrollTo(0, 0);
    const card = topCard();
    const cardText = clean(card.innerText);
    return {
      url: profileUrl(location.href),
      name: clean(document.querySelector("main h1")?.innerText),
      firstDegree: FIRST_DEGREE.test(cardText),
      pending: Boolean(findClickable(card, /^(pendente|pending)\b/i)),
      text: clean(document.querySelector("main")?.innerText).slice(0, 9000),
    };
  }

  // ---- Conectar ---------------------------------------------------------------

  const CONNECT = /^(conectar|connect)$|(convidar|invite) .*(conectar|connect)/i;
  const MORE = /^(mais|more)$|mais ações|more actions/i;
  const ADD_NOTE = /adicionar (uma )?nota|add a note/i;
  const SEND = /^(enviar|send)( convite| invitation| now| agora)?$/i;
  const SEND_WITHOUT_NOTE = /enviar sem (uma )?nota|send without a note/i;
  const CLOSE = /^(cancelar|cancel|fechar|dismiss|descartar)$|fechar|dismiss/i;

  // Diálogos do LinkedIn: role="dialog" (artdeco-modal) ou <dialog> nativo.
  const DIALOG = '[role="dialog"], [role="alertdialog"], dialog[open], [aria-modal="true"], .artdeco-modal';
  const dialog = () => [...document.querySelectorAll(DIALOG)].find(visible);
  // Campo da nota: textarea ou, em versões novas, um editor de texto rico.
  const NOTE_FIELD = 'textarea, [contenteditable="true"], [role="textbox"]';
  const noteField = () => {
    const d = dialog();
    return d && [...d.querySelectorAll(NOTE_FIELD)].find(visible);
  };

  async function closeDialog() {
    const d = dialog();
    const close = d && (findClickable(d, CLOSE) ?? d.querySelector('button[aria-label]'));
    close?.click();
    await sleep(500);
  }

  /** Escreve no campo de forma que o LinkedIn reconheça (como se fosse digitado). */
  function typeInto(field, text) {
    field.focus();
    if (field.isContentEditable) {
      document.execCommand("selectAll", false);
      document.execCommand("insertText", false, text);
      return;
    }
    field.select?.();
    const ok = document.execCommand("insertText", false, text);
    if (!ok || field.value !== text) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(field, text);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  async function openConnectDialog() {
    const card = topCard();
    let button = findClickable(card, CONNECT);
    if (!button) {
      const more = findClickable(card, MORE);
      if (!more) return false;
      more.click();
      button = await waitFor(() => {
        const menus = [...document.querySelectorAll('[role="menu"], .artdeco-dropdown__content, [data-test-dropdown]')].filter(visible);
        for (const menu of menus) {
          const item = findClickable(menu, CONNECT);
          if (item) return item;
        }
        return null;
      }, 3000);
      if (!button) {
        document.body.click();
        return false;
      }
    }
    button.click();
    return Boolean(await waitFor(dialog, 6000));
  }

  const enabled = (b) => b && !b.disabled && b.getAttribute("aria-disabled") !== "true";

  /**
   * `dialogOnly`: a página de convite já foi aberta pela extensão
   * (linkedin.com/preload/custom-invite/…): só espera o diálogo.
   */
  async function connect({ note, allowNoNote, dryRun, dialogOnly = false }) {
    if (dialogOnly) {
      if (!(await waitFor(dialog, 10000))) return { status: "sem_botao" };
    } else {
      if (findClickable(topCard(), /^(pendente|pending)\b/i)) return { status: "pendente" };
      if (!(await openConnectDialog())) return { status: "sem_botao" };
    }

    // Alguns perfis pedem o e-mail do candidato para convidar.
    if (dialog()?.querySelector('input[type="email"]')) {
      await closeDialog();
      return { status: "exige_email" };
    }

    // Com nota: "Adicionar nota" abre o campo. Sem o botão (ex.: limite de
    // notas da conta gratuita), só segue sem nota se o usuário permitir.
    let field = noteField();
    if (!field && note) {
      const addNote = findClickable(dialog(), ADD_NOTE);
      if (addNote) {
        addNote.click();
        field = await waitFor(noteField, 5000);
      }
    }
    const withNote = Boolean(field && note);
    if (note && !withNote && !allowNoNote) {
      await closeDialog();
      return { status: "sem_nota" };
    }
    if (withNote) {
      const max = Number(field.getAttribute("maxlength")) || 300;
      typeInto(field, note.slice(0, max));
      await sleep(400);
    }

    const send = await waitFor(() => {
      const d = dialog();
      if (!d) return null;
      const button = withNote ? findClickable(d, SEND) : findClickable(d, SEND_WITHOUT_NOTE) ?? findClickable(d, SEND);
      return enabled(button) ? button : null;
    }, 5000);
    if (!send) {
      await closeDialog();
      return { status: "erro", detail: "Botão de envio não encontrado." };
    }
    if (dryRun) {
      await closeDialog();
      return { status: "simulado", withNote };
    }

    send.click();
    const closed = await waitFor(() => !dialog(), 8000);
    if (!closed) return { status: "erro", detail: "O LinkedIn não fechou o convite após o envio." };
    const pending = dialogOnly ? null : await waitFor(() => findClickable(topCard(), /^(pendente|pending)\b/i), 4000);
    return { status: "enviado", withNote, confirmed: Boolean(pending) };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.target !== "linkedin") return false;
    const run = {
      status: async () => status(),
      readSearch,
      readProfile,
      connect: () => connect(message),
    }[message.cmd];
    if (!run) return false;
    Promise.resolve(run())
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  });
})();
