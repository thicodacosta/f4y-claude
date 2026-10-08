/**
 * Painel do Candydate · BP. Nada abre sem login (mesmas contas da
 * ToolsKit). Depois do login: garante a empresa da conta, carrega a base e
 * mostra a funcionalidade escolhida. Cada funcionalidade se redesenha quando
 * a base muda (aoMudar) e ao ser aberta.
 */
import { aoMudar, carregar, iniciarEmpresa } from "./core/db.js";
import { initHeader, initTheme, logout, requireAuth, FriendlyError, authConfigured } from "./core/toolskit.js";
import { $, h } from "./core/ui.js";
import { criarAvaliacao } from "./modulos/avaliacao.js";
import { criarChat } from "./modulos/chat.js";
import { criarGestao } from "./modulos/gestao.js";
import { criarOffboarding } from "./modulos/offboarding.js";
import { criarOnboarding } from "./modulos/onboarding.js";
import { criarPessoas } from "./modulos/pessoas.js";
import { criarPulso } from "./modulos/pulso.js";
import { criarTurnover } from "./modulos/turnover.js";

const ABAS = [
  ["onboarding", "Onboarding"],
  ["produtividade", "Produtividade"],
  ["cultura", "Cultura"],
  ["turnover", "Turnover"],
  ["pulso", "Pulso"],
  ["offboarding", "Offboarding"],
  ["gestao", "Gestão"],
  ["chat", "Chat"],
  ["pessoas", "Pessoas"],
];

let atual = null;
const modulos = {};

const app = {
  async ir(nome, { colaboradorId } = {}) {
    await selecionar(nome);
    if (!colaboradorId) return;
    if (nome === "produtividade" || nome === "cultura") modulos[nome].avaliar(colaboradorId);
    if (nome === "onboarding") modulos.onboarding.abrirPara(colaboradorId);
    if (nome === "offboarding") modulos.offboarding.registrarPara(colaboradorId);
  },
  async abrirPessoa(id) {
    await selecionar("pessoas", { semRender: true });
    modulos.pessoas.abrir(id);
  },
};

async function desenhar(nome) {
  try {
    await modulos[nome].render();
  } catch (e) {
    console.error(e);
    modulos[nome].raiz.replaceChildren(h("p", { class: "error", text: e instanceof FriendlyError ? e.message : "Não foi possível montar esta tela. Recarregue o painel." }));
  }
}

async function selecionar(nome, { semRender = false } = {}) {
  atual = nome;
  for (const [id] of ABAS) {
    const ativo = id === nome;
    $(`aba-${id}`).setAttribute("aria-selected", String(ativo));
    modulos[id].raiz.hidden = !ativo;
  }
  chrome.storage.session.set({ bpAba: nome });
  window.scrollTo(0, 0);
  if (!semRender) await desenhar(nome);
}

function montarAbas() {
  const nav = $("abas");
  const area = $("area");
  modulos.onboarding = criarOnboarding(app);
  modulos.produtividade = criarAvaliacao("produtividade", app);
  modulos.cultura = criarAvaliacao("cultura", app);
  modulos.turnover = criarTurnover(app);
  modulos.pulso = criarPulso(app);
  modulos.offboarding = criarOffboarding(app);
  modulos.gestao = criarGestao(app);
  modulos.chat = criarChat(app);
  modulos.pessoas = criarPessoas(app);
  for (const [id, rotulo] of ABAS) {
    nav.append(h("button", { type: "button", class: "tabs__tab", id: `aba-${id}`, "aria-selected": "false", onclick: () => { modulos[id].voltar?.(); selecionar(id); } }, rotulo));
    modulos[id].raiz.hidden = true;
    modulos[id].raiz.id = `area-${id}`;
    area.append(modulos[id].raiz);
  }
}

async function init() {
  await initTheme();
  const user = await requireAuth({ nomeProduto: "BP" });
  $("sair").hidden = !user;
  $("sair").addEventListener("click", logout);
  initHeader();
  if (!authConfigured) {
    $("estado").textContent = "Este pacote foi gerado sem o Supabase configurado (SUPABASE_URL). Veja o README.";
    return;
  }
  try {
    const { branding } = await chrome.storage.local.get("branding");
    await iniciarEmpresa(branding?.empresa);
    await carregar();
  } catch (e) {
    console.error(e);
    $("estado").textContent = e instanceof FriendlyError ? e.message : "Não foi possível carregar os dados.";
    return;
  }
  $("estado").hidden = true;
  montarAbas();
  aoMudar(() => {
    // Chat mantém a conversa; as demais telas refletem a base nova.
    if (atual && atual !== "chat") desenhar(atual);
  });
  const { bpAba } = await chrome.storage.session.get("bpAba");
  await selecionar(ABAS.some(([id]) => id === bpAba) ? bpAba : "gestao");
}

await init();
