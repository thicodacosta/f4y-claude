/**
 * Orquestra a Shortlist na aba do LinkedIn: lê a busca feita pela
 * recrutadora, abre os perfis mais promissores, avalia cada um frente à JD e
 * envia o convite com nota aos aderentes, até a quantidade pedida (máx. 5).
 *
 * Roda no painel lateral: fechar o painel interrompe a execução.
 */
import { FriendlyError } from "../errors.js";
import { NOTE_MAX, analyzeJob, buildNote, evaluateProfile, screenCards } from "./ai.js";

export const MAX_INVITES = 5;
// Perfis abertos por convite pedido: limita a execução mesmo se poucos forem
// aderentes (muitos ficam abaixo da aderência mínima).
const PROFILES_PER_INVITE = 4;
const MAX_PAGES = 5;
// Relevância mínima na triagem dos cartões para valer abrir o perfil.
const MIN_CARD_RELEVANCE = 40;
const CONTENT_SCRIPT = "dist/linkedin-content.js";

// Ritmo de uma pessoa: pausas entre abrir perfis e, mais longas, entre convites.
const PACE = {
  profile: [5_000, 10_000],
  invite: [25_000, 45_000],
  dryRun: [3_000, 6_000],
};

export const LINKEDIN_PEOPLE_SEARCH = "https://www.linkedin.com/search/results/people/";

function pause([min, max], signal) {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new FriendlyError("Shortlist interrompida."));
    });
  });
}

function checkAbort(signal) {
  if (signal?.aborted) throw new FriendlyError("Shortlist interrompida.");
}

async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
}

async function command(tabId, cmd, extra = {}) {
  let response;
  try {
    response = await chrome.tabs.sendMessage(tabId, { target: "linkedin", cmd, ...extra });
  } catch {
    // A página recarregou e perdeu o script: injeta de novo e repete.
    await inject(tabId);
    response = await chrome.tabs.sendMessage(tabId, { target: "linkedin", cmd, ...extra });
  }
  if (!response?.ok) throw new FriendlyError(`Falha ao ler o LinkedIn (${response?.error ?? "sem resposta"}).`);
  return response.result;
}

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
  return analyzeJob({ apiKey, jd, signal });
}

const STATUS_LABEL = {
  enviado: "Convite enviado",
  simulado: "Aderente (simulação: convite não enviado)",
  abaixo: "Abaixo da aderência mínima",
  ja_conectado: "Já é sua conexão",
  pendente: "Convite já pendente",
  sem_botao: "Sem opção de conectar no perfil",
  exige_email: "LinkedIn exige o e-mail da pessoa",
  sem_nota: "LinkedIn não permitiu nota (convite não enviado)",
  erro: "Não foi possível enviar",
};
export const statusLabel = (status) => STATUS_LABEL[status] ?? status;

/**
 * Executa a Shortlist. `onEvent` recebe { type: "status", text } e
 * { type: "candidate", candidate } para o painel acompanhar ao vivo.
 */
