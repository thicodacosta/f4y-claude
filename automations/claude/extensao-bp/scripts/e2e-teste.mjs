// Teste do teste gratuito e do cadastro (criar conta na extensão, consumo em %,
// bloqueio, uma vez por e-mail/CPF, "esqueci o e-mail", assinatura pela API do
// Asaas), contra o Supabase local com as funções servidas e um Asaas falso.
// Uso: node scripts/e2e-teste.mjs [--fotos <pasta>]   (Supabase local com edge-runtime e mailpit)
import { execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirChrome, esperar } from "./chrome.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const fotosIdx = process.argv.indexOf("--fotos");
const FOTOS = fotosIdx > 0 ? process.argv[fotosIdx + 1] : null;
if (FOTOS) mkdirSync(FOTOS, { recursive: true });
const env = Object.fromEntries(
  execSync("supabase status -o env", { cwd: RAIZ, encoding: "utf8" })
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const { API_URL: API, PUBLISHABLE_KEY: PUB, SERVICE_ROLE_KEY: SERVICE } = env;
const MAILPIT = env.MAILPIT_URL ?? "http://127.0.0.1:54724";
const FN = `${API}/functions/v1`;
const PORTA = 54796;
const PORTA_ASAAS = 54799;

let falhas = 0;
const checar = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};
const sql = (q) => execSync(`docker exec supabase_db_journeylab_bp psql -U postgres -Atc ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();
const produtosDe = (email) => sql(`select coalesce(raw_app_meta_data->>'produtos','') from auth.users where lower(email)=lower('${email}')`);
const foto = async (p, nome, opcoes) => FOTOS && p.foto(join(FOTOS, `${nome}.png`), opcoes);

// CPF válido gerado a partir de 9 dígitos.
function cpf(base) {
  const d = String(base).padStart(9, "0").slice(0, 9).split("").map(Number);
  for (const n of [9, 10]) {
    const soma = d.slice(0, n).reduce((s, x, i) => s + x * (n + 1 - i), 0);
    d.push(((soma * 10) % 11) % 10);
  }
  return d.join("");
}

// Asaas falso: cliente, assinatura e a 1ª fatura.
const chamadasAsaas = [];
const asaas = createServer(async (req, res) => {
  let corpo = "";
  for await (const c of req) corpo += c;
  chamadasAsaas.push({ metodo: req.method, url: req.url, corpo: corpo ? JSON.parse(corpo) : null, chave: req.headers.access_token });
  const r = (d) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(d));
  if (req.method === "GET" && req.url.startsWith("/v3/customers?")) return r({ data: [] });
  if (req.method === "POST" && req.url === "/v3/customers") return r({ id: "cus_teste" });
  if (req.method === "POST" && req.url === "/v3/subscriptions") return r({ id: "sub_teste" });
  if (req.method === "GET" && req.url === "/v3/subscriptions/sub_teste/payments") return r({ data: [{ invoiceUrl: "https://www.asaas.com/i/fatura-teste" }] });
  res.writeHead(404).end("{}");
}).listen(PORTA_ASAAS);

// Pacote e páginas apontando para o Supabase local.
const tmp = mkdtempSync(join(tmpdir(), "bp-gratis-"));
writeFileSync(join(tmp, "teste.env"), `SUPABASE_URL=${API}\nSUPABASE_PUBLISHABLE_KEY=${PUB}\nBP_PUBLIC_URL=http://127.0.0.1:${PORTA}/\nANTHROPIC_API_KEY=sk-ant-invalida\nGROQ_API_KEY=gsk_invalida\n`);
writeFileSync(join(tmp, "funcao.env"), `ASAAS_API_KEY=chave-asaas-teste\nASAAS_API_URL=http://host.docker.internal:${PORTA_ASAAS}/v3\n`);
execSync(`node build.mjs --env ${join(tmp, "teste.env")}`, { cwd: RAIZ, stdio: "ignore" });
const site = createServer((req, res) => {
  const caminho = new URL(req.url, "http://x").pathname.slice(1) || "index.html";
  const arquivo = join(RAIZ, "public-dist", caminho);
  if (!existsSync(arquivo)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": arquivo.endsWith(".html") ? "text/html; charset=utf-8" : "image/png" }).end(readFileSync(arquivo));
}).listen(PORTA);

const servir = spawn("supabase", ["functions", "serve", "--no-verify-jwt", "--env-file", join(tmp, "funcao.env")], { cwd: RAIZ, stdio: "ignore" });
const chrome = await abrirChrome({ extensao: join(RAIZ, "extension") });

const post = (funcao, corpo, token) =>
  fetch(`${FN}/${funcao}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(corpo) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const plano = (token, produto = "bp") => fetch(`${FN}/plano?produto=${produto}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
// `definir`: cria a senha antes (contas criadas pela página, sem senha própria).
async function sessao(email, { definir = false, password = "Gratis2026x" } = {}) {
  const id = sql(`select id from auth.users where email='${email}'`);
  if (definir) await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "PUT", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ password, user_metadata: { senhaPropria: true } }) });
  const r = await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json();
  return r.access_token;
}
const valor = (seletor, v) => `{const e=document.querySelector(${JSON.stringify(seletor)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));}`;
const clicar = (p, texto) =>
  p.avaliar(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim().includes(${JSON.stringify(texto)})&&!x.disabled&&x.offsetParent!==null);if(!b)throw new Error('botão não encontrado: '+${JSON.stringify(texto)});b.click();return true})()`);

const NOVA = "nova.conta@gratis.test";
const PAGINA = "pagina.teste@gratis.test";

try {
  sql(`delete from public.testes; delete from public.clientes; delete from public.lembretes_email; delete from public.uso_ia; delete from public.assinaturas where email like '%@gratis.test'; delete from auth.users where email like '%@gratis.test';`);
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(() => {});
  let pronta = false;
  for (let i = 0; i < 60 && !pronta; i++) {
    await esperar(1000);
    pronta = (await fetch(`${FN}/checkout?plano=bp`).catch(() => null))?.status === 200;
  }
  checar("Funções no ar", pronta);

  // ── 1. Criar conta na extensão e começar o teste ──────────────────────────
  const opcoes = await chrome.aba(chrome.url("options.html"));
  await opcoes.esperarAte("document.querySelector('#auth-email')");
  checar("Login com Google e LinkedIn disponível", await opcoes.avaliar("[...document.querySelectorAll('.auth__social')].map(b=>b.textContent).join('|')==='Entrar com Google|Entrar com LinkedIn'"));
  checar("Opções \"Esqueci a senha\" e \"Esqueci o e-mail\"", await opcoes.avaliar("['Esqueci a senha','Esqueci o e-mail'].every(t=>[...document.querySelectorAll('.btn-link')].some(b=>b.textContent===t))"));
  await foto(opcoes, "1-login");
  await clicar(opcoes, "Criar conta");
  await opcoes.esperarAte("document.querySelector('#auth-confirm')");
  await opcoes.avaliar(`${valor("#auth-nome", "Nova Conta Teste")}${valor("#auth-email", NOVA)}${valor("#auth-new", "Gratis2026x")}${valor("#auth-confirm", "Gratis2026y")}document.querySelector('.auth form').requestSubmit()`);
  checar("Senhas diferentes são recusadas", await opcoes.esperarAte("document.querySelector('.auth__error:not([hidden])')?.textContent.includes('não conferem')"));
  await foto(opcoes, "2-criar-conta");
  await opcoes.avaliar(`${valor("#auth-confirm", "Gratis2026x")}document.querySelector('.auth form').requestSubmit()`);
  checar("Conta criada sem confirmação: vai para o cadastro", await opcoes.esperarAte("document.querySelector('.auth__title')?.textContent==='Complete o seu cadastro'", 20000), await opcoes.avaliar("document.querySelector('.auth__error')?.textContent"));
  checar("Nome já preenchido no cadastro", (await opcoes.avaliar("document.querySelector('#auth-nome').value")) === "Nova Conta Teste");
  await opcoes.avaliar(`${valor("#auth-cpf", cpf(111222333))}${valor("#auth-tel", "11987654321")}`);
  checar("CPF com máscara", (await opcoes.avaliar("document.querySelector('#auth-cpf').value")) === cpf(111222333).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
  await foto(opcoes, "3-cadastro");
  await opcoes.avaliar("document.querySelector('.auth form').requestSubmit()");
  checar("Teste começa e as Configurações abrem", await opcoes.esperarAte("!document.querySelector('.auth') && document.querySelector('#plano-area')?.textContent.includes('Teste gratuito')", 20000), await opcoes.avaliar("document.querySelector('.auth__error')?.textContent ?? document.querySelector('#plano-area')?.textContent"));
  checar("Cartão do plano com consumo em %", await opcoes.esperarAte("document.querySelector('#plano-area').textContent.includes('0% (0 de 100.000 tokens)')"), await opcoes.avaliar("document.querySelector('#plano-area').textContent"));
  checar("Cartão com o botão de assinar", await opcoes.avaliar("document.querySelector('#plano-area a').href.includes('?plano=bp#email=')"));
  await foto(opcoes, "4-configuracoes-plano", { inteira: true });
  checar("Conta com o BP liberado e teste registrado", produtosDe(NOVA) === '["bp"]' && sql(`select status||'/'||limite_tokens from public.testes where email='${NOVA}'`) === "ativo/100000", produtosDe(NOVA));
  checar("Cliente com nome, CPF e telefone", sql(`select nome||'/'||cpf||'/'||telefone from public.clientes where email='${NOVA}'`) === `Nova Conta Teste/${cpf(111222333)}/11987654321`);

  // ── 2. Barra de consumo no painel ─────────────────────────────────────────
  const painel = await chrome.aba(chrome.url("sidepanel.html"));
  checar("Painel mostra a barra do teste", await painel.esperarAte("document.querySelector('#plano-barra')?.textContent.includes('Teste gratuito · 0% usado')", 20000), await painel.avaliar("document.querySelector('#plano-barra')?.textContent"));
  const token = await sessao(NOVA);
  let r = await post("plano", { produto: "bp", tokens: 42_000 }, token);
  checar("Consumo somado no servidor", r.teste?.tokens === 42000 && r.teste.pctTokens === 42 && !r.bloqueado, JSON.stringify(r.teste));
  await painel.ir(chrome.url("sidepanel.html"));
  checar("Barra mostra 42% usado", await painel.esperarAte("document.querySelector('#plano-barra')?.textContent.includes('42% usado')", 20000), await painel.avaliar("document.querySelector('#plano-barra')?.textContent"));
  await foto(painel, "5-painel-barra");

  // ── 3. Fim do teste por tokens ────────────────────────────────────────────
  r = await post("plano", { produto: "bp", tokens: 60_000 }, token);
  checar("100 mil tokens encerram o teste", r.bloqueado && r.motivo === "teste_encerrado" && r.teste.motivoFim === "tokens", JSON.stringify(r).slice(0, 160));
  checar("Produto retirado ao encerrar", produtosDe(NOVA) === "[]", produtosDe(NOVA));
  await painel.ir(chrome.url("sidepanel.html"));
  checar("Painel mostra \"Seu teste gratuito terminou\"", await painel.esperarAte("document.querySelector('.auth__title')?.textContent==='Seu teste gratuito terminou'", 20000), await painel.avaliar("document.querySelector('.auth__title')?.textContent"));
  checar("Botão leva à página de compra com o e-mail", await painel.avaliar(`document.querySelector('.auth a.btn--primary').href.endsWith('assinar/?plano=bp#email=${encodeURIComponent(NOVA)}')`), await painel.avaliar("document.querySelector('.auth a.btn--primary').href"));
  await foto(painel, "6-teste-terminou");

  // ── 4. Uma vez por e-mail e por CPF ───────────────────────────────────────
  const dados = { acao: "teste", plano: "bp", nome: "Nova Conta Teste", telefone: "11987654321" };
  r = await post("checkout", { ...dados, email: NOVA, cpf: cpf(999888777) });
  checar("Mesmo e-mail não repete o teste", !r.ok && r.status === 409 && /já foi utilizado/.test(r.motivo), r.motivo);
  r = await post("checkout", { ...dados, email: "outro.email@gratis.test", cpf: cpf(111222333) });
  checar("Mesmo CPF com outro e-mail não repete o teste", !r.ok && /já foi utilizado/.test(r.motivo) && produtosDe("outro.email@gratis.test") === "", r.motivo);
  r = await post("checkout", { ...dados, email: NOVA, cpf: "12345678900" });
  checar("CPF inválido é recusado", !r.ok && /CPF/.test(r.motivo), r.motivo);
  r = await post("checkout", { ...dados, plano: "recruiter", email: NOVA, cpf: cpf(111222333) });
  checar("O teste do outro produto continua disponível", r.ok && produtosDe(NOVA) === '["recruiter"]', produtosDe(NOVA));

  // ── 5. Página de assinatura: teste grátis e assinatura pela API ──────────
  const pagina = await chrome.aba(`http://127.0.0.1:${PORTA}/assinar.html?plano=bp`);
  await pagina.tamanho(900, 1000, 1);
  await pagina.esperarAte("typeof cpfOk === 'function'", 30000); // script da página carregado
  await pagina.avaliar(`${valor("#nome", "Pessoa da Pagina")}${valor("#email", PAGINA)}${valor("#cpf", cpf(222333444))}${valor("#telefone", "21998765432")}document.querySelector('#form').requestSubmit(document.querySelector('#testar'))`);
  checar("Página libera o teste grátis", await pagina.esperarAte("document.querySelector('.sucesso h2')?.textContent.includes('Teste grátis do Business Partner')", 30000), await pagina.avaliar("(document.querySelector('.sucesso')?.textContent ?? 'erro: '+document.querySelector('#erro')?.textContent+' / botão: '+document.querySelector('#testar')?.textContent+' / nome: '+document.querySelector('#nome')?.value).slice(0,160)"));
  await foto(pagina, "7-pagina-teste");
  let mail = null;
  for (let i = 0; i < 15 && !mail; i++) {
    await esperar(700);
    mail = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${PAGINA}`)}`)).json().catch(() => null))?.messages?.[0];
  }
  checar("Conta nova recebe o código de acesso por e-mail", Boolean(mail));
  r = await post("checkout", { acao: "assinar", plano: "bp", nome: "Pessoa da Pagina", email: PAGINA, cpf: cpf(222333444), telefone: "21998765432" });
  const assinatura = chamadasAsaas.find((c) => c.url === "/v3/subscriptions")?.corpo;
  const cliente = chamadasAsaas.find((c) => c.url === "/v3/customers" && c.metodo === "POST")?.corpo;
  checar("Assinar durante o teste cria a assinatura no Asaas", r.ok && r.link === "https://www.asaas.com/i/fatura-teste", JSON.stringify(r));
  checar("Cliente do Asaas com nome, CPF, e-mail e telefone", cliente?.name === "Pessoa da Pagina" && cliente.cpfCnpj === cpf(222333444) && cliente.email === PAGINA && cliente.mobilePhone === "21998765432", JSON.stringify(cliente));
  checar("Assinatura mensal no cartão, valor e produto certos", assinatura?.cycle === "MONTHLY" && assinatura.billingType === "CREDIT_CARD" && assinatura.value === 129.9 && assinatura.externalReference === "bp" && assinatura.customer === "cus_teste", JSON.stringify(assinatura));
  checar("Código do cliente do Asaas guardado", sql(`select asaas_cliente from public.clientes where email='${PAGINA}'`) === "cus_teste");

  // ── 6. Fim do teste por prazo: bloqueio com o painel aberto ──────────────
  sql(`update public.testes set fim = now() - interval '1 minute' where email='${PAGINA}'`);
  await sessao(PAGINA, { definir: true });
  await clicar(painel, "Sair");
  await painel.esperarAte("document.querySelector('#auth-email')");
  await painel.avaliar(`${valor("#auth-email", PAGINA)}${valor("#auth-password", "Gratis2026x")}document.querySelector('.auth form').requestSubmit()`);
  checar("Prazo vencido: tela de bloqueio com link de compra", await painel.esperarAte("document.querySelector('#plano-bloqueio, .auth__title') && (document.querySelector('#plano-bloqueio')?.textContent.includes('3 dias') || document.querySelector('.auth__title')?.textContent.includes('terminou'))", 20000), await painel.avaliar("(document.querySelector('#plano-bloqueio')||document.querySelector('.auth'))?.textContent.slice(0,160)"));
  checar("Teste encerrado por prazo", sql(`select status||'/'||motivo_fim from public.testes where email='${PAGINA}'`) === "encerrado/prazo");
  await foto(painel, "8-bloqueio-prazo");

  // ── 7. Esqueci o e-mail ───────────────────────────────────────────────────
  await painel.avaliar("chrome.storage.local.clear()");
  await painel.ir(chrome.url("sidepanel.html"));
  await painel.esperarAte("document.querySelector('#auth-email')");
  await clicar(painel, "Esqueci o e-mail");
  await painel.esperarAte("document.querySelector('#auth-cpf')");
  await painel.avaliar(`${valor("#auth-cpf", cpf(111222333))}document.querySelector('.auth form').requestSubmit()`);
  checar("CPF mostra o e-mail parcialmente oculto", await painel.esperarAte("document.querySelector('.auth [role=status]')?.textContent.includes('Conta encontrada: n••••••@gratis.test.')"), await painel.avaliar("document.querySelector('.auth [role=status]')?.textContent"));
  await foto(painel, "9-esqueci-email");
  for (let i = 0; i < 5; i++) r = await post("lembrar-email", { cpf: cpf(333444555) });
  checar("Limite de consultas por conexão", r.status === 429, r.motivo);

  // ── 8. E-mail já cadastrado ───────────────────────────────────────────────
  await clicar(painel, "Voltar para o login");
  await clicar(painel, "Criar conta");
  await painel.esperarAte("document.querySelector('#auth-confirm')");
  await painel.avaliar(`${valor("#auth-nome", "Outra Pessoa")}${valor("#auth-email", NOVA)}${valor("#auth-new", "Outra2026x")}${valor("#auth-confirm", "Outra2026x")}document.querySelector('.auth form').requestSubmit()`);
  checar("E-mail já cadastrado é avisado", await painel.esperarAte("document.querySelector('.auth__error:not([hidden])')?.textContent.includes('já tem conta')"), await painel.avaliar("document.querySelector('.auth__error')?.textContent"));
} catch (e) {
  console.error(e);
  falhas++;
} finally {
  const erros = chrome.logs.filter((l) => !/40[0-9]|42[29]|Failed to load resource|sk-ant-invalida|gsk_invalida|User already registered/i.test(l));
  checar("Sem erros de JavaScript", erros.length === 0, erros.slice(0, 3).join(" | "));
  await chrome.fechar();
  servir.kill();
  site.close();
  asaas.close();
  execSync("node build.mjs", { cwd: RAIZ, stdio: "ignore" });
  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}
