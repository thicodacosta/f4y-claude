/**
 * Aba "Shortlist": JD → busca manual no LinkedIn → ranking de até 10
 * candidatos com compatibilidade de 0 a 100 e o link de cada perfil. Só lê o
 * LinkedIn: não conecta nem envia convites ou mensagens.
 */
import { FriendlyError } from "../errors.js";
import { $, copyText, el, saveBlob, showError } from "../ui.js";
import {
  LINKEDIN_PEOPLE_SEARCH,
  MAX_CANDIDATES,
  createPauser,
  findLinkedInTab,
  runShortlist,
  suggestSearch,
} from "./runner.js";
import { loadLinkedInSettings } from "./settings.js";
import { registrar } from "../atividades.js";

let getGroqKey = () => null;
let abort = null;
let pauser = null;
let lastStatus = "";
let candidates = [];
let minScore = 70;
let lastResult = null;
let openedThisSession = false;

const LEVEL_LABEL = { atende: "Atende", parcial: "Parcial", nao_evidenciado: "Não evidenciado" };

function show(section) {
  $("sl-form").hidden = section !== "form";
  $("sl-running").hidden = section !== "running";
  $("sl-result").hidden = section !== "result";
}

const isCompatible = (c) => c.compatibilidade != null && c.compatibilidade >= minScore;
const byScore = (a, b) => (b.compatibilidade ?? -1) - (a.compatibilidade ?? -1);

// ---- Ranking -------------------------------------------------------------------

function candidateItem(c, position) {
  const li = el("li", "cv-item sl-candidate");
  const text = el("div", "cv-item__text");
  const name = el("p", "cv-item__name");
  if (position) name.append(el("span", "sl-rank", `${position}º`), " ");
  const link = el("a", null, c.nome);
  link.href = c.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  name.append(link);
  if (c.compatibilidade != null) name.append(" · ", el("span", "sl-score", `${c.compatibilidade}%`));
  text.append(name);

  if (c.status === "analisando") {
    text.append(el("p", "cv-item__status is-working", "Analisando…"));
  } else if (c.status === "erro") {
    text.append(el("p", "cv-item__status is-error", c.detalhe ?? "Não foi possível ler o perfil."));
  } else {
    const detail = [c.titulo, c.conexao].filter(Boolean).join(" · ");
    if (detail) text.append(el("p", "cv-item__status", detail));
    if (c.resumo) text.append(el("p", "cv-item__status", c.resumo));
    if (c.semExperiencia) {
      text.append(el("p", "cv-item__status", "O LinkedIn não mostrou a seção de experiência; a análise considerou só o topo do perfil."));
    }
    const url = el("p", "cv-item__status sl-url");
    const urlLink = el("a", null, c.url.replace("https://www.", ""));
    urlLink.href = c.url;
    urlLink.target = "_blank";
    urlLink.rel = "noopener noreferrer";
    url.append(urlLink);
    text.append(url);

    if (c.avaliacoes?.length) {
      const details = el("details", "sl-reqs");
      details.append(el("summary", null, "Avaliação por requisito"));
      const list = el("ul", "sl-reqs__list");
      for (const a of c.avaliacoes) {
        const item = el("li", `sl-req is-${a.nivel}`);
        item.append(
          el("span", "sl-req__level", LEVEL_LABEL[a.nivel]),
          el("span", "sl-req__desc", `${a.descricao}${a.tipo === "desejavel" ? " (desejável)" : ""}`),
          ...(a.evidencia ? [el("span", "sl-req__evidence", a.evidencia)] : []),
        );
        list.append(item);
      }
      details.append(list);
      text.append(details);
    }
  }
  li.append(text);
  return li;
}

