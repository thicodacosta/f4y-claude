// Testes E2E do Pulse v2: anonimato/mínimo no banco, página pública de resposta,
// assistente (templates, perguntas, configuração), envio por e-mail (Mailpit),
// resultados por aba, permissões e rotina diária.
// Uso: node journeylab/scripts/e2e/pulse.mjs   (app em localhost:3020, Supabase local com Mailpit)
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador, BASE } from "./navegador.mjs";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const MAILPIT = "http://127.0.0.1:54524/api/v1";
const token = (conviteId) => `${conviteId}.${createHmac("sha256", process.env.PULSE_LINK_SECRET).update(`pulse:${conviteId}`).digest("base64url").slice(0, 32)}`;

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}
async function ateNoBanco(sql, p, cond, ms = 20000) {
  const fim = Date.now() + ms;
  let r;
  while (Date.now() < fim) {
    r = await um(sql, p);
    if (cond(r)) return r;
    await esperar(400);
  }
  return r;
}
async function emails(filtro) {
  const r = await (await fetch(`${MAILPIT}/messages?limit=200`)).json();
  return (r.messages ?? []).filter(filtro);
}

// ── Preparação: pesquisas da Aurora voltam ao estado do seed ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from respostas_pulse where tenant_id=$1", [AURORA]);
await adm.query("delete from participacoes_pulse where tenant_id=$1", [AURORA]);
await adm.query("delete from pesquisas_pulse where tenant_id=$1", [AURORA]);
await adm.query("delete from modelos_pulse where tenant_id=$1", [AURORA]);
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
const encerrada = await um("select id from pesquisas_pulse where tenant_id=$1 and titulo='Clima rápido · setembro'", [AURORA]);
const aberta = await um("select id from pesquisas_pulse where tenant_id=$1 and titulo='eNPS · outubro'", [AURORA]);
const area = async (nome) => (await um("select id from areas where tenant_id=$1 and nome=$2", [AURORA, nome])).id;
const uid = async (e) => (await um("select id from usuarios where email=$1", [e])).id;
const colab = async (e) => (await um("select id from colaboradores where tenant_id=$1 and email=$2", [AURORA, e])).id;
const convite = async (pesquisaId, email) => (await um("select c.id from convites_pulse c join colaboradores p on p.id=c.colaborador_id where c.pesquisa_id=$1 and p.email=$2", [pesquisaId, email])).id;

// ── 1. Banco: papel da aplicação (sem bypass de RLS) ──
{
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  const sessao = async (email) => {
    await app.query("begin");
    await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo','tenant',true)", [AURORA, await uid(email)]);
  };
  const falha = async (sql, p = []) => {
    try {
      await app.query("savepoint s");
      await app.query(sql, p);
      await app.query("release savepoint s");
      return null;
    } catch (e) {
      await app.query("rollback to savepoint s");
      return e.message;
    }
  };
  await sessao("ana@aurora.test");
  const leitura = await falha("select * from respostas_pulse limit 1");
  checar("Banco: a aplicação não LÊ respostas individuais (nem a administradora)", /permission denied/.test(leitura ?? ""), leitura ?? "leu!");
  const gravacao = await falha(
    "insert into respostas_pulse (id,tenant_id,pesquisa_id,pergunta_id,lote,valor) values (gen_random_uuid(),$1,$2,(select id from perguntas_pulse where pesquisa_id=$2 limit 1),gen_random_uuid(),5)",
    [AURORA, aberta.id],
  );
  checar("Banco: a aplicação não GRAVA respostas diretamente", /permission denied/.test(gravacao ?? ""), gravacao ?? "gravou!");
  const resumo = async (p, a) => (await app.query("select * from jl_resumo_pulse($1, $2)", [p, a])).rows[0];
  const dist = async (p, a) => (await app.query("select * from jl_distribuicao_pulse($1, $2)", [p, a])).rows.length;
  const org = await resumo(encerrada.id, null);
  checar("Banco: organização inteira liberada (11 ≥ 5)", org.liberado && org.respondentes === 11 && (await dist(encerrada.id, null)) > 0, JSON.stringify(org));
  const negocios = await resumo(encerrada.id, await area("Negócios"));
  checar("Banco: departamento com 3 respondentes é bloqueado (mínimo)", !negocios.liberado && negocios.motivo === "minimo" && (await dist(encerrada.id, await area("Negócios"))) === 0, JSON.stringify(negocios));
  const tec = await resumo(encerrada.id, await area("Tecnologia"));
  checar("Banco: departamento de 6 com complemento de 5 é liberado", tec.liberado && tec.respondentes === 6, JSON.stringify(tec));
  const emColeta = await resumo(aberta.id, null);
  checar("Banco: pesquisa anônima ativa não libera resultados", !emColeta.liberado && emColeta.motivo === "aberta");
  await app.query("rollback");
  await app.end();
}

