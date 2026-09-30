// Testes E2E do Diagnóstico NR-1: privacidade e permissões no banco, cálculo por
// direção dos itens, página pública com convite de uso único, criação/ativação/envio,
// resultados protegidos, relatório/CSV, matriz, plano de ação e rotina diária.
// Uso: node journeylab/scripts/e2e/nr1.mjs   (app em localhost:3020, Supabase local com Mailpit)
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
const SEGREDO = process.env.NR1_LINK_SECRET ?? process.env.PULSE_LINK_SECRET;
const token = (id) => `${id}.${createHmac("sha256", SEGREDO).update(`nr1:${id}`).digest("base64url").slice(0, 32)}`;

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
const emails = async (f) => ((await (await fetch(`${MAILPIT}/messages?limit=200`)).json()).messages ?? []).filter(f);

// ── Preparação ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from ciclos_nr1 where tenant_id=$1", [AURORA]);
await adm.query("delete from papel_permissoes pp using papeis p where pp.papel_id=p.id and p.base='gestor' and pp.area='nr1'");
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
const encerrado = await um("select id from ciclos_nr1 where tenant_id=$1 and titulo='Fatores psicossociais · 1º semestre'", [AURORA]);
const ativo = await um("select id from ciclos_nr1 where tenant_id=$1 and titulo='Fatores psicossociais · 2º semestre'", [AURORA]);
const area = async (n) => (await um("select id from areas where tenant_id=$1 and nome=$2", [AURORA, n])).id;
const uid = async (e) => (await um("select id from usuarios where email=$1", [e])).id;
const convite = async (ciclo, email) => (await um("select v.id from convites_nr1 v join colaboradores c on c.id=v.colaborador_id where v.ciclo_id=$1 and c.email=$2", [ciclo, email])).id;
const TEC = await area("Tecnologia");
const NEG = await area("Negócios");

