// Logo Candydate em todas as telas das duas extensões (BP e Recruiter), em
// tema claro e escuro: login, painel (com e sem empresa configurada),
// Configurações, Motion, permissão do microfone e PDF.
// Uso: node scripts/e2e-logo.mjs [--fotos <pasta>]   (Supabase local)
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirChrome, esperar } from "./chrome.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const RECRUITER = join(RAIZ, "..", "extensao-entrevistas");
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

let falhas = 0;
const checar = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};
const foto = async (p, nome) => FOTOS && p.foto(join(FOTOS, `${nome}.png`));

// Pacotes apontando para o Supabase local.
const tmp = mkdtempSync(join(tmpdir(), "logo-"));
writeFileSync(join(tmp, "teste.env"), `SUPABASE_URL=${API}\nSUPABASE_PUBLISHABLE_KEY=${PUB}\nANTHROPIC_API_KEY=sk-ant-invalida\nGROQ_API_KEY=gsk_invalida\n`);
execSync(`node build.mjs --env ${join(tmp, "teste.env")}`, { cwd: RAIZ, stdio: "ignore" });
execSync(`node build.mjs --env ${join(tmp, "teste.env")}`, { cwd: RECRUITER, stdio: "ignore" });

// Conta com os dois produtos.
const EMAIL = "logo@candydate.test";
const admin = (caminho, opcoes = {}) => fetch(`${API}${caminho}`, { ...opcoes, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" } });
const lista = await (await admin("/auth/v1/admin/users?per_page=500")).json();
const antiga = lista.users?.find((u) => u.email === EMAIL);
if (antiga) await admin(`/auth/v1/admin/users/${antiga.id}`, { method: "DELETE" });
await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: EMAIL, password: "Logo2026x", email_confirm: true, user_metadata: { senhaPropria: true, nome: "Logo Teste" }, app_metadata: { produtos: ["bp", "recruiter"] } }) });

// Situação do logo Candydate na página: carregado, visível e inteiro.
const ESTADO = (seletor) => `(()=>{const i=document.querySelector(${JSON.stringify(seletor)});if(!i)return {existe:false};const r=i.getBoundingClientRect();const c=getComputedStyle(i);return {existe:true,src:i.getAttribute('src'),carregado:i.complete&&i.naturalWidth>0,visivel:!i.hidden&&r.width>0&&r.height>0&&c.visibility!=='hidden'&&c.display!=='none',proporcao:+(r.width/r.height).toFixed(2),natural:+(i.naturalWidth/i.naturalHeight).toFixed(2),raio:c.borderRadius,fundo:c.backgroundColor,alt:i.alt}})()`;
async function conferir(p, seletor, nome) {
  const e = await p.avaliar(ESTADO(seletor));
  const ok = e.existe && e.carregado && e.visivel && /candydate-logo\.png$/.test(e.src) && Math.abs(e.proporcao - e.natural) < 0.05 && e.alt === "Candydate" && (e.raio === "0px" || e.raio === "") && /rgba\(0, 0, 0, 0\)|transparent/.test(e.fundo);
  checar(nome, ok, ok ? `${e.proporcao}:1` : JSON.stringify(e));
}
async function nosDoisTemas(p, seletor, nome) {
  for (const tema of ["light", "dark"]) {
    await p.tema(tema);
    await esperar(150);
    await conferir(p, seletor, `${nome} (${tema === "light" ? "claro" : "escuro"})`);
    await foto(p, `${nome.replace(/[^\w]+/g, "-")}-${tema}`);
  }
  await p.tema("light");
}
async function entrar(p) {
  await p.esperarAte("document.querySelector('#auth-email')");
  await p.avaliar(`document.querySelector('#auth-email').value='${EMAIL}';document.querySelector('#auth-password').value='Logo2026x';document.querySelector('.auth form').requestSubmit()`);
  return p.esperarAte("!document.querySelector('.auth') && !document.querySelector('#header-logo')?.hidden", 30000);
}

async function pdfDe(chrome, p, downloads, nome, clicarPdf) {
  const antes = new Set(readdirSync(downloads));
  await p.avaliar(clicarPdf);
  let pdf = null;
  for (let i = 0; i < 60 && !pdf; i++) {
    await esperar(500);
    pdf = readdirSync(downloads).find((f) => f.endsWith(".pdf") && !antes.has(f));
  }
  if (!pdf) return checar(`${nome}: PDF gerado`, false, chrome.logs.slice(-2).join(" | "));
  const png = join(tmp, `${nome}.png`);
  execSync(`sips -s format png "${join(downloads, pdf)}" --out "${png}"`, { stdio: "ignore" });
  if (FOTOS) execSync(`cp "${png}" "${join(FOTOS, `${nome}-pdf.png`)}"`);
  // Cabeçalho do PDF: pixels no azul do logo Candydate (#08A2FD aprox.) no topo da página.
  const azul = execSync(
    `python3 -c "
from PIL import Image
im=Image.open('${png}').convert('RGB');w,h=im.size
topo=im.crop((0,0,w,int(h*0.12)))
print(sum(1 for r,g,b in topo.getdata() if b>200 and 120<g<200 and r<80))"`,
    { encoding: "utf8" },
  ).trim();
  checar(`${nome}: PDF com o logo Candydate no cabeçalho`, Number(azul) > 300, `${azul} pixels do logo`);
}

