/**
 * Plano da conta no produto (Recruiter ou BP), compartilhado pelas extensões
 * Candydate: teste gratuito com medidor de consumo, bloqueio ao fim do teste
 * e o cartão "Plano e assinatura" das Configurações.
 *
 * A situação vem da Edge Function `plano` (o prazo e o saldo de tokens ficam
 * no servidor). O consumo de cada chamada de IA é somado lá (uso.js).
 */
import { FriendlyError } from "../errors.js";
import { definirMedidor } from "../uso.js";
import { supabase, SUPABASE_URL } from "./client.js";

const FUNCAO = `${SUPABASE_URL}/functions/v1/plano`;
export const CHECKOUT_PADRAO = "https://thicodacosta.github.io/candydate-acesso/assinar/";

let chave = "recruiter";
let nomeProduto = "Recruiter";
let situacao = null;
let consultadoEm = 0;
let pendente = 0;
let envio = null;
const ouvintes = new Set();

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Situação atual no servidor (`tokens` soma o consumo antes de responder). */
export async function consultarPlano(produto = chave, tokens = 0) {
  const t = await token();
  if (!t) return null;
  const r = await fetch(tokens ? FUNCAO : `${FUNCAO}?produto=${produto}`, {
    method: tokens ? "POST" : "GET",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: tokens ? JSON.stringify({ produto, tokens }) : undefined,
    signal: AbortSignal.timeout(8000), // servidor sem resposta não trava a extensão
  });
  const d = await r.json().catch(() => null);
  if (!d?.ok) return null;
  return d;
}

/** Link da página de compra, com o e-mail no #fragmento (não vai para servidores). */
export function linkAssinatura(email, produto = chave) {
  const base = situacao?.checkout?.split("?")[0] ?? CHECKOUT_PADRAO;
  return `${base}?plano=${produto}${email ? `#email=${encodeURIComponent(email)}` : ""}`;
}

const diasRestantes = (fim) => Math.max(0, Math.ceil((new Date(fim).getTime() - Date.now()) / 86_400_000));

function atualizar(nova) {
  if (!nova) return;
  situacao = nova;
  consultadoEm = Date.now();
  ouvintes.forEach((f) => f(situacao));
}

export const aoMudarPlano = (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn));

async function enviarConsumo() {
  if (!pendente) return;
  const tokens = pendente;
  pendente = 0;
  try {
    atualizar(await consultarPlano(chave, tokens));
  } catch {
    pendente += tokens; // tenta de novo no próximo envio
  }
}

const mensagemBloqueio = (s) =>
  s?.motivo === "teste_encerrado"
    ? s.teste?.motivoFim === "tokens"
      ? `Você usou os ${s.teste.limite.toLocaleString("pt-BR")} tokens do teste gratuito do ${nomeProduto}.`
      : `Os 3 dias do teste gratuito do ${nomeProduto} terminaram.`
    : s?.motivo === "assinatura_inativa"
      ? `A sua assinatura do ${nomeProduto} não está ativa.`
      : `A sua conta ainda não tem um plano do ${nomeProduto}.`;

// ─── Interface: barra do teste e tela de bloqueio ──────────────────────────

const CSS = `
.plano-barra{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--accent-soft);color:var(--ink);font:500 12.5px/18px var(--font-body,Inter,sans-serif)}
.plano-barra__texto{flex:1;min-width:0}
.plano-barra__trilho{height:6px;margin-top:4px;border-radius:999px;background:var(--border);overflow:hidden}
.plano-barra__fill{height:100%;border-radius:999px;background:var(--primary);transition:width .4s cubic-bezier(.16,1,.3,1)}
.plano-barra__fill.is-alto{background:#f59e0b}
.plano-barra a{flex-shrink:0;padding:5px 12px;border-radius:999px;background:var(--cta);color:var(--on-cta,#fff);font-weight:600;text-decoration:none}
.plano-bloqueio{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(4px)}
.plano-bloqueio__card{max-width:420px;padding:28px 24px;border:1px solid var(--border);border-radius:16px;background:var(--surface);box-shadow:var(--shadow-hover);text-align:center}
.plano-bloqueio__card h2{margin:0 0 8px;font:600 22px/28px var(--font-display,Geist,sans-serif)}
.plano-bloqueio__card p{margin:0 0 18px;color:var(--muted)}
.plano-bloqueio__card a{display:block;padding:12px;border-radius:999px;background:var(--cta);color:var(--on-cta,#fff);font-weight:600;text-decoration:none}
.plano-bloqueio__card button{margin-top:10px;border:0;background:none;color:var(--primary-ink);font:500 13px var(--font-body,Inter,sans-serif);cursor:pointer}
.plano-cartao__linha{display:flex;justify-content:space-between;gap:10px;margin:6px 0}
`;

function estilos() {
  if (document.getElementById("plano-css")) return;
  const s = document.createElement("style");
  s.id = "plano-css";
  s.textContent = CSS;
  document.head.append(s);
}

function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...filhos.filter((f) => f != null));
  return n;
}