// ── 1. Banco ──
{
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  const sessao = async (email, escopo = "tenant") => {
    await app.query("begin");
    await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo',$3,true)", [AURORA, await uid(email), escopo]);
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
  const resumo = async (a) => (await app.query("select * from jl_resumo_nr1($1,$2)", [encerrado.id, a])).rows[0];

  await sessao("ana@aurora.test");
  checar("Banco: aplicação não lê respostas", /permission denied/.test((await falha("select * from respostas_nr1 limit 1")) ?? ""));
  checar("Banco: aplicação não lê o uso dos convites (quem respondeu)", /permission denied/.test((await falha("select * from usos_convite_nr1 limit 1")) ?? ""));
  const grava = await falha("insert into respostas_nr1 (id,tenant_id,ciclo_id,pergunta_id,lote,valor) values (gen_random_uuid(),$1,$2,(select id from perguntas_nr1 where ciclo_id=$2 limit 1),gen_random_uuid(),3)", [AURORA, ativo.id]);
  checar("Banco: aplicação não grava respostas diretamente", /permission denied/.test(grava ?? ""), grava ?? "gravou!");
  const direto = await falha("select jl_registrar_resposta_nr1($1, null, '{}'::jsonb)", [await convite(ativo.id, "carla@aurora.test")]);
  checar("Banco: registro de resposta só no escopo da plataforma (página pública)", /Operação não permitida/.test(direto ?? ""), direto ?? "aceitou!");
  const org = await resumo(null);
  checar("Banco: organização liberada (12 respostas ≥ 5)", org.liberado && org.respondentes === 12, JSON.stringify(org));
  const tec = await resumo(TEC);
  checar("Banco: Tecnologia (7, restante 5) liberado", tec.liberado && tec.respondentes === 7, JSON.stringify(tec));
  const neg = await resumo(NEG);
  checar("Banco: Negócios (3) oculto sem expor a contagem", !neg.liberado && neg.motivo === "minimo" && neg.respondentes === null, JSON.stringify(neg));
  checar("Banco: fatores de recorte oculto não saem", (await app.query("select * from jl_fatores_nr1($1,$2)", [encerrado.id, NEG])).rows.length === 0);
  // Score = round(((média ajustada − 1)/4)×100), item reverso = 6 − valor (conferido contra os dados brutos).
  const esperado = await um(
    `select round((avg(case when q.reversa then 6 - r.valor else r.valor end) - 1) / 4.0 * 100)::int s
       from respostas_nr1 r join perguntas_nr1 q on q.id=r.pergunta_id join dimensoes_nr1 d on d.id=q.dimensao_id
      where r.ciclo_id=$1 and d.fator_chave='sobrecarga'`,
    [encerrado.id],
  );
  const calc = (await app.query("select f.score from jl_fatores_nr1($1,null) f join dimensoes_nr1 d on d.id=f.dimensao_id where d.fator_chave='sobrecarga'", [encerrado.id])).rows[0];
  checar("Banco: score por fator respeita a direção (direta/reversa)", calc?.score === esperado.s && calc.score > 60, `${calc?.score} × ${esperado.s}`);
  const remoto = (await app.query("select f.respondentes from jl_fatores_nr1($1,null) f join dimensoes_nr1 d on d.id=f.dimensao_id where d.fator_chave='remoto_isolado'", [encerrado.id])).rows[0];
  checar("Banco: “prefiro não responder” não entra no fator (não vira nota 1)", remoto.respondentes === 8, String(remoto.respondentes));
  const adesao = (await app.query("select * from jl_adesao_nr1($1)", [ativo.id])).rows[0];
  checar("Banco: participação só agregada (elegíveis, convites, respostas)", adesao.elegiveis > 0 && adesao.respostas === 0 && !("colaborador_id" in adesao));
  const congelado = await falha("update perguntas_nr1 set texto='x' where ciclo_id=$1", [ativo.id]);
  checar("Banco: questionário congelado após ativar", /não pode ser alterado/.test(congelado ?? ""), congelado ?? "alterou!");
  const metodo = await falha("update ciclos_nr1 set faixas='{10,20,30,40}' where id=$1", [ativo.id]);
  checar("Banco: faixas e metodologia fixas após ativar", /ficam fixos/.test(metodo ?? ""), metodo ?? "alterou!");
  await app.query("rollback");

  await sessao("carla@aurora.test");
  checar("Banco: colaborador não obtém resultados", (await resumo(null)).motivo === "sem_permissao" && (await app.query("select * from jl_adesao_nr1($1)", [encerrado.id])).rows.length === 0);
  await app.query("rollback");
  await sessao("bruno@aurora.test");
  checar("Banco: gestor sem permissão concedida não vê resultados", (await resumo(TEC)).motivo === "sem_permissao");
  await app.query("rollback");
  await adm.query(
    "insert into papel_permissoes (id,tenant_id,papel_id,area,acao,escopo) select gen_random_uuid(),p.tenant_id,p.id,'nr1','visualizar','equipe' from papeis p where p.base='gestor' and p.tenant_id=$1 on conflict do nothing",
    [AURORA],
  );
  await sessao("bruno@aurora.test");
  const gTec = await resumo(TEC);
  const gNeg = await resumo(NEG);
  const gOrg = await resumo(null);
  checar("Banco: gestor autorizado vê só a área que lidera (Tecnologia)", gTec.liberado && gNeg.motivo === "sem_permissao" && gOrg.motivo === "sem_permissao", `${gTec.motivo}/${gNeg.motivo}/${gOrg.motivo}`);
  checar("Banco: gestor não vê participação", (await app.query("select * from jl_adesao_nr1($1)", [encerrado.id])).rows.length === 0);
  await app.query("rollback");
  await app.end();
}

const nav = await abrirNavegador(9453);
try {
  // ── 2. Página pública (sem login) ──
  const pub = await abrirNavegador(9454);
  try {
    const conv = await convite(ativo.id, "diego@aurora.test");
    let e = await pub.ir(`/nr1/responder/${token(conv)}`);
    const corpo = () => pub.avaliar("document.body.innerText");
    checar("Página pública abre sem login e explica a privacidade", /condições e a organização do trabalho/.test(await corpo()) && /sem seu nome, e-mail ou link/.test(await corpo()));
    checar("Página não exibe dados do convidado", !/Diego/.test(await corpo()));
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Começar').click()`);
    await pub.esperarAte("/Seções da pesquisa/.test(document.body.innerText)");
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Responder').click()`);
    await pub.esperarAte("document.querySelector('[role=progressbar]')");
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>/Próxima seção|Revisar/.test(b.textContent)).click()`);
    await esperar(200);
    checar("Seção exige resposta (ou “prefiro não responder”)", /restante\(s\) desta seção/.test(await pub.mensagem()));
    const secoes = (await um("select count(*)::int n from dimensoes_nr1 where ciclo_id=$1", [ativo.id])).n;
    let pulados = 0;
    for (let s = 0; s < secoes; s++) {
      // Primeira pergunta de cada seção: "prefiro não responder" na seção 1; demais: "Frequentemente" (4).
      pulados += await pub.avaliar(`(()=>{let n=0;const grupos={};for(const r of document.querySelectorAll('main input[type=radio]'))(grupos[r.name]??=[]).push(r);
        Object.values(grupos).forEach((g,i)=>{ if(${s}===0&&i===0){g.find(x=>x.value==='nao').click();n++;} else g.find(x=>x.value==='4').click(); });return n;})()`);
      await esperar(150);
      if (s === 0) checar("Rascunho temporário no dispositivo (sessionStorage)", !!(await pub.avaliar(`sessionStorage.getItem('nr1_rascunho_${conv}')`)));
      await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>/Próxima seção|Revisar/.test(b.textContent)).click()`);
      await esperar(250);
    }
    await pub.esperarAte("/Revisão/.test(document.body.innerText)");
    checar("Departamento opcional oferecido na revisão", !!(await pub.avaliar("!!document.querySelector('main select')")));
    await pub.avaliar(`(()=>{const s=document.querySelector('main select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(TEC)});s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pub.avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Enviar respostas')).click()`);
    await pub.esperarAte("/Resposta registrada/.test(document.body.innerText)");
    checar("Confirmação e limpeza do rascunho", /Resposta registrada/.test(await corpo()) && !(await pub.avaliar(`sessionStorage.getItem('nr1_rascunho_${conv}')`)));
    const perguntas = (await um("select count(*)::int n from perguntas_nr1 where ciclo_id=$1", [ativo.id])).n;
    const gravado = await um("select count(*)::int linhas, count(distinct lote)::int lotes, count(distinct area_id)::int areas, bool_and(area_id=$2) tec from respostas_nr1 where ciclo_id=$1", [ativo.id, TEC]);
    checar("Resposta gravada em lote único, sem os itens pulados, com o departamento informado", gravado.lotes === 1 && gravado.linhas === perguntas - pulados && gravado.tec, JSON.stringify({ ...gravado, perguntas, pulados }));
    const colunas = (await adm.query("select column_name from information_schema.columns where table_name='respostas_nr1'")).rows.map((r) => r.column_name);
    checar("Resposta sem pessoa, convite, e-mail ou horário", !colunas.some((c) => /colaborador|convite|email|usuario|criado|_em$/.test(c)), colunas.join(","));
    checar("Uso do convite registrado sem data", (await um("select count(*)::int n from usos_convite_nr1 where ciclo_id=$1", [ativo.id])).n === 1 && !(await adm.query("select column_name from information_schema.columns where table_name='usos_convite_nr1'")).rows.some((r) => /_em$|data/.test(r.column_name)));
    await pub.avaliar("sessionStorage.clear(); localStorage.clear()");
    await pub.ir(`/nr1/responder/${token(conv)}`);
    checar("Reenvio recusado pelo servidor (mesmo sem dados locais)", /já foi utilizado/.test(await corpo()));
    await pub.ir(`/nr1/responder/${conv}.${"x".repeat(32)}`);
    checar("Link adulterado é inválido", /Link inválido/.test(await corpo()));
    await pub.ir(`/nr1/responder/${token(await convite(encerrado.id, "diego@aurora.test"))}`);
    checar("Pesquisa encerrada recusa respostas", /Pesquisa encerrada/.test(await corpo()));
  } finally {
    pub.fechar();
  }

  // ── 3. RH: criar (personalizado), revisar, ativar e enviar ──
  let e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/nr1?action=create");
  checar("?action=create abre a criação", e.url === "/nr1/novo", e.url);
  await nav.preencher({ "main input[maxlength='120']": "NR-1 E2E personalizado" });
  await nav.avaliar(`[...document.querySelectorAll('input[name=tipo]')][2].click()`);
  await esperar(200);
  await nav.avaliar(`[...document.querySelectorAll('main input[type=checkbox]')].slice(0,6).forEach(c=>c.click())`);
  await nav.avaliar(`[...document.querySelectorAll('input[name=audiencia]')][2].click()`);
  await esperar(200);
  for (const n of ["Carla Mendes", "Diego Ferreira"]) await nav.avaliar(`[...document.querySelectorAll('main label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(n)})).querySelector('input').click()`);
  await esperar(200);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Criar rascunho')).click()`);
  await nav.esperarAte("/\\/nr1\\/[0-9a-f-]{36}$/.test(location.pathname)", 20000);
  const novo = await um("select id, status, tipo, (select count(*)::int from perguntas_nr1 q where q.ciclo_id=c.id) n from ciclos_nr1 c where titulo='NR-1 E2E personalizado'");
  checar("Rascunho personalizado com as perguntas escolhidas", novo?.status === "rascunho" && novo.tipo === "personalizado" && novo.n === 6, JSON.stringify(novo));
  await nav.esperarAte("[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Ativar e enviar'))", 30000);
  e = await nav.estado();
  checar("Revisão mostra direção de cada item e aviso de biblioteca não oficial", /reversa|direta/.test(e.texto) && /não é questionário oficial do MTE/.test(e.texto));
  await nav.avaliar(`window.confirm=()=>true;[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Ativar e enviar')).click()`);
  const at = await ateNoBanco("select status, publico_total, (select count(*)::int from convites_nr1 v where v.ciclo_id=c.id and v.enviado_em is not null) enviados, escala is not null escala from ciclos_nr1 c where id=$1", [novo.id], (r) => r.enviados === 2);
  checar("Ativação congela escala e cria/envia 2 convites", at.status === "aberto" && at.publico_total === 2 && at.enviados === 2 && at.escala, JSON.stringify(at));
  await esperar(1000);
  const mails = await emails((m) => /NR-1 E2E personalizado/.test(m.Subject) && !/Lembrete/.test(m.Subject));
  checar("E-mails de convite enviados (2)", mails.length === 2);
  if (mails[0]) {
    const html = (await (await fetch(`${MAILPIT}/message/${mails[0].ID}`)).json()).HTML ?? "";
    const link = (html.match(/\/nr1\/responder\/[^"]+/) ?? [""])[0];
    checar("Convite com prazo/privacidade e link sem dados do destinatário", /sem seu nome, e-mail ou link/.test(html) && !!link && !/@|carla|diego/i.test(decodeURIComponent(link)), link);
  }
  e = await nav.ir(`/nr1/${novo.id}/editar`);
  checar("Edição bloqueada após ativar", e.url === `/nr1/${novo.id}`, e.url);
  const antesConv = await um("select string_agg(coalesce(enviado_em::text,'') || coalesce(erro,''), '|' order by id) s from convites_nr1 where ciclo_id=$1", [novo.id]);
  await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
  e = await nav.ir(`/nr1/${novo.id}?tab=convites`);
  await nav.avaliar(`window.confirm=()=>true;[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Enviar lembrete')).click()`);
  await ateNoBanco("select lembrete_em from ciclos_nr1 where id=$1", [novo.id], (r) => !!r.lembrete_em);
  await esperar(1500);
  const depoisConv = await um("select string_agg(coalesce(enviado_em::text,'') || coalesce(erro,''), '|' order by id) s from convites_nr1 where ciclo_id=$1", [novo.id]);
  checar("Lembrete não registra nada por pessoa (convites inalterados)", antesConv.s === depoisConv.s);
  checar("Lembrete enviado a quem não usou o convite", (await emails((m) => /^Lembrete: NR-1 E2E personalizado/.test(m.Subject))).length === 2);
  e = await nav.ir(`/nr1/${novo.id}`);
  checar("Tela diferencia elegíveis, convites enviados e respostas; não diz quem respondeu", /Pessoas elegíveis/.test(e.texto) && /Convites enviados/.test(e.texto) && /Respostas recebidas/.test(e.texto) && /não registra quais pessoas responderam/.test(e.texto));
  await nav.avaliar(`window.confirm=()=>true;[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Encerrar').click()`);
  await ateNoBanco("select status from ciclos_nr1 where id=$1", [novo.id], (r) => r.status === "encerrado");
  e = await nav.ir(`/nr1/${novo.id}`);
  checar("Sem respostas suficientes: “Dados insuficientes para exibição segura”", /Dados insuficientes para exibição segura/.test(e.texto) && !/Score indicativo geral da pesquisa/.test(e.texto));

  // ── 4. Resultados do diagnóstico encerrado ──
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("Visão geral: score indicativo, amostra e aviso de não ser avaliação técnica", /Score indicativo geral/.test(e.texto) && /Amostra: 12/.test(e.texto) && /não é avaliação técnica/.test(e.texto));
  checar("Scores por fator com faixa textual", /Sobrecarga de trabalho/.test(e.texto) && /Exposição (muito )?elevada/.test(e.texto));
  e = await nav.ir(`/nr1/${encerrado.id}?tab=departamentos`);
  const tabela = await nav.avaliar("document.querySelector('main table')?.innerText ?? ''");
  checar("Departamentos: Tecnologia com valores, Negócios oculto", /Tecnologia/.test(tabela) && /amostra 7/.test(tabela) && !/amostra 3/.test(tabela) && /—/.test(tabela));
  e = await nav.ir(`/nr1/${encerrado.id}?tab=matriz`);
  checar("Matriz indicativa identificada como não oficial", /Matriz indicativa da pesquisa/.test(e.texto) && /Não é a matriz de risco oficial/.test(e.texto));
  await nav.avaliar(`(()=>{const s=document.querySelector('select[aria-label="Severidade de Subcarga de trabalho"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'2');s.dispatchEvent(new Event('change',{bubbles:true}));s.form.requestSubmit();})()`);
  const rev = await ateNoBanco("select matriz_revisada_por, (select severidade from dimensoes_nr1 where ciclo_id=$1 and fator_chave='subcarga') sev from ciclos_nr1 where id=$1", [encerrado.id], (r) => !!r.matriz_revisada_por);
  checar("Revisão da matriz registrada com autor (severidade editável após encerrar)", rev.matriz_revisada_por === "Rafael Lima" && rev.sev === 2, JSON.stringify(rev));
  e = await nav.ir(`/nr1/${encerrado.id}?tab=plano`);
  checar("IA indisponível sem configuração; análise manual segue disponível", /integração não está configurada/.test(e.texto) && /Registrar fator priorizado/.test(e.texto));
  await nav.preencher({ "input[name=tituloRisco]": "Clareza de papéis nas squads (E2E)" });
  await nav.avaliar(`document.querySelector('input[name=tituloRisco]').form.requestSubmit()`);
  const risco = await ateNoBanco("select id, origem, revisado_por from riscos_nr1 where titulo='Clareza de papéis nas squads (E2E)'", [], (r) => !!r);
  checar("Fator priorizado registrado com origem humana e revisor", risco?.origem === "humano" && risco.revisado_por === "Rafael Lima");
  const acao = await um("select a.id, a.titulo from acoes_nr1 a join riscos_nr1 r on r.id=a.risco_id where r.ciclo_id=$1 and a.status='pendente' limit 1", [encerrado.id]);
  e = await nav.ir(`/nr1/${encerrado.id}?tab=plano`);
  const form = `form[aria-label="Atualizar ${acao.titulo}"]`;
  await nav.avaliar(`(()=>{const s=document.querySelector('${form} select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'concluida');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await esperar(200);
  await nav.avaliar(`document.querySelector('${form}').requestSubmit()`);
  await esperar(2500);
  checar("Concluir ação exige evidência", (await um("select status from acoes_nr1 where id=$1", [acao.id])).status === "pendente");
  await nav.avaliar(`(()=>{const i=document.querySelector('${form} input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Ata da rodada de escuta (E2E)');i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('${form}').requestSubmit();})()`);
  const concl = await ateNoBanco("select status, evidencia from acoes_nr1 where id=$1", [acao.id], (r) => r.status === "concluida");
  checar("Ação concluída com evidência de acompanhamento", concl.status === "concluida" && /Ata/.test(concl.evidencia));
  const csv = await nav.avaliar(`fetch('/nr1/${encerrado.id}/exportar').then(async r=>r.status+' '+(await r.text()))`);
  checar("CSV: agregados + plano, Negócios oculto, sem linhas individuais", csv.startsWith("200") && /Toda a organização/.test(csv) && /Tecnologia/.test(csv) && /Negócios[^\n]*Dados insuficientes/.test(csv) && /Revisado por/.test(csv) && !/lote|colaborador_id/.test(csv));
  e = await nav.ir(`/nr1/${encerrado.id}/relatorio`);
  checar("Relatório PDF: período, metodologia, amostra, limitações e status de revisão", /Método de pontuação/.test(e.texto) && /Respostas consideradas: 12/.test(e.texto) && /Limitações de interpretação/.test(e.texto) && /revisão humana registrada/.test(e.texto) && /Salvar como PDF/.test(e.texto));

  // ── 5. Gestor autorizado, colaborador e outra empresa ──
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("Gestor autorizado vê só a aba de departamentos, com sua área", /Tecnologia/.test(e.texto) && !/Negócios/.test(e.texto) && !/Plano de ação/.test(e.texto) && !/Respostas recebidas/.test(e.texto), e.texto.slice(0, 200));
  e = await nav.ir("/nr1");
  checar("Gestor não vê rascunhos/ativos nem cria", !/2º semestre/.test(e.texto) && !/Novo diagnóstico/.test(e.texto));
  await adm.query("delete from papel_permissoes pp using papeis p where pp.papel_id=p.id and p.base='gestor' and pp.area='nr1'");
  e = await nav.entrar("carla@aurora.test");
  checar("Colaborador vê no Início o link público da pesquisa ativa", /Pesquisa sobre condições de trabalho/.test(e.texto) && !!(await nav.avaliar("!!document.querySelector('a[href*=\"/nr1/responder/\"]')")));
  e = await nav.ir("/nr1");
  checar("Colaborador não acessa o módulo interno", e.url.startsWith("/inicio?sem_permissao=nr1"), e.url);
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("Empresa sem o produto é bloqueada", e.url.startsWith("/inicio?bloqueado=nr1"), e.url);

  // ── 6. Rotina diária: encerra na data prevista ──
  await adm.query("update ciclos_nr1 set data_inicio = current_date - 2, encerra_em = current_date - 1 where id=$1", [ativo.id]);
  const r = await (await fetch(`${BASE}/api/cron/manutencao`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).json();
  checar("Cron encerra diagnóstico vencido", r.nr1?.encerrados >= 1 && (await um("select status from ciclos_nr1 where id=$1", [ativo.id])).status === "encerrado", JSON.stringify(r.nr1));
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
