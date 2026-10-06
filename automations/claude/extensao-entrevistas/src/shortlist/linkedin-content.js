/**
 * Roda dentro da aba do LinkedIn, injetado pela Shortlist. Só lê: os
 * resultados da busca de pessoas e os perfis abertos. Não clica em Conectar,
 * não envia convites nem mensagens.
 *
 * O LinkedIn troca nomes de classes com frequência: tudo aqui se orienta por
 * textos visíveis e rótulos de acessibilidade (português e inglês), não por
 * classes.
 */
(() => {
  if (window.__f4yLinkedIn) return;
  window.__f4yLinkedIn = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (text) => (text ?? "").replace(/\s+/g, " ").trim();
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
      cards.set(url, {
        url,
        name,
        text: text.slice(0, 600),
        firstDegree: FIRST_DEGREE.test(text),
      });
    }
    return [...cards.values()];
  }

  // ---- Perfil -----------------------------------------------------------------

  /**
   * Topo do perfil (nome, título, botões). O LinkedIn atual não usa h1 no
   * perfil: procura o h1 e, sem ele, a primeira seção do conteúdo principal.
   */
  function topCard() {
    const main = document.querySelector("main") ?? document.body;
    const h1 = main.querySelector("h1");
    return h1?.closest("section") ?? main.querySelector("section") ?? main;
  }

  // Seções do perfil que interessam à avaliação e as que só trazem ruído
  // (posts, anúncios, sugestões de outros perfis).
  const RELEVANT_SECTION =
    /^(sobre|about|experiência|experience|formação|education|licenças|licenses|certifica|competências|skills|idiomas|languages|projetos|projects|cursos|courses|prêmios|honors|publicações|publications|trabalho voluntário|volunteer|recomendações|recommendations)/i;
  const EXPERIENCE_SECTION = /^(experiência|experience)\b/i;

  /**
   * Linhas de texto sem repetição: o LinkedIn escreve cada texto duas vezes
   * (uma visível e outra para leitores de tela).
   */
  function textLines(node) {
    const lines = [];
    for (const raw of (node?.innerText ?? "").split("\n")) {
      const line = clean(raw);
      if (line && line !== lines[lines.length - 1]) lines.push(line);
    }
    return lines;
  }

  /** Seções de primeiro nível do conteúdo principal, com o título de cada uma. */
  function profileSections() {
    const main = document.querySelector("main") ?? document.body;
    return [...main.querySelectorAll("section")]
      .filter((s) => !s.parentElement?.closest("main section"))
      .map((section) => {
        const lines = textLines(section);
        const heading = clean(section.querySelector('h2, h3, [role="heading"]')?.innerText) || lines[0] || "";
        return { section, title: heading.split(/\s{2,}/)[0], lines };
      });
  }

  // Pela seção ou, se o LinkedIn não usar <section>, por um título solto.
  const hasExperience = () =>
    profileSections().some((s) => EXPERIENCE_SECTION.test(s.title)) ||
    textLines(document.querySelector("main")).some((line) => /^(experiência|experience)$/i.test(line));

  /**
   * Rola o perfil até o fim, em passos, para o LinkedIn carregar as seções
   * (Experiência, Formação, Competências só aparecem ao rolar).
   */
  async function loadWholeProfile() {
    let lastHeight = 0;
    let stable = 0;
    for (let i = 0; i < 14 && stable < 2; i++) {
      window.scrollBy(0, Math.round(window.innerHeight * 0.8));
      await sleep(650);
      const height = document.documentElement.scrollHeight;
      const atBottom = window.scrollY + window.innerHeight >= height - 20;
      stable = atBottom && height === lastHeight ? stable + 1 : 0;
      lastHeight = height;
    }
    await waitFor(hasExperience, 4000);
    window.scrollTo(0, 0);
  }

  async function readProfile() {
    // Espera o topo do perfil carregar (o LinkedIn mostra esqueletos antes).
    await waitFor(() => clean(document.querySelector("main")?.innerText).length > 400, 15000);
    await loadWholeProfile();

    const card = topCard();
    const cardText = clean(card.innerText);
    const sections = profileSections();
    const relevant = sections.filter((s) => s.section !== card && RELEVANT_SECTION.test(s.title));
    // Texto para a IA: topo do perfil (nome, título, local) + seções
    // profissionais. Sem as seções reconhecidas, usa o conteúdo todo.
    const text = relevant.length
      ? [textLines(card).join("\n"), ...relevant.map((s) => s.lines.join("\n"))].join("\n\n")
      : textLines(document.querySelector("main")).join("\n");
    return {
      url: profileUrl(location.href),
      name: clean(document.querySelector("main h1, main h2")?.innerText),
      firstDegree: FIRST_DEGREE.test(cardText),
      // Linha abaixo do nome: o título profissional do perfil.
      headline: textLines(card).find((line, i) => i > 0 && !/^·|^\d+º|^(he|she|ele|ela)\//i.test(line)) ?? "",
      hasExperience: hasExperience(),
      sections: relevant.map((s) => s.title),
      text: text.slice(0, 14000),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.target !== "linkedin") return false;
    const run = {
      status: async () => status(),
      readSearch,
      readProfile,
    }[message.cmd];
    if (!run) return false;
    Promise.resolve(run())
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  });
})();