function renderList() {
  const compatible = candidates.filter(isCompatible).sort(byScore);
  const analyzing = candidates.filter((c) => c.status === "analisando");
  $("sl-list").replaceChildren(
    ...compatible.map((c, i) => candidateItem(c, i + 1)),
    ...analyzing.map((c) => candidateItem(c)),
  );

  const others = candidates.filter((c) => c.status !== "analisando" && !isCompatible(c)).sort(byScore);
  $("sl-below").replaceChildren(...others.map((c) => candidateItem(c)));
  $("sl-below-box").hidden = others.length === 0;
  $("sl-below-title").textContent = `Perfis abaixo de ${minScore}% ou não lidos (${others.length})`;

  const analyzed = candidates.filter((c) => c.status !== "analisando");
  $("sl-analyzed").textContent = analyzed.length
    ? `Perfis analisados: ${analyzed.length} · com ${minScore}% ou mais: ${compatible.length}`
    : "";
}

function upsert(candidate) {
  const i = candidates.findIndex((c) => c.url === candidate.url);
  if (i >= 0) candidates[i] = candidate;
  else candidates.push(candidate);
  renderList();
}

function rankingText(result) {
  const compatible = result.candidates.filter(isCompatible).sort(byScore);
  const lines = [
    `Shortlist: ${result.job?.vaga?.titulo ?? "vaga"}`,
    `Data: ${new Date().toLocaleDateString("pt-BR")}`,
    `Candidatos com ${minScore}% ou mais: ${compatible.length} · perfis analisados: ${result.candidates.length}`,
    "",
    ...compatible.map(
      (c, i) =>
        `${i + 1}. ${c.nome} (${c.compatibilidade}%)${c.titulo ? `\n   ${c.titulo}` : ""}${c.resumo ? `\n   ${c.resumo}` : ""}\n   ${c.url}`,
    ),
  ];
  return lines.join("\n");
}

