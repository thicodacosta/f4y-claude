/** Aba "Shortlist": JD → busca manual no LinkedIn → conexão automática com os aderentes. */
import { FriendlyError } from "../errors.js";
import { $, copyText, el, showError } from "../ui.js";
import {
  LINKEDIN_PEOPLE_SEARCH,
  MAX_INVITES,
  findLinkedInTab,
  runShortlist,
  statusLabel,
  suggestSearch,
} from "./runner.js";
import { loadLinkedInSettings } from "./settings.js";

let getGroqKey = () => null;
let abort = null;
let job = null; // análise da JD (reaproveitada ao iniciar, se a JD não mudou)
let jobJd = "";
let candidates = [];
let openedThisSession = false;

function show(section) {
  $("sl-form").hidden = section !== "form";
  $("sl-running").hidden = section !== "running";
  $("sl-result").hidden = section !== "result";
}

// ---- Lista de candidatos -------------------------------------------------------

function candidateItem(c) {
  const li = el("li", "cv-item");
  const top = el("div", "cv-item__top");
  const text = el("div", "cv-item__text");
  const name = el("p", "cv-item__name");
  const link = el("a", null, c.nome);
  link.href = c.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  name.append(link);
  if (c.aderencia != null) name.append(" · ", el("span", "sl-score", `${c.aderencia}%`));
  const detail = [c.cargoAtual, c.empresaAtual, c.local].filter(Boolean).join(" · ");
  const ok = c.status === "enviado" || c.status === "simulado";
  const statusClass = c.status === "analisando" ? " is-working" : ok ? " is-ok" : "";
  text.append(
    name,
    ...(detail ? [el("p", "cv-item__status", detail)] : []),
    el("p", `cv-item__status${statusClass}`, c.status === "analisando" ? "Analisando…" : statusLabel(c.status)),
  );
  if (c.resumo) text.append(el("p", "cv-item__status", c.resumo));
  top.append(text);
  li.append(top);
  return li;
}

let minScore = 70;

/** Só os aderentes (e o perfil em análise) aparecem; os demais entram na contagem. */
function isAdherent(c) {
  return c.aderencia != null && c.aderencia >= minScore;
}

function renderList() {
  const visible = candidates.filter((c) => c.status === "analisando" || isAdherent(c));
  $("sl-list").replaceChildren(...visible.map(candidateItem));
  const analyzed = candidates.filter((c) => c.status !== "analisando");
  const below = analyzed.filter((c) => !isAdherent(c)).length;
  $("sl-analyzed").textContent = analyzed.length
    ? `Perfis analisados: ${analyzed.length} · abaixo de ${minScore}% ou indisponíveis (não listados): ${below}`
    : "";
}

function upsert(candidate) {
  const i = candidates.findIndex((c) => c.url === candidate.url);
  if (i >= 0) candidates[i] = candidate;
  else candidates.push(candidate);
  renderList();
}

function summaryText(result) {
  const invited = result.candidates.filter((c) => c.status === "enviado" || c.status === "simulado");
  const adherent = result.candidates.filter(isAdherent);
  const lines = [
    `Shortlist: ${result.job.tituloVaga}${result.dryRun ? " (simulação)" : ""}`,
    `Data: ${new Date().toLocaleDateString("pt-BR")}`,
    `${result.dryRun ? "Convites preparados" : "Convites enviados"}: ${invited.length} de ${result.limit} · ` +
      `perfis analisados: ${result.candidates.length} · aderentes (${minScore}% ou mais): ${adherent.length}`,
    "",
    ...adherent.map(
      (c, i) =>
        `${i + 1}. ${c.nome}${c.aderencia != null ? ` (${c.aderencia}%)` : ""}: ${statusLabel(c.status)}` +
        `${c.cargoAtual ? `\n   ${[c.cargoAtual, c.empresaAtual, c.local].filter(Boolean).join(" · ")}` : ""}\n   ${c.url}`,
    ),
  ];
  for (const c of invited.filter((x) => x.nota)) lines.push("", `Nota para ${c.nome}: "${c.nota}"`);
  return lines.join("\n");
}

let lastResult = null;

// ---- LinkedIn --------------------------------------------------------------------

async function openLinkedIn(url = LINKEDIN_PEOPLE_SEARCH) {
  const tab = await findLinkedInTab();
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    if (url !== LINKEDIN_PEOPLE_SEARCH) await chrome.tabs.update(tab.id, { url });
    return tab;
  }
  return chrome.tabs.create({ url, active: true });
}

/** Ao abrir a Shortlist pela primeira vez na sessão, abre o LinkedIn. */
export async function onShortlistShown() {
  const settings = await loadLinkedInSettings();
  const setup = $("sl-setup");
  setup.hidden = settings.conectado;
  if (!settings.conectado) {
    setup.replaceChildren(
      "Conecte o LinkedIn em ",
      Object.assign(document.createElement("a"), { href: "options.html", target: "_blank", textContent: "Configurações" }),
      " antes da primeira Shortlist.",
    );
  }
  $("sl-min").value = String(settings.aderenciaMinima);
  if (!abort) minScore = settings.aderenciaMinima;
  if (openedThisSession || abort) return;
  openedThisSession = true;
  if (!(await findLinkedInTab())) await openLinkedIn();
}

