// Teste do checkout com cupom (Edge Function checkout + página assinar.html),
// contra o Supabase local com as funções servidas.
// Uso: node scripts/e2e-checkout.mjs [--fotos <pasta>]   (Supabase local com edge-runtime e mailpit)
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
const API = env.API_URL;
const MAILPIT = env.MAILPIT_URL ?? "http://127.0.0.1:54724";
const CHECKOUT = `${API}/functions/v1/checkout`;
const PORTA = 54797;

let falhas = 0;
const checar = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};
const sql = (q) => execSync(`docker exec supabase_db_journeylab_bp psql -U postgres -Atc ${JSON.stringify(q)}`, { encoding: "utf8" }).trim();
const produtosDe = (email) => sql(`select coalesce(raw_app_meta_data->>'produtos','') from auth.users where lower(email)=lower('${email}')`);

// Página de assinatura apontando para o Supabase local.
const tmp = mkdtempSync(join(tmpdir(), "bp-checkout-"));
writeFileSync(join(tmp, "teste.env"), `SUPABASE_URL=${API}\nSUPABASE_PUBLISHABLE_KEY=${env.PUBLISHABLE_KEY}\nBP_PUBLIC_URL=http://127.0.0.1:${PORTA}/\nANTHROPIC_API_KEY=sk-ant-invalida\nGROQ_API_KEY=gsk_invalida\n`);
execSync(`node build.mjs --env ${join(tmp, "teste.env")}`, { cwd: RAIZ, stdio: "ignore" });
const site = createServer((req, res) => {
  const caminho = new URL(req.url, "http://x").pathname.slice(1) || "index.html";
  const arquivo = join(RAIZ, "public-dist", caminho);
  if (!existsSync(arquivo)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": arquivo.endsWith(".html") ? "text/html; charset=utf-8" : "image/png" }).end(readFileSync(arquivo));
}).listen(PORTA);

const servir = spawn("supabase", ["functions", "serve", "--no-verify-jwt"], { cwd: RAIZ, stdio: "ignore" });
const chrome = await abrirChrome({ extensao: join(RAIZ, "extension") });
const NOVO = "cupom.novo@cliente.test";

try {
  sql(`delete from public.cupom_usos; delete from public.assinaturas; delete from auth.users where email like '%@cliente.test'; update public.cupons set ativo = true, limite_total = 100, valido_ate = '2026-12-31' where codigo = 'CANDYFREE';`);
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(() => {});
  let pronta = false;
  for (let i = 0; i < 60 && !pronta; i++) {
    await esperar(1000);
    pronta = (await fetch(`${CHECKOUT}?plano=bp`).catch(() => null))?.status === 200;
  }
  checar("Checkout no ar", pronta);

  // API: validação.
  let r = await (await fetch(`${CHECKOUT}?plano=bp&cupom=candyfree`)).json();
  checar("CANDYFREE é válido (maiúsculas ou minúsculas)", r.ok && r.cupom === "CANDYFREE", JSON.stringify(r));
  r = await (await fetch(`${CHECKOUT}?plano=recruiter&cupom=NAOEXISTE`)).json();
  checar("Cupom inexistente é recusado", !r.ok && /inválido/.test(r.motivo), r.motivo);
  r = await (await fetch(CHECKOUT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plano: "recruiter", nome: "Sem cupom", email: "sem.cupom@cliente.test" }) })).json();
  checar("Sem cupom: manda para o link de pagamento do Asaas", r.acao === "pagar" && r.link.endsWith("5p8qk8zbmdkndtwy"), r.link);
  checar("Sem cupom: nada é liberado antes do pagamento", produtosDe("sem.cupom@cliente.test") === "");

  // Página: cupom pela URL, liberação na hora.
  const p = await chrome.aba(`http://127.0.0.1:${PORTA}/assinar.html?plano=bp&cupom=CANDYFREE`);
  await p.tamanho(900, 1000, 1);
  checar("Página aplica o cupom da URL", await p.esperarAte("document.querySelector('#cupom-msg').textContent.includes('aplicado')"), await p.avaliar("document.querySelector('#cupom-msg').textContent"));
  checar("Preço riscado e botão de liberar", await p.avaliar("document.querySelector('[data-preco]').classList.contains('riscado') && document.querySelector('#enviar').textContent==='Liberar meu acesso'"));
  if (FOTOS) await p.foto(join(FOTOS, "assinar-cupom.png"), { inteira: true });
  await p.avaliar(`document.querySelector('#nome').value='Cliente Cupom';document.querySelector('#email').value='${NOVO}';document.querySelector('#form').requestSubmit()`);
  checar("Página mostra o acesso liberado", await p.esperarAte("document.querySelector('.sucesso h2')?.textContent.includes('Business Partner')", 30000), await p.avaliar("document.querySelector('.sucesso, #erro')?.textContent.slice(0,120)"));
  if (FOTOS) await p.foto(join(FOTOS, "assinar-liberado.png"));
  checar("Conta criada com o BP", produtosDe(NOVO) === '["bp"]', produtosDe(NOVO));
  checar("Assinatura registrada como cupom", sql(`select origem||'/'||cupom||'/'||status from public.assinaturas where email='${NOVO}'`) === "cupom/CANDYFREE/ativa");
  checar("Uso do cupom registrado", sql(`select count(*) from public.cupom_usos where email='${NOVO}' and produto='bp'`) === "1");
  let email = null;
  for (let i = 0; i < 15 && !email; i++) {
    await esperar(700);
    email = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${NOVO}`)}`)).json().catch(() => null))?.messages?.[0];
  }
  checar("E-mail de senha provisória enviado", Boolean(email));

  // Regras de uso.
  const post = (corpo) => fetch(CHECKOUT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).then((x) => x.json());
  r = await post({ plano: "bp", nome: "Cliente Cupom", email: NOVO, cupom: "CANDYFREE" });
  checar("Quem já tem o produto é avisado", !r.ok && /já tem acesso/.test(r.motivo), r.motivo);
  r = await post({ plano: "recruiter", nome: "Cliente Cupom", email: NOVO, cupom: "CANDYFREE" });
  checar("O mesmo e-mail pode usar no outro plano", r.ok && produtosDe(NOVO) === '["bp", "recruiter"]', produtosDe(NOVO));
  sql(`select public.revogar_produto('${NOVO}', 'bp')`);
  r = await post({ plano: "bp", nome: "Cliente Cupom", email: NOVO.toUpperCase(), cupom: "candyfree" });
  checar("Uma vez por pessoa em cada plano (mesmo com o acesso retirado)", !r.ok && /já usou/.test(r.motivo), r.motivo);
  sql(`update public.cupons set ativo = false where codigo = 'CANDYFREE'`);
  r = await post({ plano: "bp", nome: "Outra", email: "outra.pessoa@cliente.test", cupom: "CANDYFREE" });
  checar("Cupom desativado deixa de valer", !r.ok && produtosDe("outra.pessoa@cliente.test") === "", r.motivo);
  sql(`update public.cupons set ativo = true where codigo = 'CANDYFREE'`);

  // Limite por conexão: 3 usos do mesmo cupom pelo mesmo IP em 24 h (os testes já usaram 2).
  r = await post({ plano: "bp", nome: "Terceira", email: "terceira@cliente.test", cupom: "CANDYFREE" });
  checar("3º uso pela mesma conexão é aceito", r.ok, r.motivo ?? "");
  r = await post({ plano: "bp", nome: "Quarta", email: "quarta@cliente.test", cupom: "CANDYFREE" });
  checar("4º uso pela mesma conexão em 24 h é recusado", !r.ok && /Limite de usos/.test(r.motivo) && produtosDe("quarta@cliente.test") === "", r.motivo);
  // Limite total e validade do cupom.
  sql(`update public.cupons set limite_total = 3 where codigo = 'CANDYFREE'`);
  r = await (await fetch(`${CHECKOUT}?plano=recruiter&cupom=CANDYFREE`)).json();
  checar("Cupom com o limite total atingido deixa de valer", !r.ok && /limite/.test(r.motivo), r.motivo);
  sql(`update public.cupons set limite_total = 100, valido_ate = current_date - 1 where codigo = 'CANDYFREE'`);
  r = await (await fetch(`${CHECKOUT}?plano=recruiter&cupom=CANDYFREE`)).json();
  checar("Cupom vencido deixa de valer", !r.ok && /expirou/.test(r.motivo), r.motivo);
  sql(`update public.cupons set valido_ate = '2026-12-31' where codigo = 'CANDYFREE'`);

  // Página: cupom inválido.
  await p.ir(`http://127.0.0.1:${PORTA}/assinar.html?plano=recruiter`);
  await p.avaliar("document.querySelector('#cupom').value='ERRADO';document.querySelector('#aplicar').click()");
  checar("Página avisa cupom inválido", await p.esperarAte("document.querySelector('#cupom-msg.erro')?.textContent.includes('inválido')"));
} catch (e) {
  console.error(e);
  falhas++;
} finally {
  const erros = chrome.logs.filter((l) => !/404|409|422|Failed to load resource/i.test(l));
  checar("Sem erros de JavaScript na página", erros.length === 0, erros.slice(0, 3).join(" | "));
  await chrome.fechar();
  servir.kill();
  site.close();
  execSync("node build.mjs", { cwd: RAIZ, stdio: "ignore" });
  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}
