// Teste ponta a ponta do BP contra o Supabase local (supabase start nesta
// pasta). Gera um pacote de teste com chaves de IA inválidas (o Motion cai no
// roteiro-base, sem custo), carrega a extensão num Chrome headless, cria dados
// pela interface e pela API, responde às pesquisas pela página pública e
// confere resultados, histórico, PDF, Motion e isolamento entre empresas.
//
// Uso: node scripts/e2e.mjs [--fotos <pasta>]
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirChrome, esperar } from "./chrome.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const fotosIdx = process.argv.indexOf("--fotos");
const FOTOS = fotosIdx > 0 ? process.argv[fotosIdx + 1] : null;
if (FOTOS) mkdirSync(FOTOS, { recursive: true });
const PORTA_PUBLICA = 54799;

const env = Object.fromEntries(
  execSync("supabase status -o env", { cwd: RAIZ, encoding: "utf8" })
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const API = env.API_URL;
const SERVICE = env.SERVICE_ROLE_KEY;
const PUB = env.PUBLISHABLE_KEY;

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

// ─── Pacote de teste ───────────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), "bp-teste-"));
writeFileSync(
  join(tmp, "teste.env"),
  `SUPABASE_URL=${API}\nSUPABASE_PUBLISHABLE_KEY=${PUB}\nBP_PUBLIC_URL=http://127.0.0.1:${PORTA_PUBLICA}/\nANTHROPIC_API_KEY=sk-ant-invalida\nGROQ_API_KEY=gsk_invalida\n`,
);
execSync(`node build.mjs --env ${join(tmp, "teste.env")}`, { cwd: RAIZ, stdio: "ignore" });

// ─── Página pública servida localmente ─────────────────────────────────────
const servidor = createServer((req, res) => {
  const caminho = new URL(req.url, "http://x").pathname;
  const arquivo = join(RAIZ, "public-dist", caminho === "/" ? "index.html" : caminho.slice(1));
  if (!existsSync(arquivo)) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": arquivo.endsWith(".html") ? "text/html; charset=utf-8" : "image/png" }).end(readFileSync(arquivo));
}).listen(PORTA_PUBLICA);

// ─── Contas de teste ───────────────────────────────────────────────────────
const admin = (caminho, opcoes = {}) =>
  fetch(`${API}${caminho}`, { ...opcoes, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(opcoes.headers ?? {}) } });

async function conta(email) {
  const lista = await (await admin("/auth/v1/admin/users?per_page=200")).json();
  const existente = lista.users?.find((u) => u.email === email);
  if (existente) {
    await admin(`/rest/v1/bp_empresas?criado_por=eq.${existente.id}`, { method: "DELETE" });
    return existente.id;
  }
  const u = await (await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password: "BpTeste2026", email_confirm: true, user_metadata: { senhaPropria: true } }) })).json();
  return u.id;
}
await conta("rh@bp.test");
await conta("outra@bp.test");