// ─── BP ──────────────────────────────────────────────────────────────────────
{
  const downloads = mkdtempSync(join(tmpdir(), "logo-bp-dl-"));
  const chrome = await abrirChrome({ extensao: join(RAIZ, "extension"), downloads });
  try {
    const painel = await chrome.aba(chrome.url("sidepanel.html"));
    await painel.esperarAte("document.querySelector('.auth__logo')?.complete");
    await nosDoisTemas(painel, ".auth__logo", "BP login");
    checar("BP: login entra", await entrar(painel));
    await nosDoisTemas(painel, "#header-logo", "BP painel");
    await painel.avaliar("chrome.storage.local.set({branding:{empresa:'Aurora Teste',cor:'#0E7AB8'}})");
    await painel.ir(chrome.url("sidepanel.html"));
    await painel.esperarAte("document.querySelector('#aba-gestao')", 30000);
    await conferir(painel, "#header-logo", "BP painel com a empresa configurada continua com o Candydate");
    await painel.esperarAte("[...document.querySelectorAll('#area-gestao button')].some(b=>b.textContent.includes('Baixar PDF'))", 30000);
    await pdfDe(chrome, painel, downloads, "BP Gestão", "[...document.querySelectorAll('#area-gestao button')].find(b=>b.textContent.includes('Baixar PDF')).click()");
    const opcoes = await chrome.aba(chrome.url("options.html"));
    await opcoes.esperarAte("document.querySelector('.topbar__logo')?.complete");
    await nosDoisTemas(opcoes, ".topbar__logo", "BP Configurações");
    const motion = await chrome.aba(chrome.url("motion.html"));
    await motion.esperarAte("document.querySelector('.topbar__logo')?.complete");
    await nosDoisTemas(motion, ".topbar__logo", "BP Motion");
    const erros = chrome.logs.filter((l) => /candydate-logo|ERR_FILE_NOT_FOUND/i.test(l));
    checar("BP: nenhum erro ao carregar o logo", erros.length === 0, erros.join(" | "));
  } catch (e) {
    console.error(e);
    falhas++;
  } finally {
    await chrome.fechar();
  }
}

// ─── Recruiter ───────────────────────────────────────────────────────────────
{
  const downloads = mkdtempSync(join(tmpdir(), "logo-rec-dl-"));
  const chrome = await abrirChrome({ extensao: join(RECRUITER, "extension"), downloads });
  try {
    const painel = await chrome.aba(chrome.url("sidepanel.html"));
    await painel.esperarAte("document.querySelector('.auth__logo')?.complete");
    await nosDoisTemas(painel, ".auth__logo", "Recruiter login");
    checar("Recruiter: login entra", await entrar(painel));
    await nosDoisTemas(painel, "#header-logo", "Recruiter painel");
    // Empresa com nome e logo próprio: o topo continua Candydate.
    await painel.avaliar("chrome.storage.local.set({branding:{empresa:'Aurora Teste',cor:'#0E7AB8'}})");
    await esperar(400);
    await conferir(painel, "#header-logo", "Recruiter painel com a empresa configurada continua com o Candydate");
    const opcoes = await chrome.aba(chrome.url("options.html"));
    await opcoes.esperarAte("document.querySelector('#header-logo')?.complete && !document.querySelector('.auth')", 30000);
    await nosDoisTemas(opcoes, "#header-logo", "Recruiter Configurações");
    const permissao = await chrome.aba(chrome.url("permission.html"));
    await permissao.esperarAte("document.querySelector('#header-logo')?.complete && !document.querySelector('.auth')", 30000);
    await nosDoisTemas(permissao, "#header-logo", "Recruiter permissão do microfone");
    const motion = await chrome.aba(chrome.url("motion.html"));
    await esperar(1500);
    checar("Recruiter Motion: logo Candydate disponível para a apresentação", await motion.avaliar("new Promise(r=>{const i=new Image();i.onload=()=>r(i.naturalWidth>0);i.onerror=()=>r(false);i.src='icons/candydate-logo.png'})"));
    const erros = chrome.logs.filter((l) => /candydate-logo|ERR_FILE_NOT_FOUND/i.test(l));
    checar("Recruiter: nenhum erro ao carregar o logo", erros.length === 0, erros.join(" | "));
  } catch (e) {
    console.error(e);
    falhas++;
  } finally {
    await chrome.fechar();
  }
}

execSync("node build.mjs", { cwd: RAIZ, stdio: "ignore" });
execSync("node build.mjs", { cwd: RECRUITER, stdio: "ignore" });
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
