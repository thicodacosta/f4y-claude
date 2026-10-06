/**
 * Orquestra a Shortlist na aba do LinkedIn: lê a busca de pessoas feita pela
 * recrutadora, abre os perfis mais promissores um a um e avalia cada um
 * frente à JD, até encontrar a quantidade pedida (máx. 10) de candidatos com
 * a compatibilidade mínima. Devolve o ranking de 0 a 100 com os links.
 *
 * Só lê páginas: não conecta, não envia convites nem mensagens. A avaliação
 * usa o método único do Comparativo (src/compare/method.js), então a
 * compatibilidade de um perfil não diverge da de um currículo.
 *
 * Roda no painel lateral: fechar o painel interrompe a execução.
 */
import { evaluateCandidates, extractRequirements } from "../compare/method.js";
import { FriendlyError } from "../errors.js";
import { screenCards, suggestSearchTerms } from "./ai.js";

export const MAX_CANDIDATES = 10;
// Perfis abertos por candidato pedido: limita a execução mesmo se poucos
// forem compatíveis (muitos ficam abaixo do mínimo).
const PROFILES_PER_CANDIDATE = 4;
const MAX_PROFILES = 40;
const MAX_PAGES = 5;
// Relevância mínima na triagem dos cartões para valer abrir o perfil.
const MIN_CARD_RELEVANCE = 40;
const CONTENT_SCRIPT = "dist/linkedin-content.js";
// Ritmo de leitura de uma pessoa entre um perfil e outro.
const PACE = [4_000, 8_000];

export const LINKEDIN_PEOPLE_SEARCH = "https://www.linkedin.com/search/results/people/";

const STOPPED = "Shortlist finalizada.";

/**
 * Pausa pedida pela recrutadora ("Pausar busca"). A Shortlist termina a ação
 * em andamento e para no próximo ponto seguro (antes de abrir ou avaliar um
 * perfil), até "Retomar".
 */
export function createPauser() {
  let paused = false;
  let release = null;
  let gate = Promise.resolve();
  return {
    get paused() {
      return paused;
    },
    pause() {
      if (paused) return;
      paused = true;
      gate = new Promise((resolve) => (release = resolve));
    },
    resume() {
      if (!paused) return;
      paused = false;
      release();
    },
    /** Espera enquanto estiver pausado; "Finalizar" encerra mesmo pausado. */
    wait(signal) {
      if (!paused) return Promise.resolve();
      return new Promise((resolve, reject) => {
        gate.then(resolve);
        signal?.addEventListener("abort", () => reject(new FriendlyError(STOPPED)));
      });
    },
  };
}

function sleep([min, max], signal) {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new FriendlyError(STOPPED));
    });
  });
}

async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
}

async function command(tabId, cmd) {
  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, { target: "linkedin", cmd });
  } catch {
    // A página recarregou e perdeu o script: injeta de novo e repete.
    await inject(tabId);
    response = await chrome.tabs.sendMessage(tabId, { target: "linkedin", cmd });
  }
  if (!response?.ok) throw new FriendlyError(`Falha ao ler o LinkedIn (${response?.error ?? "sem resposta"}).`);
  return response.result;
}

/**
 * Limite por minuto da Groq (plano gratuito: 8 mil tokens/min): espera e
 * tenta de novo, em vez de perder o perfil. O limite diário não é repetido.
 */
async function withRateLimitRetry(fn, { signal, say, name }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const perMinute = error instanceof FriendlyError && /Limite de uso da Groq atingido/.test(error.message);
      if (!perMinute || attempt >= 4 || signal?.aborted) throw error;
      say(`Limite por minuto da Groq: aguardando para avaliar ${name}…`);
      await sleep([30_000, 35_000], signal);
    }
  }
}

/** Abre uma página na aba do LinkedIn e injeta o script de leitura. */
function navigate(tabId, url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new FriendlyError("O LinkedIn demorou demais para carregar a página."));
    }, 25_000);
    function listener(id, info) {
      if (id !== tabId || info.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      inject(tabId).then(resolve, reject);
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.update(tabId, { url });
  });
}

/** Aba do LinkedIn a usar: a ativa, se for do LinkedIn; senão a mais recente. */
export async function findLinkedInTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.url?.startsWith("https://www.linkedin.com/")) return active;
  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
  return tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0] ?? null;
}

/** Status da sessão do LinkedIn numa aba (logado? em qual página?). */
export async function linkedInStatus(tabId) {
  await inject(tabId);
  return command(tabId, "status");
}

export function suggestSearch({ apiKey, jd, signal }) {
  return suggestSearchTerms({ apiKey, jd, signal });
}

/**
 * Executa a Shortlist. `onEvent` recebe { type: "status", text },
 * { type: "candidate", candidate }, { type: "paused" } e { type: "resumed" }.
 * "Finalizar" (abort) não é erro: devolve o ranking encontrado até ali.
 */
