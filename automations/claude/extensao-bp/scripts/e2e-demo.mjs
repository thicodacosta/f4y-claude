// Teste do cenário de demonstração (Configurações): 50 colaboradores como os
// de uma planilha importada (sem área e sem admissão) → gerar → conferir as
// funcionalidades → remover → cadastros iguais aos de antes.
// Uso: node scripts/e2e-demo.mjs [--fotos <pasta>]   (Supabase local ativo)
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
const { API_URL: API, SERVICE_ROLE_KEY: SERVICE, PUBLISHABLE_KEY: PUB } = env;

let falhas = 0;
const checar = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const tmp = mkdtempSync(join(tmpdir(), "bp-demo-"));
writeFileSync(join(tmp, "teste.env"), `SUPABASE_URL=${API}\nSUPABASE_PUBLISHABLE_KEY=${PUB}\nBP_PUBLIC_URL=http://127.0.0.1:54799/\nANTHROPIC_API_KEY=sk-ant-invalida\nGROQ_API_KEY=gsk_invalida\n`);
execSync(`node build.mjs --env ${join(tmp, "teste.env")}`, { cwd: RAIZ, stdio: "ignore" });

const admin = (c, o = {}) => fetch(`${API}${c}`, { ...o, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(o.headers ?? {}) } });
const lista = await (await admin("/auth/v1/admin/users?per_page=200")).json();
let u = lista.users?.find((x) => x.email === "demo@bp.test");
if (u) await admin(`/rest/v1/bp_empresas?criado_por=eq.${u.id}`, { method: "DELETE" });
else u = await (await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: "demo@bp.test", password: "BpTeste2026", email_confirm: true, user_metadata: { senhaPropria: true } }) })).json();
const tok = (await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ email: "demo@bp.test", password: "BpTeste2026" }) })).json()).access_token;
const rest = (c, o = {}) => fetch(`${API}/rest/v1/${c}`, { ...o, headers: { apikey: PUB, Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Prefer: "return=representation,count=exact", ...(o.headers ?? {}) } }).then(async (x) => ({ status: x.status, dados: await x.json().catch(() => null), total: Number(x.headers.get("content-range")?.split("/")[1] ?? NaN) }));
const contar = async (tabela, filtro = "") => (await rest(`${tabela}?select=id${filtro}`, { headers: { Range: "0-0" } })).total;

const empresa = (await rest("rpc/bp_garantir_empresa", { method: "POST", body: JSON.stringify({ p_nome: "Empresa Demo" }) })).dados;
const CARGOS = [["Diretor Geral", "Conselho Administrativo"], ["Gerente de RH", "Ricardo Almeida"], ["Gerente de Tecnologia", "Ricardo Almeida"], ["Gerente Comercial", "Ricardo Almeida"], ["Gerente Financeiro", "Ricardo Almeida"], ["Gerente de Operações", "Ricardo Almeida"]];
const BASE = ["Analista de RH", "Desenvolvedor Front-end", "Executivo de Contas", "Analista Financeiro", "Analista de Operações", "Assistente de RH", "Desenvolvedor Back-end", "Analista Comercial", "Assistente Financeiro", "Analista de Logística", "Analista de QA", "Consultor de Vendas", "Analista Contábil", "Analista de Qualidade", "Analista de Dados", "Analista de Marketing"];
const GESTOR = { RH: "Mariana Duarte", Tec: "Bruno Martins", Com: "Camila Ribeiro", Fin: "Felipe Azevedo", Op: "Juliana Castro" };
const gestorDe = (cargo) => (/RH|Recrut/.test(cargo) ? GESTOR.RH : /Desenvolv|QA|Dados/.test(cargo) ? GESTOR.Tec : /Comercial|Contas|Vendas|Marketing/.test(cargo) ? GESTOR.Com : /Financ|Contábil/.test(cargo) ? GESTOR.Fin : GESTOR.Op);
const pessoas = Array.from({ length: 50 }, (_, i) => {
  const [cargo, gestor] = i < CARGOS.length ? CARGOS[i] : [BASE[i % BASE.length], gestorDe(BASE[i % BASE.length])];
  return { empresa_id: empresa, nome: `Pessoa ${String(i + 1).padStart(2, "0")}`, cargo, gestor, email: `p${i}@demo.test`, telefone: `4190000${String(i).padStart(4, "0")}` };
});
await rest("bp_colaboradores", { method: "POST", body: JSON.stringify(pessoas) });
const antes = (await rest("bp_colaboradores?select=id,area,admissao,salario,vinculo,status&order=id")).dados;