async function sessao(email) {
  const r = await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "BpTeste2026" }) })).json();
  const rest = (caminho, opcoes = {}) =>
    fetch(`${API}/rest/v1/${caminho}`, { ...opcoes, headers: { apikey: PUB, Authorization: `Bearer ${r.access_token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opcoes.headers ?? {}) } }).then(async (x) => ({ status: x.status, dados: await x.json().catch(() => null) }));
  return rest;
}

// ─── Navegador ─────────────────────────────────────────────────────────────
const downloads = mkdtempSync(join(tmpdir(), "bp-downloads-"));
const chrome = await abrirChrome({ extensao: join(RAIZ, "extension"), downloads });
const painel = await chrome.aba(chrome.url("sidepanel.html"));
const foto = async (p, nome, opcoes) => FOTOS && p.foto(join(FOTOS, `${nome}.png`), opcoes);

// Ajudantes de interface (executados na página).
const js = {
  clicar: (texto, escopo = "document") => `(()=>{const b=[...${escopo}.querySelectorAll('button,a')].find(x=>x.textContent.trim().includes(${JSON.stringify(texto)})&&!x.disabled&&x.offsetParent!==null);if(!b)throw new Error('botão não encontrado: '+${JSON.stringify(texto)});b.click();return true})()`,
  modal: "document.querySelector('dialog[open]')",
};
const clicar = (p, texto, escopo) => p.avaliar(js.clicar(texto, escopo));
const naModal = (p, codigo) => p.avaliar(`(()=>{const m=document.querySelector('dialog[open]');if(!m)throw new Error('sem modal');${codigo}})()`);
const preencher = (seletor, valor) => `{const e=m.querySelector(${JSON.stringify(seletor)});e.value=${JSON.stringify(valor)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}`;

try {
  // 1. Login
  await painel.esperarAte("document.querySelector('#auth-email')");
  await painel.avaliar(`document.querySelector('#auth-email').value='rh@bp.test';document.querySelector('#auth-password').value='BpTeste2026';document.querySelector('.auth form').requestSubmit();`);
  checar("Login abre o painel", await painel.esperarAte("document.querySelector('#aba-gestao[aria-selected=true]')"));
  checar("9 funcionalidades no menu", (await painel.avaliar("document.querySelectorAll('.tabs__tab').length")) === 9);
  await painel.avaliar("chrome.storage.local.set({branding:{empresa:'Aurora Teste',cor:'#0E7AB8'}})");

  // 2. Base pela API (como a conta logada): quadro com 2 anos de história.
  const rest = await sessao("rh@bp.test");
  const empresa = (await rest("rpc/bp_garantir_empresa", { method: "POST", body: JSON.stringify({ p_nome: "Aurora Teste" }) })).dados;
  const hoje = new Date();
  const dia = (d) => new Date(hoje.getTime() - d * 86400000).toLocaleDateString("sv-SE");
  const areas = ["Comercial", "Tecnologia", "Operações", "Financeiro"];
  const gestores = ["Marina Lopes", "Rafael Dias", "Paula Reis", "Caio Nunes"];
  const pessoas = Array.from({ length: 22 }, (_, i) => ({
    empresa_id: empresa,
    nome: ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo", "Isis", "João", "Kátia", "Leo", "Mara", "Nina", "Otávio", "Pedro", "Quésia", "Rui", "Sara", "Téo", "Úrsula", "Vera"][i] + " " + ["Souza", "Lima", "Alves", "Costa"][i % 4],
    email: `p${i}@aurora.test`,
    cargo: ["Analista", "Especialista", "Coordenador(a)", "Desenvolvedor(a)"][i % 4],
    area: areas[i % 4],
    gestor: gestores[i % 4],
    vinculo: i % 7 === 0 ? "pj" : "clt",
    salario: 5000 + (i % 5) * 1800,
    admissao: dia(40 + i * 33),
  }));
  const colabs = (await rest("bp_colaboradores", { method: "POST", body: JSON.stringify(pessoas) })).dados;
  checar("Base inserida pela API com RLS", Array.isArray(colabs) && colabs.length === 22, Array.isArray(colabs) ? "" : JSON.stringify(colabs));
  const notas = (base, dim) => Object.fromEntries((dim === "produtividade" ? ["produtividade", "qualidade", "ferramentas", "priorizacao", "tempo", "aprendizado", "relacionamento", "comunicacao"] : ["criatividade", "confianca", "resultado", "sensoDono", "adaptabilidade", "resiliencia", "longoPrazo", "colaboracao"]).map((k, j) => [k, Math.max(1, Math.min(5, base + ((j % 3) - 1)))]));
  const avals = [];
  colabs.forEach((c, i) => {
    for (const [k, meses] of [[0, 9], [1, 5], [2, 1]]) {
      for (const dim of ["produtividade", "cultura"]) {
        const base = 2 + ((i + k) % 4);
        const n = notas(base, dim);
        const media = Object.values(n).reduce((s, x) => s + x, 0) / 8;
        avals.push({ empresa_id: empresa, colaborador_id: c.id, dimensao: dim, data: dia(meses * 30 + (i % 20)), notas: n, media: Math.round(media * 100) / 100, comentario: k === 2 && i % 5 === 0 ? "Entregas consistentes; combinar foco em priorização." : null });
      }
    }
  });
  const ra = await rest("bp_avaliacoes", { method: "POST", body: JSON.stringify(avals) });
  checar("Avaliações históricas inseridas", ra.status === 201, String(ra.status));
  // Saídas no passado (mês a mês).
  const saidas = colabs.slice(14, 20).map((c, k) => ({ empresa_id: empresa, colaborador_id: c.id, data: dia(20 + k * 50), tipo: k % 2 ? "dispensa_sem_justa_causa" : "pedido_demissao", voluntario: k % 2 === 0, motivo: ["remuneracao", "crescimento", "lideranca", "proposta", "carga", "reestruturacao"][k], custo: 18000 + k * 2500 }));
  const rs = await rest("bp_desligamentos", { method: "POST", body: JSON.stringify(saidas) });
  checar("Desligamentos históricos inseridos", rs.status === 201, String(rs.status));

  // 3. Recarrega o painel com a base.
  await painel.ir(chrome.url("sidepanel.html"));
  await painel.esperarAte("document.querySelector('#area-gestao .kpi')");
  const gestaoTexto = await painel.avaliar("document.querySelector('#area-gestao').innerText");
  checar("Gestão mostra headcount atual (16 ativos)", /Headcount\s*16/.test(gestaoTexto), gestaoTexto.slice(0, 80).replace(/\n/g, " "));
  checar("Gestão mostra histórico e projeção", /Histórico e projeção/i.test(gestaoTexto) && /Projeção/i.test(gestaoTexto) && (await painel.avaliar("document.querySelectorAll('#area-gestao svg.g').length")) >= 3);
  await foto(painel, "01-gestao", { inteira: true });

  // 4. Pessoas: novo colaborador pela interface.
  await clicar(painel, "Pessoas", "document.querySelector('#abas')");
  await painel.esperarAte("document.querySelector('#area-pessoas:not([hidden]) .lista')");
  await clicar(painel, "Novo colaborador");
  await painel.esperarAte(js.modal);
  await naModal(painel, `${preencher("form input:not([type])", "Zélia Martins")} m.querySelectorAll('input:not([type])')[1].value='Gerente de Projetos'; m.querySelectorAll('input:not([type])')[2].value='Tecnologia'; m.querySelector('input[type=email]').value='zelia@aurora.test'; m.querySelector('input[type=number]').value='12000'; m.querySelector('input[type=date]').value='${dia(10)}'; m.querySelector('form').requestSubmit();`);
  checar("Colaborador criado pela interface abre a ficha", await painel.esperarAte("document.querySelector('#area-pessoas h1')?.textContent==='Zélia Martins'"));
  const zelia = (await rest("bp_colaboradores?email=eq.zelia@aurora.test&select=id")).dados[0].id;

  // 5. Onboarding pela interface.
  await clicar(painel, "Iniciar onboarding");
  await painel.esperarAte(js.modal);
  await naModal(painel, "m.querySelector('form').requestSubmit();");
  checar("Onboarding iniciado com 3 fases", await painel.esperarAte("document.querySelectorAll('#area-onboarding .fase').length===3"));
  await painel.avaliar("document.querySelectorAll('#area-onboarding .tarefas input')[0].click()");
  await painel.avaliar("document.querySelectorAll('#area-onboarding .tarefas input')[1].click()");
  await painel.avaliar("document.querySelectorAll('#area-onboarding .tarefas input')[2].click()");
  await esperar(1500);
  const onb = (await rest(`bp_onboardings?colaborador_id=eq.${zelia}&select=progresso,fases`)).dados[0];
  checar("Tarefas marcadas atualizam o progresso no banco", onb.progresso === 25, `${onb.progresso}%`);
  await foto(painel, "02-onboarding", { inteira: true });

  // 6. Produtividade e Cultura pela interface.
  for (const dim of ["produtividade", "cultura"]) {
    await clicar(painel, dim === "produtividade" ? "Produtividade" : "Cultura", "document.querySelector('#abas')");
    await painel.esperarAte(`document.querySelector('#area-${dim}:not([hidden]) .kpis')`);
    await clicar(painel, "Nova avaliação");
    await painel.esperarAte(js.modal);
    await naModal(painel, `const s=m.querySelector('select');s.value='${zelia}';s.dispatchEvent(new Event('change'));m.querySelectorAll('.notas').forEach((n,i)=>n.querySelectorAll('input')[i%2?3:4].click());m.querySelector('textarea').value='Excelente início.';m.querySelector('form').requestSubmit();`);
    await painel.esperarAte("!document.querySelector('dialog[open]')");
  }
  const avZelia = (await rest(`bp_avaliacoes?colaborador_id=eq.${zelia}&select=dimensao,media`)).dados;
  checar("Avaliações de Produtividade e Cultura salvas", avZelia.length === 2 && avZelia.every((a) => Number(a.media) === 4.5), JSON.stringify(avZelia));
  await foto(painel, "03-cultura", { inteira: true });

  // 7. Pulso: pesquisa de 30 perguntas e personalizada.
  await clicar(painel, "Pulso", "document.querySelector('#abas')");
  await painel.esperarAte("document.querySelector('#area-pulso:not([hidden]) .kpis')");
  await clicar(painel, "Nova pesquisa");
  await painel.esperarAte(js.modal);
  const tipos = await painel.avaliar("[...document.querySelectorAll('dialog[open] .tipo')].map(b=>b.innerText.replace(/\\n/g,' | '))");
  checar("5 tipos de pesquisa (15, 15, 30, 30, personalizada)", tipos.length === 5 && tipos.filter((t) => t.includes("15 perguntas")).length === 2 && tipos.filter((t) => t.includes("30 perguntas")).length === 2 && tipos.some((t) => t.includes("Personalizada")), tipos.join(" / "));
  await clicar(painel, "Clima Organizacional", "document.querySelector('dialog[open]')");
  await painel.esperarAte("document.querySelector('dialog[open] form')");
  await naModal(painel, "m.querySelector('form').requestSubmit();");
  await painel.esperarAte("document.querySelector('#area-pulso .link-publico input')");
  const linkClima = await painel.avaliar("document.querySelector('#area-pulso .link-publico input').value");
  checar("Pesquisa de clima gera link público", linkClima.startsWith(`http://127.0.0.1:${PORTA_PUBLICA}/?t=`), linkClima);
  await foto(painel, "04-pulso-criado", { inteira: true });

  // Personalizada (identificada).
  await clicar(painel, "← Pesquisas");
  await clicar(painel, "Nova pesquisa");
  await painel.esperarAte(js.modal);
  await clicar(painel, "Personalizada", "document.querySelector('dialog[open]')");
  await painel.esperarAte("document.querySelector('dialog[open] .editor__pergunta')");
  await naModal(painel, `m.querySelector('input:not([type])').value='Retorno ao escritório';const t=m.querySelectorAll('.editor__pergunta textarea');t[0].value='O modelo híbrido atual funciona para mim.';t[1].value='Recomendaria a empresa?';t[2].value='Comentários';t.forEach(x=>x.dispatchEvent(new Event('input')));m.querySelector('input[type=checkbox]:not(.editor input)').click();`);
  await clicar(painel, "Adicionar pergunta", "document.querySelector('dialog[open]')");
  await naModal(painel, `const ps=m.querySelectorAll('.editor__pergunta');const u=ps[ps.length-1];const s=u.querySelector('select');s.value='multipla';s.dispatchEvent(new Event('change'));`);
  await naModal(painel, `const ps=m.querySelectorAll('.editor__pergunta');const u=ps[ps.length-1];const t=u.querySelector('textarea');t.value='Quais dias você prefere?';t.dispatchEvent(new Event('input'));m.querySelector('form').requestSubmit();`);
  await painel.esperarAte("document.querySelector('#area-pulso .link-publico input')");
  const linkPers = await painel.avaliar("document.querySelector('#area-pulso .link-publico input').value");
  const pers = (await rest("bp_pesquisas?tipo=eq.personalizada&select=perguntas,anonima")).dados[0];
  checar("Pesquisa personalizada salva com as perguntas escritas", pers?.perguntas.length === 4 && pers.perguntas[3].tipo === "multipla" && pers.anonima === false, JSON.stringify(pers?.perguntas.map((q) => q.tipo)));

  // 8. Respostas pela página pública (sem login).
  const publica = await chrome.aba();
  for (const [k, area] of [[0, "Comercial"], [1, "Comercial"], [2, "Comercial"], [3, "Tecnologia"]]) {
    await publica.ir(linkClima);
    await publica.esperarAte("document.querySelector('form fieldset')");
    if (k === 0) {
      checar("Página pública mostra as 30 perguntas", (await publica.avaliar("document.querySelectorAll('fieldset[data-id]').length")) === 30);
      await publica.avaliar("document.querySelector('form').requestSubmit()");
      checar("Página pública bloqueia envio sem respostas obrigatórias", await publica.esperarAte("document.querySelectorAll('fieldset.erro').length>0"));
      await foto(publica, "05-publica-erros");
    }
    await publica.avaliar(`document.querySelector('#area').value=${JSON.stringify(area)};document.querySelectorAll('fieldset[data-id]').forEach((f,i)=>{const r=f.querySelectorAll('input[type=radio]');if(r.length===11)r[${k} === 3 ? 4 : 9].click();else if(r.length)r[Math.min(r.length-1,${k} === 3 ? 1 : 3 + (i%2))].click();const t=f.querySelector('textarea');if(t)t.value='Mais clareza nas prioridades ${k}';});document.querySelector('form').requestSubmit();`);
    checar(`Resposta pública ${k + 1} registrada`, await publica.esperarAte("document.querySelector('.estado h1')?.textContent==='Obrigado!'"));
  }
  await publica.ir(linkPers);
  await publica.esperarAte("document.querySelector('#nome')");
  await publica.avaliar(`document.querySelector('#nome').value='Zélia';document.querySelector('#email').value='zelia@aurora.test';document.querySelectorAll('fieldset[data-id]').forEach(f=>{const r=f.querySelectorAll('input');if(r.length)r[r.length>5?8:3]?.click?.()||r[0].click();});document.querySelector('form').requestSubmit();`);
  checar("Resposta identificada registrada", await publica.esperarAte("document.querySelector('.estado h1')?.textContent==='Obrigado!'"));
  await foto(publica, "06-publica-obrigado");

  // 9. Resultados de volta na plataforma.
  await clicar(painel, "← Pesquisas");
  await painel.avaliar(js.clicar("Clima Organizacional", "document.querySelector('#area-pulso')"));
  await painel.esperarAte("[...document.querySelectorAll('#area-pulso button')].some(b=>b.textContent.includes('Atualizar respostas'))");
  await clicar(painel, "Atualizar respostas");
  await painel.esperarAte("document.querySelector('#area-pulso .medidores')");
  const resultado = await painel.avaliar("document.querySelector('#area-pulso').innerText");
  checar("Respostas voltam para a plataforma (4)", /Respostas\s*4/.test(resultado), resultado.match(/Respostas\s*\d+/)?.[0]);
  checar("Resultado mostra favorabilidade, eNPS, dimensões e recorte por área", /Favorabilidade/.test(resultado) && /eNPS/.test(resultado) && /Liderança/.test(resultado) && /Favorabilidade por área/.test(resultado));
  checar("Recorte por área respeita o mínimo de 3 respostas", /Comercial/.test(resultado.split("Favorabilidade por área")[1] ?? "") && !/Tecnologia/.test((resultado.split("Favorabilidade por área")[1] ?? "").split("Por pergunta")[0]));
  await foto(painel, "07-pulso-resultado", { inteira: true });

  // 10. Offboarding com entrevista pelo link.
  const alvo = colabs[2];
  await clicar(painel, "Offboarding", "document.querySelector('#abas')");
  await painel.esperarAte("document.querySelector('#area-offboarding:not([hidden]) .kpis')");
  await clicar(painel, "Registrar desligamento");
  await painel.esperarAte(js.modal);
  await naModal(painel, `const s=m.querySelector('select');s.value='${alvo.id}';s.dispatchEvent(new Event('change'));const t=m.querySelectorAll('select')[1];t.value='pedido_demissao';t.dispatchEvent(new Event('change'));m.querySelectorAll('select')[2].value='proposta';m.querySelector('form').requestSubmit();`);
  await painel.esperarAte("document.querySelector('#area-offboarding h1')?.textContent==='${alvo.nome}'".replace("${alvo.nome}", alvo.nome));
  const status = (await rest(`bp_colaboradores?id=eq.${alvo.id}&select=status`)).dados[0].status;
  checar("Desligamento muda o colaborador para desligado", status === "desligado");
  await clicar(painel, "Gerar link da entrevista");
  await painel.esperarAte("document.querySelector('#area-offboarding input[aria-label=\"Link da entrevista\"]')");
  const linkSaida = await painel.avaliar("document.querySelector('#area-offboarding input[aria-label=\"Link da entrevista\"]').value");
  await publica.ir(linkSaida);
  await publica.esperarAte("document.querySelector('form fieldset')");
  await publica.avaliar(`document.querySelectorAll('fieldset[data-id]').forEach((f,i)=>{const r=f.querySelectorAll('input');if(r.length)(r[1]??r[0]).click();const t=f.querySelector('textarea');if(t)t.value='Plano de carreira mais claro.';});document.querySelector('form').requestSubmit();`);
  checar("Entrevista de desligamento respondida pelo link", await publica.esperarAte("document.querySelector('.estado h1')?.textContent==='Obrigado!'"));
  await publica.ir(linkSaida);
  checar("Link de uso único não aceita segunda resposta", await publica.esperarAte("document.querySelector('.estado h1')?.textContent.includes('já respondida')"));
  await clicar(painel, "Verificar resposta");
  checar("Entrevista volta para o registro", await painel.esperarAte("document.querySelector('#area-offboarding').innerText.includes('Plano de carreira mais claro')"));
  await foto(painel, "08-offboarding", { inteira: true });

  // 11. Turnover.
  await clicar(painel, "Turnover", "document.querySelector('#abas')");
  await painel.esperarAte("document.querySelector('#area-turnover:not([hidden]) .kpis')");
  const tov = await painel.avaliar("document.querySelector('#area-turnover').innerText");
  checar("Turnover calcula taxa, custo e risco", /Turnover 12 meses\s*[\d,]+%/.test(tov) && /R\$/.test(tov) && /Risco de saída/.test(tov), tov.slice(0, 120).replace(/\n/g, " "));
  await foto(painel, "09-turnover", { inteira: true });

  // 12. Histórico completo do colaborador.
  const hist = (await rest(`bp_historico?colaborador_id=eq.${zelia}&select=modulo,evento,resumo&order=criado_em`)).dados;
  const modulos = new Set(hist.map((x) => x.modulo));
  checar("Histórico registra cadastro, onboarding, produtividade, cultura e pulso", ["pessoas", "onboarding", "produtividade", "cultura", "pulso"].every((m) => modulos.has(m)), [...modulos].join(", "));
  const histAlvo = (await rest(`bp_historico?colaborador_id=eq.${alvo.id}&select=modulo,evento`)).dados;
  checar("Histórico registra desligamento e entrevista", histAlvo.some((x) => x.evento === "desligamento") && histAlvo.some((x) => x.evento === "entrevista"));
  await painel.avaliar(`document.querySelector('#aba-pessoas').click()`);
  await painel.esperarAte("document.querySelector('#area-pessoas .lista')");
  await painel.avaliar(js.clicar("Zélia Martins", "document.querySelector('#area-pessoas')"));
  checar("Ficha mostra a linha do tempo", await painel.esperarAte("document.querySelectorAll('#area-pessoas .timeline__item').length>=5"));
  await foto(painel, "10-ficha", { inteira: true });

  // 13. PDF.
  await painel.avaliar(`document.querySelector('#aba-gestao').click()`);
  await painel.esperarAte("document.querySelector('#area-gestao:not([hidden]) .kpi')");
  await clicar(painel, "Baixar PDF", "document.querySelector('#area-gestao')");
  let pdf = null;
  for (let i = 0; i < 100 && !pdf; i++) {
    await esperar(300);
    pdf = readdirSync(downloads).find((f) => f.endsWith(".pdf"));
  }
  checar("Baixar PDF gera o arquivo", Boolean(pdf), pdf ?? `nenhum arquivo · aviso: ${await painel.avaliar("document.querySelector('#toast')?.textContent ?? '-'")} · ${chrome.logs.slice(-3).join(" | ")}`);
  const docs = (await rest("bp_documentos?tipo=eq.pdf&select=modulo")).dados;
  checar("PDF gerado fica guardado", docs.some((d) => d.modulo === "gestao"));

  // 14. Motion (roteiro-base, sem IA).
  await clicar(painel, "Gerar Motion", "document.querySelector('#area-gestao')");
  await painel.esperarAte(js.modal);
  await naModal(painel, "m.querySelector('textarea').value='Panorama para o conselho com foco em retenção';m.querySelector('form').requestSubmit();");
  await painel.esperarAte("!document.querySelector('dialog[open]')", 40000);
  const motionDoc = (await rest("bp_documentos?tipo=eq.motion&select=id,conteudo&order=criado_em.desc&limit=1")).dados[0];
  checar("Motion gera e guarda o roteiro", motionDoc?.conteudo?.roteiro?.cenas?.length >= 3, `${motionDoc?.conteudo?.roteiro?.cenas?.length} cenas · ${motionDoc?.conteudo?.origem}`);
  const motion = await chrome.aba(chrome.url(`motion.html?id=${motionDoc.id}`));
  await motion.tamanho(1400, 1000, 1);
  checar("Página do Motion toca a apresentação", await motion.esperarAte("document.querySelector('#palco:not([hidden])') && document.querySelectorAll('#cenas li').length>=3", 20000));
  await motion.avaliar("document.querySelector('#play').click()");
  for (const [k, t] of [[1, 2.2], [2, 7.5], [3, 14], [4, 22]]) {
    await motion.avaliar(`(()=>{const r=document.querySelector('#linha');r.value=String(${t}/${motionDoc.conteudo.roteiro.cenas.reduce((s, c) => s + c.duracao, 0)});r.dispatchEvent(new Event('input'));})()`);
    await esperar(200);
    await foto(motion, `11-motion-${k}`);
  }
  const pixels = await motion.avaliar("(()=>{const c=document.querySelector('canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4000)if(d[i]+d[i+1]+d[i+2]>200)n++;return n})()");
  checar("Canvas do Motion desenhado", pixels > 20, `${pixels} amostras claras`);
  await motion.avaliar("document.querySelector('#formato').value='9:16';document.querySelector('#formato').dispatchEvent(new Event('change'))");
  checar("Motion troca para vertical 9:16", (await motion.avaliar("document.querySelector('canvas').height")) === 1920);
  await foto(motion, "12-motion-vertical");

  // 15. Isolamento.
  const outra = await sessao("outra@bp.test");
  await outra("rpc/bp_garantir_empresa", { method: "POST", body: JSON.stringify({ p_nome: "Outra" }) });
  const visto = (await outra("bp_colaboradores?select=id")).dados;
  checar("Outra empresa não vê os colaboradores", Array.isArray(visto) && visto.length === 0);
  const invasao = await outra("bp_colaboradores", { method: "POST", body: JSON.stringify({ empresa_id: empresa, nome: "Intruso" }) });
  checar("Outra empresa não grava na base alheia", invasao.status >= 400, String(invasao.status));
  const anon = await fetch(`${API}/rest/v1/bp_respostas?select=*`, { headers: { apikey: PUB } });
  checar("Sem login não lê respostas", anon.status === 401 || (await anon.json()).length === 0, String(anon.status));
  const falso = await (await fetch(`${API}/rest/v1/rpc/bp_pesquisa_publica`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ p_token: "0".repeat(64) }) })).json();
  checar("Token inexistente não abre pesquisa", falso === null);

  // Exclusão de pessoa com desligamento (cascata) funciona.
  const exclusao = await rest(`bp_colaboradores?id=eq.${colabs[15].id}`, { method: "DELETE" });
  checar("Excluir colaborador com desligamento apaga em cascata", exclusao.status < 300, String(exclusao.status));

  // 16. Configurações › Colaboradores: um a um, modelo, importação em massa.
  const cfg = await chrome.aba(chrome.url("options.html#colaboradores"));
  await cfg.tamanho(1100, 1000, 1);
  checar("Configurações mostram a seção Colaboradores", await cfg.esperarAte("document.querySelector('.form-colaborador')"));
  await cfg.avaliar(`(()=>{const f=document.querySelector('.form-colaborador');const i=f.querySelectorAll('input');i[0].value='Yara Campos';i[1].value='Analista de RH';i[2].value='Marina Lopes';i[3].value='yara@aurora.test';i[4].value='(11) 91234-5678';f.querySelector('button[value=outro]').click();})()`);
  checar("Salvar e cadastrar outro limpa o formulário", await cfg.esperarAte("document.querySelector('.form-colaborador input').value==='' && document.body.innerText.includes('Yara Campos')"));
  const yara = (await rest("bp_colaboradores?email=eq.yara@aurora.test&select=telefone,gestor")).dados[0];
  checar("Cadastro manual grava telefone normalizado", yara?.telefone === "11912345678" && yara.gestor === "Marina Lopes", JSON.stringify(yara));
  await cfg.avaliar(`(()=>{const f=document.querySelector('.form-colaborador');f.querySelectorAll('input')[0].value='Sem Telefone';f.querySelectorAll('input')[4].value='123';f.querySelector('button[value=salvar]').click();})()`);
  checar("Telefone inválido é recusado", await cfg.esperarAte("document.querySelector('.form-colaborador .error:not([hidden])')?.textContent.includes('DDD')"));
  await cfg.avaliar(`document.querySelector('.form-colaborador input').value='';document.querySelectorAll('.form-colaborador input')[4].value=''`);

  await clicar(cfg, "Baixar modelo (Excel)");
  let modelo = null;
  for (let i = 0; i < 30 && !modelo; i++) {
    await esperar(300);
    modelo = readdirSync(downloads).find((f) => f.startsWith("Modelo - Colaboradores") && f.endsWith(".xlsx"));
  }
  checar("Modelo .xlsx baixado", Boolean(modelo));
  // O modelo abre no Excel (openpyxl) com as colunas pedidas.
  const cab = execSync(`python3 -c "import openpyxl,sys;w=openpyxl.load_workbook(sys.argv[1]);print('|'.join(c.value or '' for c in w.worksheets[0][1]), w.sheetnames)" "${join(downloads, modelo ?? "x")}"`, { encoding: "utf8" }).trim();
  checar("Modelo tem Nome, Cargo, Gestor, E-mail e Telefone", cab.startsWith("Nome|Cargo|Gestor|E-mail|Telefone"), cab);
  // Planilha preenchida "no Excel": telefone como número, e-mail existente (atualiza), erros.
  const preenchida = join(tmp, "colaboradores.xlsx");
  execSync(`python3 - <<'PY'
import openpyxl
w = openpyxl.load_workbook("${join(downloads, modelo ?? "x")}")
s = w.worksheets[0]
for linha in [
  ["Wagner Pires", "Coordenador Comercial", "Rafael Dias", "wagner@aurora.test", 21987654321],
  ["Xênia Prado", "Analista de Dados", "Paula Reis", "XENIA@aurora.test", "+351 912 345 678"],
  ["Yara Campos", "Coordenadora de RH", "Marina Lopes", "yara@aurora.test", "(11) 91234-5678"],
  ["Erro Email", "Analista", "Caio Nunes", "sem-arroba", ""],
  [None, "Sem nome", None, None, None],
  ["Zeca Telefone", "Analista", None, None, "999"],
]:
  s.append(linha)
w.save("${preenchida}")
PY`);
  await cfg.enviarArquivo('.importador input[type="file"]', preenchida);
  checar("Prévia da importação", await cfg.esperarAte("document.querySelector('.importador').innerText.includes('Prévia')"));
  const prev = await cfg.avaliar("[...document.querySelectorAll('.importador .kpi')].map(k=>k.querySelector('.kpi__rotulo').textContent+':'+k.querySelector('.kpi__valor').textContent).join(' ')");
  checar("Prévia separa novos, atualizados e erros", prev === "Novos:2 Atualizados:1 Sem mudança:0 Com erro:3", prev);
  await foto(cfg, "14-config-previa", { inteira: true });
  await clicar(cfg, "Importar 3");
  checar("Importação conclui", await cfg.esperarAte("document.querySelector('.importador').innerText.includes('Importação concluída')"));
  const importados = (await rest("bp_colaboradores?email=in.(wagner@aurora.test,xenia@aurora.test,yara@aurora.test)&select=email,cargo,telefone&order=email")).dados;
  checar("Banco alimentado: novos e atualização por e-mail", importados.length === 3 && importados.find((x) => x.email === "yara@aurora.test")?.cargo === "Coordenadora de RH" && importados.find((x) => x.email === "wagner@aurora.test")?.telefone === "21987654321" && importados.find((x) => x.email === "xenia@aurora.test")?.telefone === "+351912345678", JSON.stringify(importados));
  checar("Lista atualiza com os importados", await cfg.esperarAte("document.querySelector('.tabela--colaboradores').innerText.includes('Wagner Pires')"));
  await foto(cfg, "15-config-colaboradores", { inteira: true });
  // Edição pela lista.
  await cfg.avaliar("[...document.querySelectorAll('.tabela--colaboradores tr')].find(t=>t.innerText.includes('Wagner Pires')).querySelector('button').click()");
  await cfg.avaliar(`(()=>{const f=document.querySelector('.form-colaborador');f.querySelectorAll('input')[1].value='Gerente Comercial';f.querySelector('button[value=salvar]').click();})()`);
  await cfg.esperarAte("document.querySelector('.tabela--colaboradores').innerText.includes('Gerente Comercial')");
  checar("Edição pela lista grava", (await rest("bp_colaboradores?email=eq.wagner@aurora.test&select=cargo")).dados[0]?.cargo === "Gerente Comercial");

  // 17. Telas restantes para revisão visual.
  for (const aba of ["produtividade", "chat"]) {
    await painel.avaliar(`document.querySelector('#aba-${aba}').click()`);
    await esperar(1200);
    await foto(painel, `13-${aba}`, { inteira: aba !== "chat" });
  }
} catch (e) {
  console.error(e);
  falhas++;
} finally {
  const erros = chrome.logs.filter((l) => !/sk-ant-invalida|gsk_invalida|401|invalid x-api-key|authentication|Groq|Anthropic indispon|Claude indispon/i.test(l));
  checar("Sem erros de JavaScript nas páginas", erros.length === 0, erros.slice(0, 5).join(" | "));
  await chrome.fechar();
  servidor.close();
  // Volta o pacote para a configuração real (.env da ToolsKit/BP).
  execSync("node build.mjs", { cwd: RAIZ, stdio: "ignore" });
  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}
