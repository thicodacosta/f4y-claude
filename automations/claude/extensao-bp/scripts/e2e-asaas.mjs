// Teste da liberação automática pelo Asaas, contra o Supabase local com a
// Edge Function asaas-webhook servida (`supabase functions serve`) e uma API
// do Asaas falsa nesta máquina.
// Uso: node scripts/e2e-asaas.mjs   (Supabase local com edge-runtime e mailpit)
import { execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const env = Object.fromEntries(
  execSync("supabase status -o env", { cwd: RAIZ, encoding: "utf8" })
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const { API_URL: API, SERVICE_ROLE_KEY: SERVICE } = env;
const MAILPIT = env.INBUCKET_URL ?? env.MAILPIT_URL ?? "http://127.0.0.1:54724";
const TOKEN = "token-de-teste-do-webhook";
const PORTA_ASAAS = 54798;

let falhas = 0;
const checar = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};
const sql = (q) => execSync(`docker exec supabase_db_journeylab_bp psql -U postgres -Atc ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();

// API falsa do Asaas: clientes e assinaturas.
const CLIENTES = { cus_1: { email: "Compradora.Nova@cliente.test", name: "Compradora Nova" }, cus_2: { email: "rh@bp.test", name: "Conta existente" }, cus_3: { email: "outro@cliente.test", name: "Outro produto" }, cus_4: { email: "recrutadora@cliente.test", name: "Recrutadora" } };
const ASSINATURAS = { sub_1: { id: "sub_1", customer: "cus_1", paymentLink: "bjiv8fc18w63r89y" }, sub_3: { id: "sub_3", customer: "cus_3", paymentLink: "link_de_outro_produto" }, sub_4: { id: "sub_4", customer: "cus_4", paymentLink: "5p8qk8zbmdkndtwy" } };
const asaas = createServer((req, res) => {
  if (req.headers.access_token !== "chave-asaas-teste") return res.writeHead(401).end();
  const [, , recurso, id] = req.url.split("/");
  const dados = recurso === "customers" ? CLIENTES[id] : recurso === "subscriptions" ? ASSINATURAS[id] : null;
  res.writeHead(dados ? 200 : 404, { "Content-Type": "application/json" }).end(JSON.stringify(dados ?? {}));
}).listen(PORTA_ASAAS);

// Função servida localmente.
const tmp = mkdtempSync(join(tmpdir(), "bp-asaas-"));
writeFileSync(join(tmp, "funcao.env"), `ASAAS_API_KEY=chave-asaas-teste\nASAAS_WEBHOOK_TOKEN=${TOKEN}\nASAAS_API_URL=http://host.docker.internal:${PORTA_ASAAS}/v3\n`);
const servir = spawn("supabase", ["functions", "serve", "asaas-webhook", "--env-file", join(tmp, "funcao.env"), "--no-verify-jwt"], { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] });
let logFuncao = "";
servir.stdout.on("data", (d) => (logFuncao += d));
servir.stderr.on("data", (d) => (logFuncao += d));

const enviar = (corpo, token = TOKEN) =>
  fetch(`${API}/functions/v1/asaas-webhook`, { method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": token }, body: JSON.stringify(corpo) }).then(async (r) => ({ status: r.status, corpo: await r.text() }));
const pagamento = (id, evento, extra = {}) => ({ id: `evt_${id}`, event: evento, payment: { id: `pay_${id}`, customer: "cus_1", subscription: "sub_1", dueDate: "2026-10-09", confirmedDate: "2026-10-09", ...extra } });
const produtosDe = (email) => sql(`select coalesce(raw_app_meta_data->>'produtos','') from auth.users where lower(email)=lower('${email}')`);
const situacao = (email) => sql(`select status from public.assinaturas where email=lower('${email}') and produto='bp'`);

try {
  // Conta existente (como se já usasse o Recruiter).
  sql(`delete from public.asaas_eventos; delete from public.assinaturas; delete from auth.users where email in ('compradora.nova@cliente.test','outro@cliente.test','recrutadora@cliente.test');`);
  await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: "rh@bp.test", password: "BpTeste2026", email_confirm: true }) });
  sql(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"produtos":["recruiter"]}' where email='rh@bp.test'`);
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(() => {});

  // Espera a função subir.
  let pronta = false;
  for (let i = 0; i < 60 && !pronta; i++) {
    await esperar(1000);
    pronta = (await enviar({}, "x").catch(() => ({ status: 0 }))).status === 401;
  }
  checar("Função no ar", pronta, pronta ? "" : logFuncao.slice(-400));

  checar("Token errado é recusado", (await enviar(pagamento("x", "PAYMENT_CONFIRMED"), "token-errado")).status === 401);

  // 1º pagamento: conta nova, BP liberado, e-mail de senha provisória.
  let r = await enviar(pagamento("1", "PAYMENT_CONFIRMED"));
  checar("Pagamento confirmado cria a conta e libera o BP", r.status === 200 && produtosDe("compradora.nova@cliente.test") === '["bp"]', `${r.status} ${r.corpo}`);
  checar("Conta nova sem senha própria (cria no 1º acesso)", sql(`select raw_user_meta_data->>'senhaPropria' from auth.users where email='compradora.nova@cliente.test'`) === "false");
  let email = null;
  for (let i = 0; i < 15 && !email; i++) {
    await esperar(700);
    const lista = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:compradora.nova@cliente.test")}`)).json().catch(() => null);
    email = lista?.messages?.[0] ?? null;
  }
  checar("E-mail de senha provisória enviado", Boolean(email), email?.Subject ?? "nenhum e-mail no Mailpit");
  checar("Assinatura registrada como ativa", situacao("compradora.nova@cliente.test") === "ativa");

  // Reenvio do mesmo aviso: processado uma vez só.
  r = await enviar(pagamento("1", "PAYMENT_CONFIRMED"));
  checar("Aviso repetido não é processado de novo", r.status === 200 && r.corpo.includes("já processado"), r.corpo);
  checar("Recebido (mesmo pagamento) não duplica nada", (await enviar(pagamento("1b", "PAYMENT_RECEIVED"))).status === 200 && sql(`select count(*) from auth.users where email='compradora.nova@cliente.test'`) === "1");

  // Atraso: mantém durante a tolerância; depois de 5 dias, suspende.
  r = await enviar(pagamento("2", "PAYMENT_OVERDUE", { dueDate: "2026-11-09", confirmedDate: null }));
  checar("Vencido: marca atraso e mantém o acesso", situacao("compradora.nova@cliente.test") === "atrasada" && produtosDe("compradora.nova@cliente.test") === '["bp"]', r.corpo);
  sql(`update public.assinaturas set atrasada_desde = current_date - 6 where email='compradora.nova@cliente.test'`);
  checar("Rotina diária suspende quem passou da tolerância", sql(`select public.expirar_assinaturas(5)`) === "1" && situacao("compradora.nova@cliente.test") === "suspensa" && produtosDe("compradora.nova@cliente.test") === "[]");
  checar("Rotina diária agendada no pg_cron", sql(`select count(*) from cron.job where jobname='candydate-expirar-assinaturas'`) === "1");

  // Pagou o atrasado: volta.
  r = await enviar(pagamento("3", "PAYMENT_RECEIVED"));
  checar("Pagamento do atrasado libera de novo", situacao("compradora.nova@cliente.test") === "ativa" && produtosDe("compradora.nova@cliente.test") === '["bp"]', r.corpo);

  // Cancelamento da assinatura: retira na hora.
  r = await enviar({ id: "evt_4", event: "SUBSCRIPTION_DELETED", subscription: ASSINATURAS.sub_1 });
  checar("Assinatura cancelada retira o acesso", situacao("compradora.nova@cliente.test") === "cancelada" && produtosDe("compradora.nova@cliente.test") === "[]", r.corpo);

  // Conta existente (Recruiter) que assina o BP: soma o produto, sem e-mail de senha.
  r = await enviar({ id: "evt_5", event: "PAYMENT_CONFIRMED", payment: { id: "pay_5", customer: "cus_2", paymentLink: "bjiv8fc18w63r89y", confirmedDate: "2026-10-09" } });
  checar("Conta existente ganha o BP sem perder o Recruiter", produtosDe("rh@bp.test") === '["bp", "recruiter"]', `${produtosDe("rh@bp.test")} · ${r.corpo}`);

  // Estorno: retira.
  r = await enviar({ id: "evt_6", event: "PAYMENT_REFUNDED", payment: { id: "pay_5", customer: "cus_2", paymentLink: "bjiv8fc18w63r89y" } });
  checar("Estorno retira só o BP", produtosDe("rh@bp.test") === '["recruiter"]' && situacao("rh@bp.test") === "estornada", r.corpo);

  // Pagamento de outro link (não é produto Candydate): ignorado, sem conta criada.
  r = await enviar({ id: "evt_7", event: "PAYMENT_CONFIRMED", payment: { id: "pay_7", customer: "cus_3", subscription: "sub_3" } });
  checar("Pagamento de outro link é ignorado", r.corpo.includes("ignorado") && sql(`select count(*) from auth.users where email='outro@cliente.test'`) === "0", r.corpo);

  // Plano Recruiter: assinatura mensal com renovações (pagamentos da assinatura, sem o link no pagamento).
  const pagRec = (id, evento, extra = {}) => ({ id: `evt_r${id}`, event: evento, payment: { id: `pay_r${id}`, customer: "cus_4", subscription: "sub_4", dueDate: "2026-10-09", confirmedDate: "2026-10-09", ...extra } });
  r = await enviar(pagRec("1", "PAYMENT_CONFIRMED"));
  checar("Plano Recruiter: 1º pagamento libera só o Recruiter", produtosDe("recrutadora@cliente.test") === '["recruiter"]', r.corpo);
  r = await enviar(pagRec("2", "PAYMENT_CONFIRMED", { dueDate: "2026-11-09", confirmedDate: "2026-11-09" }));
  checar("Plano Recruiter: renovação mensal mantém o acesso", produtosDe("recrutadora@cliente.test") === '["recruiter"]' && sql(`select status from public.assinaturas where email='recrutadora@cliente.test' and produto='recruiter'`) === "ativa", r.corpo);
  r = await enviar(pagRec("3", "PAYMENT_OVERDUE", { dueDate: "2026-12-09", confirmedDate: null }));
  sql(`update public.assinaturas set atrasada_desde = current_date - 6 where email='recrutadora@cliente.test'`);
  sql(`select public.expirar_assinaturas(5)`);
  checar("Plano Recruiter: atraso além da tolerância retira o acesso", produtosDe("recrutadora@cliente.test") === "[]");
  r = await enviar(pagRec("4", "PAYMENT_RECEIVED", { dueDate: "2026-12-09" }));
  r = await enviar({ id: "evt_r5", event: "SUBSCRIPTION_INACTIVATED", subscription: ASSINATURAS.sub_4 });
  checar("Plano Recruiter: assinatura inativada retira o acesso", produtosDe("recrutadora@cliente.test") === "[]" && sql(`select status from public.assinaturas where email='recrutadora@cliente.test'`) === "cancelada", r.corpo);

  checar("Todos os avisos ficam registrados", Number(sql(`select count(*) from public.asaas_eventos`)) >= 7);
} catch (e) {
  console.error(e);
  falhas++;
} finally {
  servir.kill();
  asaas.close();
  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}