function barra(email) {
  let no = document.getElementById("plano-barra");
  if (situacao?.plano !== "teste" || situacao.bloqueado) {
    no?.remove();
    return;
  }
  const t = situacao.teste;
  const pct = Math.min(100, Math.round(t.pct));
  const dias = diasRestantes(t.fim);
  const conteudo = [
    el(
      "div",
      { class: "plano-barra__texto" },
      `Teste gratuito · ${pct}% usado · ${dias === 0 ? "termina hoje" : `${dias} ${dias === 1 ? "dia restante" : "dias restantes"}`}`,
      el("div", { class: "plano-barra__trilho", role: "progressbar", "aria-label": "Uso do teste gratuito", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, el("div", { class: `plano-barra__fill${pct >= 80 ? " is-alto" : ""}`, style: `width:${pct}%` })),
    ),
    el("a", { href: linkAssinatura(email), target: "_blank", rel: "noopener" }, "Assinar"),
  ];
  if (!no) {
    no = el("div", { id: "plano-barra", class: "plano-barra", role: "status" });
    const topo = document.querySelector(".topbar");
    if (topo) topo.after(no);
    else document.body.prepend(no);
  }
  no.replaceChildren(...conteudo);
}

function bloqueio(email) {
  document.getElementById("plano-bloqueio")?.remove();
  if (!situacao?.bloqueado) return;
  const tela = el(
    "div",
    { id: "plano-bloqueio", class: "plano-bloqueio", role: "dialog", "aria-modal": "true", "aria-labelledby": "plano-bloqueio-titulo" },
    el(
      "div",
      { class: "plano-bloqueio__card" },
      el("h2", { id: "plano-bloqueio-titulo", text: situacao.motivo === "teste_encerrado" ? "Seu teste gratuito terminou" : "Assine para continuar" }),
      el("p", { text: `${mensagemBloqueio(situacao)} Assine para continuar usando: o seu histórico e os seus dados continuam guardados.` }),
      el("a", { href: linkAssinatura(email), target: "_blank", rel: "noopener" }, `Assinar o ${nomeProduto}`),
      el(
        "button",
        {
          type: "button",
          onclick: async () => {
            await supabase.auth.refreshSession().catch(() => {});
            atualizar(await consultarPlano());
            if (!situacao?.bloqueado) location.reload();
          },
        },
        "Já assinei · verificar de novo",
      ),
    ),
  );
  document.body.append(tela);
}

/**
 * Instala o medidor de consumo e a interface do plano na página. `ui: false`
 * só mede (ex.: documento offscreen da gravação).
 */
export async function iniciarPlano({ chave: c, nomeProduto: nome, ui = true } = {}) {
  if (c) chave = c;
  if (nome) nomeProduto = nome;
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email ?? "";

  definirMedidor({
    async antes() {
      if (Date.now() - consultadoEm > 60_000) atualizar(await consultarPlano().catch(() => null));
      if (situacao?.bloqueado) {
        if (ui) bloqueio(email);
        throw new FriendlyError(`${mensagemBloqueio(situacao)} Assine para continuar.`);
      }
    },
    depois(tokens) {
      pendente += tokens;
      clearTimeout(envio);
      envio = setTimeout(enviarConsumo, 600);
    },
  });

  if (ui) {
    estilos();
    aoMudarPlano(() => {
      barra(email);
      bloqueio(email);
    });
    barra(email);
    bloqueio(email);
    // O prazo corre mesmo sem uso: confere de tempos em tempos.
    setInterval(async () => atualizar(await consultarPlano().catch(() => null)), 5 * 60_000);
  }
  atualizar(await consultarPlano().catch(() => null));
  return situacao;
}

/** Cartão "Plano e assinatura" para a página de Configurações. */
export async function cartaoPlano(container, { chave: c = chave, nomeProduto: nome = nomeProduto } = {}) {
  chave = c;
  nomeProduto = nome;
  estilos();
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email ?? "";
  const s = await consultarPlano(c).catch(() => null);
  if (s) situacao = s;
  const linha = (rotulo, valor) => el("div", { class: "plano-cartao__linha" }, el("span", { class: "hint", text: rotulo }), el("strong", { text: valor }));
  const assinar = el("a", { class: "btn btn--primary btn--auto", href: linkAssinatura(email, c), target: "_blank", rel: "noopener" }, `Assinar o ${nome}`);
  let corpo;
  if (!s) corpo = [el("p", { class: "hint", text: "Não foi possível consultar o plano agora." })];
  else if (s.plano === "pago") corpo = [linha("Plano", `${nome} · assinatura mensal`), linha("Situação", s.status === "atrasada" ? "Pagamento em atraso" : "Ativa"), el("p", { class: "hint", text: "Para alterar o cartão ou cancelar, use o link da fatura enviado pelo Asaas no seu e-mail." })];
  else if (s.plano === "cupom" || s.plano === "liberado") corpo = [linha("Plano", `${nome} · acesso liberado`), linha("Situação", "Ativo, sem cobrança")];
  else if (s.plano === "teste") {
    const t = s.teste;
    const pct = Math.min(100, Math.round(t.pct));
    corpo = [
      linha("Plano", s.bloqueado ? "Teste gratuito encerrado" : "Teste gratuito"),
      linha("Consumo", `${pct}% (${t.tokens.toLocaleString("pt-BR")} de ${t.limite.toLocaleString("pt-BR")} tokens)`),
      linha("Prazo", s.bloqueado ? "Encerrado" : `até ${new Date(t.fim).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`),
      el("div", { class: "plano-barra__trilho", role: "progressbar", "aria-label": "Uso do teste gratuito", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, el("div", { class: `plano-barra__fill${pct >= 80 ? " is-alto" : ""}`, style: `width:${pct}%` })),
      el("p", { class: "hint", text: "O teste termina no que vier primeiro: 3 dias ou 100 mil tokens de IA. Assine a qualquer momento; o seu histórico continua." }),
      assinar,
    ];
  } else corpo = [linha("Plano", "Sem plano ativo"), el("p", { class: "hint", text: mensagemBloqueio(s) }), assinar];
  container.replaceChildren(...corpo);
}