const chrome = await abrirChrome({ extensao: join(RAIZ, "extension") });
const foto = async (p, n, o) => FOTOS && p.foto(join(FOTOS, `${n}.png`), o);
try {
  const painel = await chrome.aba(chrome.url("sidepanel.html"));
  await painel.esperarAte("document.querySelector('#auth-email')");
  await painel.avaliar(`document.querySelector('#auth-email').value='demo@bp.test';document.querySelector('#auth-password').value='BpTeste2026';document.querySelector('.auth form').requestSubmit();`);
  await painel.esperarAte("document.querySelector('#area-gestao .kpi__valor')");
  checar("Painel com os 50 colaboradores", (await painel.avaliar("document.querySelector('#area-gestao .kpi__valor').textContent")) === "50");

  const cfg = await chrome.aba(chrome.url("options.html#demo"));
  await cfg.tamanho(1100, 1000, 1);
  await cfg.esperarAte("[...document.querySelectorAll('#demo-area button')].some(b=>b.textContent.includes('Gerar cenário'))");
  await cfg.avaliar("[...document.querySelectorAll('#demo-area button')].find(b=>b.textContent.includes('Gerar cenário')).click()");
  await cfg.esperarAte("document.querySelector('dialog[open]')");
  await cfg.avaliar("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Gerar cenário').click()");
  const t0 = Date.now();
  checar("Cenário gerado", await cfg.esperarAte("[...document.querySelectorAll('#demo-area button')].some(b=>b.textContent.includes('Remover cenário'))", 120000), `${Math.round((Date.now() - t0) / 1000)}s · ${await cfg.avaliar("document.querySelector('#demo-area').innerText.slice(0,160)")}`);

  const n = {
    avaliacoes: await contar("bp_avaliacoes", "&demo=eq.true"),
    onboardings: await contar("bp_onboardings", "&demo=eq.true"),
    desligamentos: await contar("bp_desligamentos", "&demo=eq.true&entrevista=not.is.null"),
    pulsos: await contar("bp_pesquisas", "&demo=eq.true&tipo=neq.offboarding"),
    respostas: await contar("bp_respostas"),
    ativos: await contar("bp_colaboradores", "&status=eq.ativo"),
  };
  checar("Avaliações, onboardings, desligamentos com entrevista e pulsos criados", n.avaliacoes > 250 && n.onboardings === 5 && n.desligamentos === 6 && n.pulsos === 2 && n.respostas > 60, JSON.stringify(n));
  checar("Base ativa continua com as 50 pessoas", n.ativos === 50, String(n.ativos));

  // O painel atualiza sozinho e mostra o cenário em todas as funcionalidades.
  checar("Painel atualiza sozinho com o cenário", await painel.esperarAte("!document.querySelector('#area-gestao .kpi__valor + *')?.textContent.includes('+0 / −0')", 20000));
  await esperar(800);
  const textos = {};
  for (const aba of ["gestao", "onboarding", "produtividade", "cultura", "turnover", "pulso", "offboarding"]) {
    await painel.avaliar(`document.querySelector('#aba-${aba}').click()`);
    await painel.esperarAte(`document.querySelector('#area-${aba}:not([hidden]) .kpi')`);
    await esperar(700);
    textos[aba] = await painel.avaliar(`document.querySelector('#area-${aba}').innerText`);
    await foto(painel, `demo-${aba}`, { inteira: true });
  }
  checar("Gestão com turnover, risco e projeção", /Turnover 12 meses\s*\d+,\d%/.test(textos.gestao) && /Risco de saída alto\s*[1-9]/.test(textos.gestao), textos.gestao.match(/Turnover 12 meses\s*[^\n]+/)?.[0]);
  checar("Onboarding com fase atrasada", /Com fase atrasada\s*1/.test(textos.onboarding), textos.onboarding.match(/Com fase atrasada\s*\d/)?.[0]);
  checar("Comercial é a área mais fraca em Cultura", /Comercial/.test(textos.cultura));
  checar("Turnover com custo e motivos", /R\$/.test(textos.turnover) && /Motivos de saída/.test(textos.turnover));
  checar("Pulso com 2 pesquisas respondidas", /Respostas recebidas\s*\d{2,}/.test(textos.pulso), textos.pulso.match(/Respostas recebidas\s*\d+/)?.[0]);
  checar("Offboarding com entrevistas respondidas", /Entrevistas respondidas\s*100%/.test(textos.offboarding), textos.offboarding.match(/Entrevistas respondidas\s*[^\n]+/)?.[0]);

  // Remover devolve tudo como era.
  await cfg.avaliar("[...document.querySelectorAll('#demo-area button')].find(b=>b.textContent.includes('Remover cenário')).click()");
  await cfg.esperarAte("document.querySelector('dialog[open]')");
  await cfg.avaliar("[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent==='Remover cenário').click()");
  checar("Cenário removido", await cfg.esperarAte("[...document.querySelectorAll('#demo-area button')].some(b=>b.textContent.includes('Gerar cenário'))", 120000));
  const depois = (await rest("bp_colaboradores?select=id,area,admissao,salario,vinculo,status&order=id")).dados;
  checar("Cadastros iguais aos de antes", JSON.stringify(depois) === JSON.stringify(antes), `${depois.length} cadastros`);
  const sobras = { av: await contar("bp_avaliacoes"), onb: await contar("bp_onboardings"), desl: await contar("bp_desligamentos"), pesq: await contar("bp_pesquisas"), hist: await contar("bp_historico", "&demo=eq.true") };
  checar("Nada fictício sobrou", Object.values(sobras).every((v) => v === 0), JSON.stringify(sobras));
  checar("Painel volta ao estado sem cenário", await painel.esperarAte("document.querySelector('#aba-gestao').click() || document.querySelector('#area-gestao').innerText.includes('+0 / −0')", 20000));
} catch (e) {
  console.error(e);
  falhas++;
} finally {
  const erros = chrome.logs.filter((l) => !/sk-ant-invalida|gsk_invalida|401|Anthropic|Groq|Claude/i.test(l));
  checar("Sem erros de JavaScript", erros.length === 0, erros.slice(0, 3).join(" | "));
  await chrome.fechar();
  execSync("node build.mjs", { cwd: RAIZ, stdio: "ignore" });
  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}