const nav = await abrirNavegador(9449);
try {
  // ── 2. Colaboradora: sem acesso ao módulo; responde pelo Início (sessão) ──
  let e = await nav.entrar("carla@aurora.test");
  checar("Início mostra pesquisa para responder com link público", /Pesquisas para responder/.test(e.texto) && (await nav.avaliar(`!!document.querySelector('a[href="/pesquisa/responder/${aberta.id}"]')`)));
  checar("Menu do colaborador não tem Pulse", !(await nav.avaliar(`!!document.querySelector('nav a[href="/pulse"]')`)));
  e = await nav.ir("/pulse");
  checar("Colaborador não acessa /pulse", e.url.startsWith("/inicio?sem_permissao=pulse"), e.url);
  e = await nav.ir(`/pesquisa/responder/${aberta.id}`);
  checar("Logado, responde sem link pessoal (sessão)", /Começar/.test(await nav.avaliar("document.body.innerText")));

  const pub = await abrirNavegador(9451);
  try {
    // ── 3. Página pública com link pessoal (outro navegador, sem login) ──
    const tCarla = token(await convite(aberta.id, "carla@aurora.test"));
    e = await pub.ir(`/pesquisa/responder/${aberta.id}?t=${encodeURIComponent(tCarla)}`);
    checar("Link pessoal abre a pesquisa sem login", e.url.startsWith("/pesquisa/responder/") && /eNPS · outubro/.test(e.texto) && /100% anônimas/.test(e.texto), e.url);
    checar("Cabeçalho white-label com o nome da organização", /Aurora Tecnologia/.test(await pub.avaliar("document.body.innerText")));
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Começar').click()`);
    await pub.esperarAte("document.querySelector('[role=progressbar]')");
    const perguntas = (await adm.query("select id, tipo from perguntas_pulse where pesquisa_id=$1 order by ordem", [aberta.id])).rows;
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enviar respostas')).click()`);
    await pub.esperarAte("document.querySelector('[role=alert]')");
    checar("Valida pergunta obrigatória antes de enviar", /obrigatórias/.test(await pub.mensagem()));
    await pub.avaliar(`document.querySelector('input[name="q_${perguntas[0].id}"][value="8"]').click()`);
    await pub.avaliar(`(()=>{const t=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Comentário anônimo E2E');t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await esperar(300);
    checar("Rascunho salvo no sessionStorage", /Comentário anônimo E2E/.test((await pub.avaliar(`sessionStorage.getItem('pulse_rascunho_${aberta.id}')`)) ?? ""));
    checar("Barra de progresso acompanha as respostas", (await pub.avaliar("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')")) === "2");
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enviar respostas')).click()`);
    await pub.esperarAte("/Obrigado pela sua resposta/.test(document.body.innerText)");
    checar("Tela de agradecimento", /Obrigado pela sua resposta/.test(await pub.avaliar("document.body.innerText")));
    checar("Marca survey_answered_<id> no localStorage", (await pub.avaliar(`localStorage.getItem('survey_answered_${aberta.id}')`)) === "true");
    const carla = await colab("carla@aurora.test");
    checar("Participação registrada", !!(await um("select 1 from participacoes_pulse where pesquisa_id=$1 and colaborador_id=$2", [aberta.id, carla])));
    const resp = await um("select count(*)::int n, count(colaborador_id)::int ident from respostas_pulse where pesquisa_id=$1", [aberta.id]);
    checar("Resposta anônima gravada sem pessoa", resp.n === 2 && resp.ident === 0, JSON.stringify(resp));
    await pub.avaliar("localStorage.clear()");
    e = await pub.ir(`/pesquisa/responder/${aberta.id}?t=${encodeURIComponent(tCarla)}`);
    checar("Servidor impede responder duas vezes (mesmo sem a marca local)", /Você já respondeu/.test(e.texto) || /Você já respondeu/.test(await pub.avaliar("document.body.innerText")));
    e = await pub.ir(`/pesquisa/responder/${aberta.id}?t=${encodeURIComponent(tCarla.slice(0, -2) + "xx")}`);
    checar("Link adulterado não identifica ninguém", /Use o seu link pessoal/.test(await pub.avaliar("document.body.innerText")));
  } finally {
    pub.fechar();
  }

  // ── 4. RH: assistente com template, envio e e-mails ──
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/pesquisas?action=create");
  checar("/pesquisas?action=create abre o assistente", e.url === "/pulse/nova" && /Começar do zero/.test(e.texto), e.url);
  checar("Templates globais listados", ["eNPS", "Pulso Mensal", "Clima Organizacional", "Onboarding (dia 30)", "Satisfação com Liderança"].every((t) => e.texto.includes(t)));
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Satisfação com Liderança')).click()`);
  await nav.esperarAte("document.querySelector('select[aria-label=\"Tipo da nova pergunta\"]')");
  const nPerg = await nav.avaliar(`document.querySelectorAll('main li button[aria-label^="Remover pergunta"]').length`);
  checar("Passo 2 carrega as perguntas do template com prévia", nPerg === 4 && /Prévia/i.test(await nav.avaliar("document.querySelector('main').innerText")), String(nPerg));
  await nav.preencher({ 'select[aria-label="Tipo da nova pergunta"]': "boolean" });
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Adicionar pergunta')).click()`);
  await esperar(300);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Continuar').click()`);
  await nav.esperarAte("document.querySelector('[role=alert]')", 3000);
  checar("Pergunta sem enunciado é barrada", /enunciado|pergunta/i.test(await nav.mensagem()), await nav.mensagem());
  await nav.preencher({ "main ol > li:last-child input[placeholder='Escreva a pergunta']": "Você indicaria seu gestor para uma promoção?" });
  await nav.avaliar(`document.querySelector('button[aria-label="Mover para cima"]:not([disabled])') && [...document.querySelectorAll('main ol > li')].at(-1).querySelector('button[aria-label="Mover para cima"]').click()`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Continuar').click()`);
  await nav.esperarAte("/Audiência/.test(document.querySelector('main').innerText)");
  await nav.preencher({ "main section input[maxlength='120']": "Liderança E2E" });
  await nav.avaliar(`[...document.querySelectorAll('input[name=anonima]')][1].click()`);
  await nav.avaliar(`[...document.querySelectorAll('input[name=audiencia]')][3].click()`);
  await esperar(300);
  for (const nome of ["Carla", "Diego"]) await nav.avaliar(`[...document.querySelectorAll('main label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(nome)})).querySelector('input').click()`);
  await esperar(300);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Enviar agora')).click()`);
  await nav.esperarAte("/\\/pulse\\/[0-9a-f-]{36}$/.test(location.pathname)", 30000);
  const nova = await um(
    "select p.id, p.status, p.anonima, p.publico_total, (select count(*)::int from perguntas_pulse q where q.pesquisa_id=p.id) n, (select tipo from perguntas_pulse q where q.pesquisa_id=p.id and ordem=3) t3, (select count(*)::int from convites_pulse c where c.pesquisa_id=p.id and c.enviado_em is not null) enviados from pesquisas_pulse p where titulo='Liderança E2E'",
  );
  checar("Assistente cria e envia (identificada, 2 pessoas, 5 perguntas, reordenada)", nova?.status === "aberta" && !nova.anonima && nova.publico_total === 2 && nova.n === 5 && nova.t3 === "boolean" && nova.enviados === 2, JSON.stringify(nova));
  await esperar(1000);
  const convitesMail = await emails((m) => /Liderança E2E/.test(m.Subject));
  checar("E-mails de convite no Mailpit (2)", convitesMail.length === 2, convitesMail.map((m) => m.To?.[0]?.Address).join(","));
  if (convitesMail[0]) {
    const html = (await (await fetch(`${MAILPIT}/message/${convitesMail[0].ID}`)).json()).HTML ?? "";
    checar("E-mail com marca da organização e link pessoal", /Aurora Tecnologia/.test(html) && /\/pesquisa\/responder\/[0-9a-f-]{36}\?t=/.test(html));
  }

  // Diego responde pelo link pessoal (identificada); resultado aparece já com a pesquisa ativa.
  const tDiego = token(await convite(nova.id, "diego@aurora.test"));
  e = await nav.ir(`/pesquisa/responder/${nova.id}?t=${encodeURIComponent(tDiego)}`);
  checar("Aviso de pesquisa identificada", /Esta pesquisa é identificada/.test(await nav.avaliar("document.body.innerText")));
  await nav.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Começar').click()`);
  await nav.esperarAte("document.querySelector('[role=progressbar]')");
  // Responde todos os grupos de rádio (escolhe a última opção de cada grupo, inclusive linhas de matriz).
  await nav.avaliar(`(()=>{const g={};for(const r of document.querySelectorAll('input[type=radio]'))g[r.name]=r;for(const r of Object.values(g))r.click();})()`);
  await esperar(200);
  await nav.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enviar respostas')).click()`);
  await nav.esperarAte("/Obrigado pela sua resposta/.test(document.body.innerText)");
  const ident = await ateNoBanco("select count(*)::int n, count(distinct colaborador_id)::int p from respostas_pulse where pesquisa_id=$1", [nova.id], (r) => r.n > 0);
  checar("Resposta identificada ligada à pessoa", ident.n >= 4 && ident.p === 1, JSON.stringify(ident));

  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir(`/pulse/${nova.id}`);
  checar("Visão geral: participação 50% e prazo", /50%/.test(e.texto) && /1 de 2 pessoas/.test(e.texto), e.texto.slice(0, 200));
  checar("Identificada: lista quem respondeu", /Quem respondeu/.test(e.texto) && /Diego/.test(e.texto));
  e = await nav.ir(`/pulse/${nova.id}?tab=resultados`);
  checar("Identificada: resultados disponíveis com a pesquisa ativa", /1 respondente\(s\)/.test(e.texto) && /Média/.test(e.texto), e.texto.slice(0, 200));
  await nav.avaliar(`window.confirm=()=>true; [...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Enviar lembrete')).click()`);
  await esperar(2500);
  const lembrete = await ateNoBanco("select lembrete_em from convites_pulse where id=$1", [await convite(nova.id, "carla@aurora.test")], (r) => !!r.lembrete_em);
  checar("Lembrete manual só para quem não respondeu", !!lembrete.lembrete_em && !(await um("select lembrete_em from convites_pulse where id=$1", [await convite(nova.id, "diego@aurora.test")])).lembrete_em);
  checar("Lembrete chega por e-mail", (await emails((m) => /Lembrete/.test(m.Subject) && /Liderança E2E/.test(m.Subject))).length === 1);
  await nav.avaliar(`window.confirm=()=>true; [...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Encerrar').click()`);
  const fechada = await ateNoBanco("select status from pesquisas_pulse where id=$1", [nova.id], (r) => r.status === "encerrada");
  checar("RH encerra a pesquisa", fechada.status === "encerrada");
  e = await nav.ir(`/pesquisa/responder/${nova.id}?t=${encodeURIComponent(token(await convite(nova.id, "carla@aurora.test")))}`);
  checar("Pesquisa encerrada não aceita respostas", /Pesquisa encerrada/.test(await nav.avaliar("document.body.innerText")));

  // Rascunho: salvar, editar, duplicar, excluir.
  e = await nav.ir("/pulse/nova");
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('eNPS')).click()`);
  await nav.esperarAte("document.querySelector('select[aria-label=\"Tipo da nova pergunta\"]')");
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Continuar').click()`);
  await nav.esperarAte("/Audiência/.test(document.querySelector('main').innerText)");
  await nav.preencher({ "main section input[maxlength='120']": "Rascunho E2E" });
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Salvar rascunho')).click()`);
  await nav.esperarAte("/\\/pulse\\/[0-9a-f-]{36}$/.test(location.pathname)", 20000);
  const rasc = await um("select id, status, modelo_slug from pesquisas_pulse where titulo='Rascunho E2E'");
  checar("Salvar rascunho a partir do template", rasc?.status === "rascunho" && rasc.modelo_slug === "enps", JSON.stringify(rasc));
  e = await nav.ir(`/pulse/${rasc.id}/editar`);
  checar("Editar rascunho abre no passo de perguntas", /Adicionar pergunta/.test(e.texto) && (await nav.avaliar(`document.querySelectorAll('main li button[aria-label^="Remover pergunta"]').length`)) === 2);
  e = await nav.ir("/pulse");
  checar("Lista em kanban por situação com indicadores", ["Rascunho", "Ativa", "Encerrada", "Taxa média de resposta", "eNPS médio"].every((t) => e.texto.includes(t)) && /Rascunho E2E/.test(e.texto));
  e = await nav.ir(`/pulse/${rasc.id}`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Duplicar').click()`);
  const dup = await ateNoBanco("select count(*)::int n from pesquisas_pulse where titulo='Rascunho E2E (cópia)' and status='rascunho'", [], (r) => r.n === 1);
  checar("Duplicar gera novo rascunho", dup.n === 1);
  e = await nav.ir(`/pulse/${rasc.id}`);
  await nav.avaliar(`window.confirm=()=>true; [...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Excluir rascunho')).click()`);
  const exc = await ateNoBanco("select count(*)::int n from pesquisas_pulse where id=$1", [rasc.id], (r) => r.n === 0);
  checar("Excluir rascunho", exc.n === 0);

  // Resultados da anônima encerrada, por aba.
  e = await nav.ir(`/pulse/${encerrada.id}?tab=resultados`);
  checar("Resultados por pergunta (11 respondentes, comentários sem metadados)", /11 respondente\(s\)/.test(e.texto) && /O time é muito colaborativo/.test(e.texto));
  e = await nav.ir(`/pulse/${encerrada.id}?tab=resultados&departamento=${await area("Negócios")}`);
  checar("Recorte pequeno mostra aviso de anonimato", /mínimo de respondentes/.test(e.texto) && !/respondente\(s\)/.test(e.texto));
  e = await nav.ir(`/pulse/${encerrada.id}?tab=enps`);
  checar("Aba eNPS com medidor e classificação", (await nav.avaliar("!!document.querySelector('svg[aria-label^=\"eNPS\"]')")) && /Excelente|Bom|Crítico/.test(e.texto) && /eNPS por departamento/.test(e.texto));
  e = await nav.ir(`/pulse/${encerrada.id}?tab=departamentos`);
  checar("Mapa de calor por departamento (Negócios oculto)", /Mapa de calor/.test(e.texto) && /Tecnologia \(6\)/.test(e.texto) && !/Negócios \(/.test(e.texto), e.texto.slice(0, 300));
  e = await nav.ir(`/pulse/${encerrada.id}?tab=insights`);
  checar("Insights IA: estado indisponível sem chave configurada", /indisponíveis/.test(e.texto) || /Gerar insights/.test(e.texto));
  const csv = await nav.avaliar(`fetch('/pulse/${encerrada.id}/exportar').then(async r=>r.status+' '+(await r.text()).slice(0,4000))`);
  checar("Exportação CSV agregada, sem comentários livres", csv.startsWith("200") && /Toda a organização/.test(csv) && !/colaborativo/.test(csv));

  // ── 5. Gestor: somente leitura ──
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir("/pulse");
  checar("Gestor vê a lista sem criar nem rascunhos", !/Nova pesquisa/.test(e.texto) && !/Rascunho E2E/.test(e.texto) && /Clima rápido/.test(e.texto));
  e = await nav.ir(`/pulse/${encerrada.id}?tab=resultados`);
  checar("Gestor vê resultados agregados da empresa, sem ações", /11 respondente\(s\)/.test(e.texto) && !/Duplicar|Encerrar/.test(e.texto));
  e = await nav.ir("/pulse/nova");
  checar("Gestor não abre o assistente", e.url === "/pulse", e.url);

  // ── 6. Link aberto (anônima, opcional) ──
  await adm.query("update pesquisas_pulse set link_aberto=true where id=$1", [aberta.id]);
  await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/pulse/${encerrada.id}`);
  checar("Bravo (sem Pulse) é bloqueada", e.url.startsWith("/inicio?bloqueado=pulse"), e.url);
  const antes = (await um("select count(distinct lote)::int n from respostas_pulse where pesquisa_id=$1", [aberta.id])).n;
  const pAberta = (await adm.query("select id from perguntas_pulse where pesquisa_id=$1 order by ordem", [aberta.id])).rows;
  const anon = await abrirNavegador(9450);
  try {
    await anon.ir(`/pesquisa/responder/${aberta.id}`);
    await anon.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Começar').click()`);
    await anon.esperarAte("document.querySelector('[role=progressbar]')");
    await anon.avaliar(`document.querySelector('input[name="q_${pAberta[0].id}"][value="10"]').click()`);
    await esperar(200);
    await anon.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enviar respostas')).click()`);
    await anon.esperarAte("/Obrigado pela sua resposta/.test(document.body.innerText)");
    const depois = (await ateNoBanco("select count(distinct lote)::int n from respostas_pulse where pesquisa_id=$1", [aberta.id], (r) => r.n > antes)).n;
    checar("Link aberto aceita resposta anônima sem login", depois === antes + 1, `${antes}→${depois}`);
    await anon.avaliar("localStorage.clear()");
    await anon.ir(`/pesquisa/responder/${aberta.id}`);
    checar("Link aberto: mesma sessão do navegador não responde de novo (cookie)", /Você já respondeu/.test(await anon.avaliar("document.body.innerText")));
  } finally {
    anon.fechar();
    await adm.query("update pesquisas_pulse set link_aberto=false where id=$1", [aberta.id]);
  }

  // ── 7. Rotina diária: encerra vencidas e envia lembrete automático ──
  await adm.query("update pesquisas_pulse set encerra_em = current_date - 1 where id=$1", [aberta.id]);
  const r = await fetch(`${BASE}/api/cron/manutencao`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const corpo = await r.json();
  const st = await um("select status from pesquisas_pulse where id=$1", [aberta.id]);
  checar("Cron encerra pesquisa vencida", r.status === 200 && st.status === "encerrada" && corpo.pulse?.encerradas >= 1, JSON.stringify(corpo.pulse));
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