export async function runShortlist({ groqKey, tabId, jd, quantidade, aderenciaMinima, signal, pauser, onEvent }) {
  const limit = Math.min(Math.max(1, quantidade), MAX_CANDIDATES);
  const maxProfiles = Math.min(limit * PROFILES_PER_CANDIDATE, MAX_PROFILES);
  const candidates = [];
  const seen = new Set();
  let found = 0;
  let opened = 0;
  let job = null;
  let searchUrl = null;
  let finishedEarly = false;

  const emit = (candidate) => onEvent?.({ type: "candidate", candidate: { ...candidate } });
  const say = (text) => onEvent?.({ type: "status", text });
  // Ponto seguro: confere "Finalizar" e espera se a recrutadora pausou.
  const checkpoint = async () => {
    if (signal?.aborted) throw new FriendlyError(STOPPED);
    if (pauser?.paused) {
      onEvent?.({ type: "paused" });
      await pauser.wait(signal);
      onEvent?.({ type: "resumed" });
    }
  };

  say("Verificando a página do LinkedIn…");
  const status = await linkedInStatus(tabId);
  if (!status.loggedIn) throw new FriendlyError("Entre na sua conta do LinkedIn nesta aba e tente de novo.");
  if (status.page !== "search") {
    throw new FriendlyError("Deixe aberta, na aba do LinkedIn, a página de resultados da busca de pessoas e tente de novo.");
  }
  searchUrl = status.url;

  try {
    say("Lendo os requisitos da vaga…");
    job = await extractRequirements({ apiKey: groqKey, jdText: jd, signal });

    for (let page = 1; page <= MAX_PAGES && found < limit && opened < maxProfiles; page++) {
      await checkpoint();
      if (page > 1) {
        const url = new URL(searchUrl);
        url.searchParams.set("page", String(page));
        say(`Indo para a página ${page} da busca…`);
        try {
          await navigate(tabId, url.href);
        } catch {
          break; // sem mais páginas carregáveis: encerra com o que achou
        }
        await sleep(PACE, signal);
      }

      say(`Lendo os resultados da página ${page}…`);
      const cards = (await command(tabId, "readSearch")).filter((c) => !seen.has(c.url));
      if (!cards.length) break;
      say("Selecionando os perfis mais promissores…");
      const ranked = (await screenCards({ apiKey: groqKey, vaga: job.vaga, requisitos: job.requisitos, cards, signal }))
        .filter((c) => c.relevancia >= MIN_CARD_RELEVANCE)
        .sort((a, b) => b.relevancia - a.relevancia);

      for (const card of ranked) {
        if (found >= limit || opened >= maxProfiles) break;
        await checkpoint();
        seen.add(card.url);
        opened++;

        const candidate = { nome: card.name, url: card.url, status: "analisando", compatibilidade: null };
        candidates.push(candidate);
        emit(candidate);

        try {
          say(`Abrindo o perfil de ${card.name}…`);
          await navigate(tabId, card.url);
          let profile = await command(tabId, "readProfile");
          // Sem a seção de experiência a avaliação fica injusta (só o título):
          // recarrega o perfil uma vez antes de avaliar.
          if (!profile.hasExperience) {
            say(`Carregando as experiências de ${card.name}…`);
            await navigate(tabId, card.url);
            profile = await command(tabId, "readProfile");
          }

          await checkpoint();
          say(`Avaliando ${card.name} frente à vaga…`);
          const evaluate = () =>
            evaluateCandidates({
              apiKey: groqKey,
              vaga: job.vaga,
              requisitos: job.requisitos,
              candidatos: [{ rotulo: profile.url ?? card.url, texto: profile.text }],
              signal,
            });
          const {
            candidatos: [evaluation],
          } = await withRateLimitRetry(evaluate, { signal, say, name: card.name });
          Object.assign(candidate, {
            nome: evaluation.nome || profile.name || card.name,
            titulo: profile.headline || null,
            conexao: profile.firstDegree ? "1º grau" : null,
            compatibilidade: evaluation.compatibilidade,
            resumo: evaluation.resumo,
            pontosFortes: evaluation.pontosFortes,
            lacunas: evaluation.lacunas,
            avaliacoes: job.requisitos.map((r) => {
              const a = evaluation.avaliacoes.find((x) => x.requisitoId === r.id);
              return { descricao: r.descricao, tipo: r.tipo, nivel: a?.nivel ?? "nao_evidenciado", evidencia: a?.evidencia ?? "" };
            }),
            semExperiencia: !profile.hasExperience,
            status: evaluation.compatibilidade >= aderenciaMinima ? "compativel" : "abaixo",
          });
          if (candidate.status === "compativel") found++;
        } catch (error) {
          if (signal?.aborted) {
            // Finalizado no meio da análise: o perfil não entra no ranking.
            candidates.splice(candidates.indexOf(candidate), 1);
            onEvent?.({ type: "removed", url: candidate.url });
            throw error;
          }
          // Perfil que não carregou: pula, sem derrubar a Shortlist.
          console.warn(`Shortlist: perfil ignorado (${card.url})`, error);
          Object.assign(candidate, { status: "erro", detalhe: error instanceof FriendlyError ? error.message : "Não foi possível ler o perfil." });
        }
        emit(candidate);
        if (found < limit) await sleep(PACE, signal);
      }
    }
  } catch (error) {
    if (!signal?.aborted) throw error;
    finishedEarly = true;
  }

  // Termina na página de busca da recrutadora.
  say("Voltando para a sua busca…");
  await navigate(tabId, searchUrl).catch(() => {});
  return { job, candidates, found, limit, finishedEarly };
}