async function suggestTerms() {
  showError("sl-error", null);
  const jd = $("sl-jd").value.trim();
  const groqKey = getGroqKey();
  if (!groqKey) return showError("sl-error", "Cadastre a chave da Groq em Configurações.");
  if (jd.length < 100) return showError("sl-error", "Cole a descrição completa da vaga primeiro.");
  const button = $("sl-suggest");
  button.disabled = true;
  button.textContent = "Analisando a vaga…";
  try {
    job = await suggestSearch({ apiKey: groqKey, jd });
    jobJd = jd;
    $("sl-terms").hidden = false;
    $("sl-terms").replaceChildren(
      ...job.termosBusca.map((term) => {
        const chip = el("button", "chip", term);
        chip.type = "button";
        chip.title = "Buscar este termo no LinkedIn";
        chip.addEventListener("click", () => {
          const url = new URL(LINKEDIN_PEOPLE_SEARCH);
          url.searchParams.set("keywords", term);
          openLinkedIn(url.href);
        });
        return chip;
      }),
    );
  } catch (error) {
    console.error(error);
    showError("sl-error", error instanceof FriendlyError ? error.message : "Não foi possível analisar a vaga.");
  } finally {
    button.disabled = false;
    button.textContent = "Sugerir termos de busca";
  }
}

// ---- Execução ----------------------------------------------------------------------

async function start(event) {
  event.preventDefault();
  showError("sl-error", null);
  const jd = $("sl-jd").value.trim();
  const groqKey = getGroqKey();
  if (!groqKey) return showError("sl-error", "Cadastre a chave da Groq em Configurações.");
  if (jd.length < 100) return showError("sl-error", "Cole a descrição completa da vaga.");

  const tab = await findLinkedInTab();
  if (!tab) {
    await openLinkedIn();
    return showError("sl-error", "Abrimos o LinkedIn: faça a busca de pessoas e depois clique em “Iniciar Shortlist”.");
  }

  const settings = await loadLinkedInSettings();
  const quantidade = Math.min(Number($("sl-qtd").value), MAX_INVITES);
  minScore = Number($("sl-min").value);
  const dryRun = $("sl-dry").checked;
  candidates = [];
  renderList();
  abort = new AbortController();
  $("sl-mode").textContent = dryRun ? "Simulação em andamento" : "Shortlist em andamento";
  $("sl-progress").textContent = `0/${quantidade}`;
  $("sl-status").textContent = "Iniciando…";
  show("running");
  await chrome.tabs.update(tab.id, { active: true });

  try {
    lastResult = await runShortlist({
      groqKey,
      tabId: tab.id,
      jd,
      job: jd === jobJd ? job : null,
      quantidade,
      aderenciaMinima: minScore,
      settings,
      dryRun,
      signal: abort.signal,
      onEvent: (e) => {
        if (e.type === "status") $("sl-status").textContent = e.text;
        if (e.type === "candidate") {
          upsert(e.candidate);
          const done = candidates.filter((c) => c.status === "enviado" || c.status === "simulado").length;
          $("sl-progress").textContent = `${done}/${quantidade}`;
        }
      },
    });
    const done = lastResult.candidates.filter((c) => c.status === "enviado" || c.status === "simulado").length;
    $("sl-summary").textContent =
      `${dryRun ? "Simulação concluída" : "Shortlist concluída"}: ${done} de ${quantidade} ${dryRun ? "convites preparados" : "convites enviados"}. ` +
      `${lastResult.candidates.length} perfis analisados; ${lastResult.candidates.filter(isAdherent).length} com ${minScore}% ou mais.` +
      (done < quantidade ? " Não havia mais perfis aderentes nesta busca: amplie a busca no LinkedIn (cargo, localidade) e rode de novo." : "");
    show("result");
  } catch (error) {
    console.error(error);
    lastResult = { job: job ?? { tituloVaga: "vaga" }, candidates, limit: quantidade, dryRun };
    $("sl-summary").textContent = error instanceof FriendlyError ? error.message : "A Shortlist parou por um erro inesperado.";
    show(candidates.length ? "result" : "form");
    if (!candidates.length) showError("sl-error", $("sl-summary").textContent);
  } finally {
    abort = null;
  }
}

export function initShortlistArea({ groqKeyGetter }) {
  getGroqKey = groqKeyGetter;
  $("sl-form").addEventListener("submit", start);
  $("sl-suggest").addEventListener("click", suggestTerms);
  $("sl-open").addEventListener("click", () => openLinkedIn());
  $("sl-clear").addEventListener("click", () => {
    $("sl-jd").value = "";
    job = null;
    jobJd = "";
    $("sl-terms").hidden = true;
    $("sl-terms").replaceChildren();
    showError("sl-error", null);
    $("sl-jd").focus();
  });
  $("sl-stop").addEventListener("click", () => {
    $("sl-status").textContent = "Parando após a ação atual…";
    abort?.abort();
  });
  $("sl-copy").addEventListener("click", () => copyText(summaryText(lastResult), "sl-copy-status", "Resumo copiado."));
  // Cada Shortlist tem no máximo 5 convites: para mais, recomeça.
  $("sl-new").addEventListener("click", () => {
    candidates = [];
    lastResult = null;
    renderList();
    $("sl-copy-status").textContent = "";
    show("form");
  });
  show("form");
}