export async function runShortlist({ groqKey, tabId, jd, job, quantidade, aderenciaMinima, settings, dryRun, signal, onEvent }) {
  const limit = Math.min(Math.max(1, quantidade), MAX_INVITES);
  const maxProfiles = limit * PROFILES_PER_INVITE;
  const candidates = [];
  const seen = new Set();
  let invited = 0;
  let opened = 0;

  const emit = (candidate) => onEvent?.({ type: "candidate", candidate: { ...candidate } });
  const say = (text) => onEvent?.({ type: "status", text });

  say("Verificando a página do LinkedIn…");
  const status = await linkedInStatus(tabId);
  if (!status.loggedIn) throw new FriendlyError("Entre na sua conta do LinkedIn nesta aba e tente de novo.");
  if (status.page !== "search") {
    throw new FriendlyError("Deixe aberta, na aba do LinkedIn, a página de resultados da busca de pessoas e tente de novo.");
  }
  const searchUrl = status.url;

  if (!job) {
    say("Analisando a descrição da vaga…");
    job = await analyzeJob({ apiKey: groqKey, jd, signal });
  }

  for (let page = 1; page <= MAX_PAGES && invited < limit && opened < maxProfiles; page++) {
    checkAbort(signal);
    if (page > 1) {
      const url = new URL(searchUrl);
      url.searchParams.set("page", String(page));
      say(`Indo para a página ${page} da busca…`);
      await navigate(tabId, url.href);
      await pause(PACE.profile, signal);
    }

    say(`Lendo os resultados da página ${page}…`);
    const cards = (await command(tabId, "readSearch")).filter((c) => !seen.has(c.url) && !c.firstDegree);
    if (!cards.length) break;
    say("Selecionando os perfis mais promissores…");
    const ranked = (await screenCards({ apiKey: groqKey, job, cards, signal }))
      .filter((c) => c.relevancia >= MIN_CARD_RELEVANCE)
      .sort((a, b) => b.relevancia - a.relevancia);

    for (const card of ranked) {
      if (invited >= limit || opened >= maxProfiles) break;
      checkAbort(signal);
      seen.add(card.url);
      opened++;

      const candidate = { nome: card.name, url: card.url, status: "analisando", aderencia: null };
      candidates.push(candidate);
      emit(candidate);

      say(`Abrindo o perfil de ${card.name}…`);
      await navigate(tabId, card.url);
      let profile = await command(tabId, "readProfile");
      // Sem a seção de experiência a avaliação fica injusta (só o título):
      // recarrega o perfil uma vez antes de avaliar.
      if (!profile.hasExperience && !profile.firstDegree && !profile.pending) {
        say(`Carregando as experiências de ${card.name}…`);
        await navigate(tabId, card.url);
        profile = await command(tabId, "readProfile");
      }
      if (profile.firstDegree) {
        Object.assign(candidate, { status: "ja_conectado" });
        emit(candidate);
        continue;
      }
      if (profile.pending) {
        Object.assign(candidate, { status: "pendente" });
        emit(candidate);
        continue;
      }

      say(`Avaliando ${card.name} frente à vaga…`);
      const evaluation = await evaluateProfile({
        apiKey: groqKey,
        job,
        profile,
        signature: settings.assinatura,
        signal,
      });
      Object.assign(candidate, {
        nome: evaluation.nome || card.name,
        cargoAtual: evaluation.cargoAtual,
        empresaAtual: evaluation.empresaAtual,
        local: evaluation.local,
        aderencia: evaluation.aderencia,
        resumo: evaluation.resumo,
        avaliacoes: job.requisitos.map((r) => ({
          descricao: r.descricao,
          tipo: r.tipo,
          nivel: evaluation.avaliacoes.find((a) => a.requisitoId === r.id)?.nivel ?? "nao_evidenciado",
        })),
        semExperiencia: !profile.hasExperience,
      });

      if (evaluation.aderencia < aderenciaMinima) {
        candidate.status = "abaixo";
        emit(candidate);
        await pause(PACE.profile, signal);
        continue;
      }

      // Nota personalizada pela IA; se vier longa demais, usa o modelo.
      const templateNote = buildNote(settings.modeloNota, {
        primeiroNome: evaluation.primeiroNome,
        perfilBuscado: job.perfilBuscado,
        localidade: job.localidade,
        assinatura: settings.assinatura,
      });
      const personalized = evaluation.notaConvite?.trim();
      const note = !settings.incluirNota
        ? ""
        : settings.personalizarNota && personalized && personalized.length <= NOTE_MAX
          ? personalized
          : templateNote;
      say(dryRun ? `Simulando o convite para ${candidate.nome}…` : `Enviando convite para ${candidate.nome}…`);
      // Convite pela página de convite do LinkedIn, o mesmo destino do botão
      // "Conectar" do cartão da busca (/preload/search-custom-invite/…). É mais
      // confiável do que procurar o botão no perfil, que muda de lugar.
      const vanity = candidate.url.match(/\/in\/([^/]+)/)?.[1];
      const inviteUrl =
        card.inviteUrl ?? (vanity ? `https://www.linkedin.com/preload/custom-invite/?vanityName=${vanity}` : null);
      const connectOptions = { note, allowNoNote: settings.enviarSemNota, dryRun };
      let result = { status: "sem_botao" };
      if (inviteUrl) {
        say(dryRun ? `Abrindo o convite de ${candidate.nome} (simulação)…` : `Abrindo o convite de ${candidate.nome}…`);
        await navigate(tabId, inviteUrl);
        result = await command(tabId, "connect", { ...connectOptions, dialogOnly: true });
      }
      // Sem diálogo de convite: tenta pelo botão do perfil (ex.: dentro de "Mais").
      if (result.status === "sem_botao") {
        await navigate(tabId, candidate.url);
        result = await command(tabId, "connect", connectOptions);
      }
      Object.assign(candidate, { status: result.status, nota: result.withNote ? note : null, detalhe: result.detail ?? null });
      emit(candidate);

      if (result.status === "enviado" || result.status === "simulado") {
        invited++;
        if (invited < limit) {
          say(dryRun ? "Próximo perfil…" : "Pausa entre convites, no ritmo de uma pessoa…");
          await pause(dryRun ? PACE.dryRun : PACE.invite, signal);
        }
      } else {
        await pause(PACE.profile, signal);
      }
    }
  }

  // Termina na página de busca da recrutadora.
  say("Voltando para a sua busca…");
  await navigate(tabId, searchUrl).catch(() => {});
  return { job, candidates, invited, limit, dryRun };
}