/** Planilha (.csv, separador ";" para o Excel em português). */
function rankingCsv(result) {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [["Posição", "Nome", "Compatibilidade (%)", "Título", "Resumo", "LinkedIn", "Acima do mínimo"]];
  result.candidates
    .filter((c) => c.compatibilidade != null)
    .sort(byScore)
    .forEach((c, i) => rows.push([i + 1, c.nome, c.compatibilidade, c.titulo, c.resumo, c.url, isCompatible(c) ? "Sim" : "Não"]));
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

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
  if (!abort) {
    $("sl-min").value = String(settings.aderenciaMinima);
    minScore = settings.aderenciaMinima;
  }
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
    const search = await suggestSearch({ apiKey: groqKey, jd });
    $("sl-terms").hidden = false;
    $("sl-terms").replaceChildren(
      ...search.termosBusca.map((term) => {
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

function setPauseButton(paused) {
  const button = $("sl-pause");
  button.textContent = paused ? "Retomar busca" : "Pausar busca";
  button.setAttribute("aria-pressed", String(paused));
  button.classList.toggle("btn--primary", paused);
  button.classList.toggle("btn--ghost", !paused);
}

function finish(result, quantidade) {
  lastResult = result;
  registrar("shortlist", {
    vaga: result.job?.vaga?.titulo ?? "",
    pedidos: quantidade,
    encontrados: result.candidates.filter(isCompatible).length,
    analisados: result.candidates.filter((c) => c.compatibilidade != null).length,
    finalizada: Boolean(result.finishedEarly),
  });
  const compatible = result.candidates.filter(isCompatible).length;
  const parts = [
    `${result.finishedEarly ? "Shortlist finalizada por você" : "Shortlist concluída"}: ${compatible} de ${quantidade} candidatos com ${minScore}% ou mais.`,
    `${result.candidates.length} perfis analisados.`,
  ];
  if (!result.finishedEarly && compatible < quantidade) {
    parts.push("Não havia mais perfis compatíveis nesta busca: amplie a busca no LinkedIn (cargo, localidade) e rode de novo.");
  }
  $("sl-summary").textContent = parts.join(" ");
  // Perfis que ficaram "analisando" (ex.: erro no meio) saem da lista.
  candidates = candidates.filter((c) => c.status !== "analisando");
  renderList();
  show("result");
}

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

  const quantidade = Math.min(Number($("sl-qtd").value), MAX_CANDIDATES);
  minScore = Number($("sl-min").value);
  candidates = [];
  renderList();
  abort = new AbortController();
  pauser = createPauser();
  setPauseButton(false);
  $("sl-stop").disabled = false;
  $("sl-mode").textContent = "Shortlist em andamento";
  $("sl-progress").textContent = `0/${quantidade}`;
  $("sl-status").textContent = "Iniciando…";
  show("running");
  await chrome.tabs.update(tab.id, { active: true });

  try {
    const result = await runShortlist({
      groqKey,
      tabId: tab.id,
      jd,
      quantidade,
      aderenciaMinima: minScore,
      signal: abort.signal,
      pauser,
      onEvent: (e) => {
        if (e.type === "status") {
          lastStatus = e.text;
          if (!pauser.paused) $("sl-status").textContent = e.text;
        }
        if (e.type === "paused") {
          $("sl-mode").textContent = "Shortlist pausada";
          $("sl-status").textContent = "Pausada. A aba do LinkedIn está livre; clique em “Retomar busca” para continuar.";
        }
        if (e.type === "resumed") {
          $("sl-mode").textContent = "Shortlist em andamento";
          $("sl-status").textContent = lastStatus;
        }
        if (e.type === "removed") {
          candidates = candidates.filter((c) => c.url !== e.url);
          renderList();
        }
        if (e.type === "candidate") {
          upsert(e.candidate);
          $("sl-progress").textContent = `${candidates.filter(isCompatible).length}/${quantidade}`;
        }
      },
    });
    finish(result, quantidade);
  } catch (error) {
    console.error(error);
    const message = error instanceof FriendlyError ? error.message : "A Shortlist parou por um erro inesperado.";
    if (candidates.some((c) => c.status !== "analisando")) {
      finish({ job: null, candidates, finishedEarly: true }, quantidade);
      $("sl-summary").textContent = `${message} Abaixo, o que foi analisado até aqui.`;
    } else {
      show("form");
      showError("sl-error", message);
    }
  } finally {
    abort = null;
    pauser = null;
  }
}

export function initShortlistArea({ groqKeyGetter }) {
  getGroqKey = groqKeyGetter;
  $("sl-form").addEventListener("submit", start);
  $("sl-suggest").addEventListener("click", suggestTerms);
  $("sl-open").addEventListener("click", () => openLinkedIn());
  $("sl-clear").addEventListener("click", () => {
    $("sl-jd").value = "";
    $("sl-terms").hidden = true;
    $("sl-terms").replaceChildren();
    showError("sl-error", null);
    $("sl-jd").focus();
  });
  $("sl-pause").addEventListener("click", () => {
    if (!pauser) return;
    if (pauser.paused) {
      pauser.resume();
      setPauseButton(false);
      $("sl-status").textContent = "Retomando…";
    } else {
      pauser.pause();
      setPauseButton(true);
      $("sl-status").textContent = "Pausando após a ação atual…";
    }
  });
  // "Finalizar": encerra antes da quantidade escolhida e mostra o ranking até aqui.
  $("sl-stop").addEventListener("click", () => {
    if (!abort) return;
    $("sl-status").textContent = "Finalizando e montando o ranking…";
    $("sl-stop").disabled = true;
    pauser?.resume();
    abort.abort();
  });
  $("sl-copy").addEventListener("click", () => copyText(rankingText(lastResult), "sl-copy-status", "Ranking copiado."));
  $("sl-csv").addEventListener("click", () => {
    const date = new Date().toISOString().slice(0, 10);
    saveBlob(new Blob([rankingCsv(lastResult)], { type: "text/csv;charset=utf-8" }), `shortlist-${date}.csv`);
  });
  $("sl-new").addEventListener("click", () => {
    candidates = [];
    lastResult = null;
    renderList();
    $("sl-copy-status").textContent = "";
    show("form");
  });
  show("form");
}
