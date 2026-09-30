// Testes E2E do PDI: permissões e isolamento no banco (RLS), regra de progresso/status,
// fluxo guiado, detalhe, Kanban/Dashboard, ponte Feedback 1:1 (escala 1–5) e Onboarding.
// Uso: node journeylab/scripts/e2e/pdi.mjs   (app em localhost:3020)
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador } from "./navegador.mjs";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ── Preparação: PDIs da Aurora voltam ao estado do seed ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
const BRAVO = (await um("select id from organizacoes where slug='bravo-logistica'"))?.id;
await adm.query("delete from pdis where tenant_id=$1", [AURORA]);
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
const uid = async (e) => (await um("select id from usuarios where email=$1", [e])).id;
const colab = async (e) => (await um("select id from colaboradores where tenant_id=$1 and email=$2", [AURORA, e])).id;
const pdiDe = async (e) => (await um("select p.id from pdis p join colaboradores c on c.id=p.colaborador_id where c.email=$1 order by p.criado_em desc limit 1", [e]))?.id;
const pdiDiego = await pdiDe("diego@aurora.test");
const pdiCarla = await pdiDe("carla@aurora.test");

// ── 1. Banco: papel da aplicação (RLS) ──
{
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  const sessao = async (email, tenant = AURORA) => {
    await app.query("begin");
    await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo','tenant',true)", [tenant, await uid(email)]);
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
  const n = async (sql, p = []) => (await app.query(sql, p)).rows[0].n;

  await sessao("rafael@aurora.test");
  checar("Banco: RH lê todos os PDIs da empresa", (await n("select count(*)::int n from pdis")) === 3);
  await app.query("rollback");

  await sessao("bruno@aurora.test");
  const visiveis = await n("select count(*)::int n from pdis");
  checar("Banco: gestor lê só PDIs de liderados diretos", visiveis === 3);
  const marina = await colab("marina@aurora.test");
  const fora = await falha("insert into pdis (id,tenant_id,colaborador_id,titulo,inicio,fim,criado_por,atualizado_em) values (gen_random_uuid(),$1,$2,'X',current_date,current_date+30,'t',now())", [AURORA, marina]);
  checar("Banco: gestor não cria PDI para quem não é liderado", /row-level security/.test(fora ?? ""), fora ?? "criou!");
  const proprio = await falha("insert into pdis (id,tenant_id,colaborador_id,titulo,inicio,fim,criado_por,atualizado_em) values (gen_random_uuid(),$1,$2,'X',current_date,current_date+30,'t',now())", [AURORA, await colab("bruno@aurora.test")]);
  checar("Banco: gestor não cria PDI para si mesmo", /row-level security/.test(proprio ?? ""), proprio ?? "criou!");
  const apagou = (await app.query("delete from pdis where id=$1", [pdiDiego])).rowCount;
  checar("Banco: gestor não exclui PDI (só RH/Admin)", apagou === 0);
  await app.query("rollback");

  await sessao("carla@aurora.test");
  checar("Banco: colaborador não lê PDIs (nem o próprio)", (await n("select count(*)::int n from pdis")) === 0 && (await n("select count(*)::int n from acoes_pdi")) === 0);
  await app.query("rollback");

  if (BRAVO) {
    await sessao("helena@bravo.test", BRAVO);
    checar("Banco: outra empresa não lê PDIs da Aurora", (await n("select count(*)::int n from pdis")) === 0);
    const cruzado = await falha("insert into pdis (id,tenant_id,colaborador_id,titulo,inicio,fim,criado_por,atualizado_em) values (gen_random_uuid(),$1,$2,'X',current_date,current_date+30,'t',now())", [BRAVO, marina]);
    checar("Banco: não cria PDI com colaborador de outra empresa", /row-level security/.test(cruzado ?? ""), cruzado ?? "criou!");
    await app.query("rollback");
  }

  // Módulo suspenso: nenhum acesso, nem para o RH.
  await adm.query("update entitlements set status='suspenso' where tenant_id=$1 and modulo='pdi'", [AURORA]);
  try {
    await sessao("rafael@aurora.test");
    checar("Banco: módulo PDI suspenso bloqueia leitura", (await n("select count(*)::int n from pdis")) === 0);
    await app.query("rollback");
  } finally {
    await adm.query("update entitlements set status='ativo' where tenant_id=$1 and modulo='pdi'", [AURORA]);
  }

  // Normalização status × progresso (trigger) e foco de outro plano.
  const acao = await um("select a.id, a.foco_id from acoes_pdi a where a.pdi_id=$1 order by a.criado_em limit 1", [pdiDiego]);
  await sessao("rafael@aurora.test");
  await app.query("update acoes_pdi set status='concluida', progresso=40 where id=$1", [acao.id]);
  const concl = (await app.query("select progresso from acoes_pdi where id=$1", [acao.id])).rows[0].progresso;
  await app.query("update acoes_pdi set status='nao_iniciada', progresso=70 where id=$1", [acao.id]);
  const naoIni = (await app.query("select progresso from acoes_pdi where id=$1", [acao.id])).rows[0].progresso;
  await app.query("update acoes_pdi set status='em_andamento', progresso=100 where id=$1", [acao.id]);
  const andamento = (await app.query("select progresso from acoes_pdi where id=$1", [acao.id])).rows[0].progresso;
  checar("Banco: concluída = 100%, não iniciada sem progresso, em andamento só 1–99", concl === 100 && naoIni === null && andamento === null, `${concl}/${naoIni}/${andamento}`);
  const focoAlheio = (await app.query("select id from focos_pdi where pdi_id=$1 limit 1", [pdiCarla])).rows[0].id;
  const troca = await falha("update acoes_pdi set foco_id=$2 where id=$1", [acao.id, focoAlheio]);
  checar("Banco: ação não pode apontar para foco de outro PDI", /não pertence/.test(troca ?? ""), troca ?? "aceitou!");
  const outro = await falha("insert into focos_pdi (id,tenant_id,pdi_id,foco_chave) values (gen_random_uuid(),$1,$2,'outro')", [AURORA, pdiDiego]);
  checar("Banco: foco “Outro” exige nome", /focos_pdi_outro_com_nome/.test(outro ?? ""), outro ?? "aceitou!");
  await app.query("rollback");
  await app.end();
}

const nav = await abrirNavegador(9452);
try {
  // ── 2. RH: lista, Kanban, Dashboard ──
  let e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/pdi");
  checar("Lista: indicadores por status calculado", /Em risco\s*1/.test(e.texto) && /Em andamento\s*1/.test(e.texto) && /Concluídos\s*1/.test(e.texto), e.texto.slice(0, 250));
  checar("Lista: atenção mostra ação vencida", /Leitura: Getting Things Done/.test(e.texto) && /venceu em/.test(e.texto));
  e = await nav.ir("/pdi?tab=kanban");
  const colunas = await nav.avaliar("[...document.querySelectorAll('main section[aria-labelledby^=col-] h2')].map(h=>h.textContent.replace(/\\d+/g,'').trim()).join('|')");
  checar("Kanban: colunas Em risco → Em andamento → Concluído", colunas === "Em risco|Em andamento|Concluído", colunas);
  checar("Kanban não permite arrastar (sem draggable)", !(await nav.avaliar("!!document.querySelector('main [draggable=true]')")));
  e = await nav.ir("/pdi?tab=dashboard");
  checar("Dashboard: investimento estimado em BRL", /R\$\s?3\.369,90/.test(e.texto), (e.texto.match(/Investimento estimado total: [^\n]+/) ?? [""])[0]);
  e = await nav.ir("/pdi?q=carla");
  checar("Busca por colaborador", /Carla Mendes/.test(e.texto) && !/Diego Ferreira/.test(e.texto));

  // ── 3. Onboarding → PDI (sugestão, sem criação automática) ──
  const onbMarina = await um("select o.id from onboardings o join colaboradores c on c.id=o.colaborador_id where c.email='marina@aurora.test'");
  const antes = (await um("select count(*)::int n from pdis where tenant_id=$1", [AURORA])).n;
  e = await nav.ir(`/onboarding/${onbMarina.id}`);
  checar("Onboarding concluído sugere PDI", /Próximo passo: PDI/.test(e.texto) && /Sugerir PDI/.test(e.texto));
  e = await nav.ir("/pdi?action=create&origem=onboarding&onboarding=" + onbMarina.id);
  checar("?action=create abre o fluxo pré-preenchido pelo onboarding", e.url.startsWith("/pdi/novo") && (await nav.avaliar("document.querySelector('main select').selectedOptions[0].textContent")).startsWith("Marina Costa"), e.url);
  checar("Nada é criado antes da confirmação", (await um("select count(*)::int n from pdis where tenant_id=$1", [AURORA])).n === antes);

  // ── 4. Fluxo guiado: criar PDI para Marina ──
  const clicar = (texto) => nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(texto)}).click()`);
  await nav.preencher({ "main input[maxlength='120']": "PDI E2E Marina" });
  await clicar("Continuar");
  await nav.esperarAte("/Focos de desenvolvimento/.test(document.querySelector('main').innerText)");
  await clicar("Continuar");
  await esperar(300);
  checar("Etapa 2 exige ao menos um foco", /ao menos um foco/.test(await nav.mensagem()));
  await nav.avaliar(`[...document.querySelectorAll('main label')].find(l=>l.textContent.trim()==='Negociação').querySelector('input').click()`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Outro').click()`);
  await esperar(200);
  await nav.preencher({ "main input[placeholder='Ex.: Oratória']": "Oratória" });
  await clicar("Continuar");
  await nav.esperarAte("/Por que desenvolver/.test(document.querySelector('main').innerText)");
  await nav.avaliar(`(()=>{const t=[...document.querySelectorAll('main textarea')];const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};set(t[1],'Negociações com clientes-chave');set(t[2],'Conduzir negociações com segurança e preparo.');})()`);
  await clicar("Continuar");
  await nav.esperarAte("/Adicionar ação/.test(document.querySelector('main').innerText)");
  for (let i = 0; i < 2; i++) await nav.avaliar(`[...document.querySelectorAll('main button')].filter(b=>b.textContent.includes('Adicionar ação'))[${i}].click()`);
  await esperar(300);
  const acoesPreencher = async (i, descricao, tipo, resp, prazo, invest) => {
    await nav.avaliar(`(()=>{const li=document.querySelectorAll('main li[aria-label^="Ação"]')[${i}];
      const set=(el,v)=>{const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
      const inputs=li.querySelectorAll('input');const selects=li.querySelectorAll('select');
      set(inputs[0],${JSON.stringify(descricao)});set(selects[0],${JSON.stringify(tipo)});set(selects[1],${JSON.stringify(resp)});
      if(${JSON.stringify(prazo)})set(inputs[2],${JSON.stringify(prazo)});set(inputs[3],${JSON.stringify(invest)});})()`);
  };
  const daqui = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  await acoesPreencher(0, "Curso de negociação avançada", "treinamento", "colaborador", "", "1.500,50");
  await acoesPreencher(1, "Apresentar para a diretoria", "projeto_pratico", "ambos", daqui(20), "");
  await clicar("Continuar");
  await esperar(300);
  checar("Etapa 4 exige prazo da ação", /prazo da ação/.test(await nav.mensagem()), await nav.mensagem());
  await acoesPreencher(0, "Curso de negociação avançada", "treinamento", "colaborador", daqui(30), "1.500,50");
  await clicar("Continuar");
  await nav.esperarAte("/Investimento estimado total/.test(document.querySelector('main').innerText)");
  e = await nav.estado();
  checar("Revisão mostra investimento em BRL e aviso de estimativa", /R\$\s?1\.500,50/.test(e.texto) && /estimativas/.test(e.texto));
  await clicar("Confirmar e criar PDI");
  await nav.esperarAte("/\\/pdi\\/[0-9a-f-]{36}$/.test(location.pathname)", 30000);
  const novo = await um(
    "select p.id, (select count(*)::int from focos_pdi f where f.pdi_id=p.id) focos, (select count(*)::int from acoes_pdi a where a.pdi_id=p.id) acoes, (select sum(investimento)::text from acoes_pdi a where a.pdi_id=p.id) inv, (select nome_personalizado from focos_pdi f where f.pdi_id=p.id and foco_chave='outro') outro from pdis p where titulo='PDI E2E Marina'",
  );
  checar("PDI criado com 2 focos, 2 ações e investimento exato", novo?.focos === 2 && novo.acoes === 2 && novo.inv === "1500.50" && novo.outro === "Oratória", JSON.stringify(novo));
  const auditoria = await um("select detalhes from auditoria where entidade_id=$1 and acao='pdi.criar'", [novo.id]);
  checar("Criação auditada com a origem (onboarding)", auditoria?.detalhes?.origem === "onboarding");
  e = await nav.ir(`/pdi/${novo.id}`);
  checar("Detalhe: plano novo em andamento, 0%, investimento total em BRL", /Em andamento/.test(e.texto) && /Progresso\s*0%/.test(e.texto) && /R\$\s?1\.500,50/.test(e.texto), e.texto.slice(0, 300));
  // Plano incompleto: foco sem ações não deixa concluir.
  const focoVazio = await um("insert into focos_pdi (id,tenant_id,pdi_id,foco_chave,ordem) values (gen_random_uuid(),$1,$2,'delegacao',9) returning id", [AURORA, novo.id]);
  e = await nav.ir(`/pdi/${novo.id}`);
  checar("Foco sem ações deixa o plano incompleto", /Há foco\(s\) sem ações/.test(e.texto));
  await adm.query("delete from focos_pdi where id=$1", [focoVazio.id]);

  // ── 5. Detalhe: atualizar ações e comentar ──
  const acoesNovo = (await adm.query("select id, descricao from acoes_pdi where pdi_id=$1 order by descricao", [novo.id])).rows;
  const curso = acoesNovo.find((a) => a.descricao.startsWith("Curso")).id;
  const salvarAcao = async (id, status, progresso) => {
    await nav.avaliar(`(()=>{const f=document.querySelector('form[aria-label="Atualizar Curso de negociação avançada"]');const s=f.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(status)});s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await esperar(200);
    if (progresso !== null)
      await nav.avaliar(`(()=>{const i=document.querySelector('form[aria-label="Atualizar Curso de negociação avançada"] input[name=progresso]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'${progresso}');i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await esperar(200);
    await nav.avaliar(`document.querySelector('form[aria-label="Atualizar Curso de negociação avançada"]').requestSubmit()`);
  };
  await salvarAcao(curso, "em_andamento", 40);
  const p40 = await ateNoBanco("select status, progresso from acoes_pdi where id=$1", [curso], (r) => r.progresso === 40);
  checar("Ação em andamento com progresso explícito (40%)", p40.status === "em_andamento" && p40.progresso === 40, JSON.stringify(p40));
  await nav.ir(`/pdi/${novo.id}`);
  await salvarAcao(curso, "em_andamento", 100);
  const p100 = await ateNoBanco("select status, progresso from acoes_pdi where id=$1", [curso], (r) => r.status === "concluida");
  checar("Progresso 100% conclui a ação", p100.status === "concluida" && p100.progresso === 100, JSON.stringify(p100));
  e = await nav.ir(`/pdi/${novo.id}`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Comentar').click()`);
  await esperar(200);
  await nav.avaliar(`(()=>{const r=[...document.querySelectorAll('main input[type=radio]')].find(x=>x.parentElement.textContent.includes('Registrar fala'));r.click();const t=document.querySelector('main textarea[aria-label=Comentário]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Quero praticar com casos reais.');t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await esperar(200);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Registrar' && b.closest('form').querySelector('textarea[aria-label=Comentário]')).click()`);
  const com = await ateNoBanco("select tipo, autor_nome from comentarios_acao_pdi where pdi_id=$1", [novo.id], (r) => !!r);
  e = await nav.ir(`/pdi/${novo.id}`);
  checar("Fala do colaborador registrada identificando quem registrou", com?.tipo === "fala_colaborador" && /Fala de Marina Costa, registrada por Rafael Lima/.test(e.texto), JSON.stringify(com));

  // ── 6. Edição: remover foco sem ações, concluir a outra ação → PDI concluído ──
  e = await nav.ir(`/pdi/${novo.id}/editar`);
  await nav.avaliar(`window.confirm=()=>true`);
  await clicar("Continuar");
  await nav.esperarAte("/Focos de desenvolvimento/.test(document.querySelector('main').innerText)");
  await nav.avaliar(`document.querySelector('main button[aria-label^="Remover foco personalizado"]').click()`);
  for (let i = 0; i < 3; i++) {
    await clicar("Continuar");
    await esperar(400);
  }
  await nav.esperarAte("/Salvar alterações/.test(document.querySelector('main').innerText)");
  await clicar("Salvar alterações");
  await nav.esperarAte("!location.pathname.endsWith('/editar')", 20000);
  const depois = await ateNoBanco("select (select count(*)::int from focos_pdi f where f.pdi_id=$1) focos, (select count(*)::int from acoes_pdi a where a.pdi_id=$1) acoes, (select status from acoes_pdi where id=$2) st", [novo.id, curso], (r) => r.focos === 1);
  checar("Edição remove foco (e suas ações) preservando status das demais", depois.focos === 1 && depois.acoes === 1 && depois.st === "concluida", JSON.stringify(depois));
  e = await nav.ir("/pdi?q=marina");
  checar("Todas as ações concluídas → PDI Concluído (100%)", /Concluído/.test(e.texto) && /100%/.test(e.texto), e.texto.slice(0, 400));

  // Ação vencida → Em risco (lista e detalhe).
  await adm.query("update acoes_pdi set status='nao_iniciada', prazo=current_date-1, inicio=null where id=$1", [curso]);
  e = await nav.ir(`/pdi/${novo.id}`);
  checar("Ação vencida coloca o PDI em risco e mostra alerta", /Em risco/.test(e.texto) && /ação\(ões\) vencida\(s\)/.test(e.texto));
  const csv = await nav.avaliar(`fetch('/pdi/exportar?pdi=${novo.id}').then(async r=>r.status+' '+(await r.text()))`);
  checar("Exportação CSV com status calculado", csv.startsWith("200") && /Em risco/.test(csv) && /Curso de negociação avançada/.test(csv));

  // Excluir (RH) com confirmação.
  await nav.avaliar(`window.confirm=()=>true; [...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Excluir').click()`);
  const excl = await ateNoBanco("select count(*)::int n from pdis where id=$1", [novo.id], (r) => r.n === 0);
  checar("RH exclui PDI com confirmação", excl.n === 0);

  // ── 7. Ponte Feedback 1:1 → PDI (escala 1–5) ──
  const av = await um("select a.id from avaliacoes_feedback a join colaboradores c on c.id=a.colaborador_id where c.email='diego@aurora.test' order by a.data desc limit 1");
  e = await nav.ir(`/feedback/avaliacoes/${av.id}`);
  const sug = await nav.avaliar("[...document.querySelectorAll('main input[name=foco]')].map(i=>i.value).join(',')");
  checar("Sugestões: notas 1 primeiro, sem repetição, no máximo 3", sug === "tomada_decisao,visao_negocio,produtividade", sug);
  const prioridades = await nav.avaliar("document.querySelector('main #pdi')?.closest('section')?.textContent ?? ''");
  checar("Nota 1 = prioridade crítica; nota 2 = atenção", /Prioridade crítica/.test(prioridades) && /Prioridade de atenção/.test(prioridades));
  const pdisAntes = (await um("select count(*)::int n from pdis where tenant_id=$1", [AURORA])).n;
  await nav.avaliar(`document.querySelector('main input[name=foco][value=produtividade]').click(); document.querySelector('main input[name=foco]').form.requestSubmit()`);
  await nav.esperarAte("location.pathname==='/pdi/novo'");
  await nav.esperarEstavel();
  checar("Prévia não grava nada", (await um("select count(*)::int n from pdis where tenant_id=$1", [AURORA])).n === pdisAntes);
  await clicar("Continuar");
  await nav.esperarAte("/Focos de desenvolvimento/.test(document.querySelector('main').innerText)");
  const marcados = await nav.avaliar("[...document.querySelectorAll('main label input[type=checkbox]:checked')].map(i=>i.parentElement.textContent.trim()).join('|')");
  checar("Fluxo pré-preenchido só com os focos mantidos na prévia", marcados === "Visão de negócio|Tomada de decisão" || marcados === "Tomada de decisão|Visão de negócio", marcados);
  await clicar("Continuar");
  await nav.esperarAte("/Por que desenvolver/.test(document.querySelector('main').innerText)");
  const objetivos = await nav.avaliar("[...document.querySelectorAll('main textarea')].map(t=>t.value).join(' || ')");
  checar("Objetivo editável e comportamental (sem meta de nota)", /Priorizar demandas pelo impacto/.test(objetivos) && !/nota\s*[5-9]|atingir nota/i.test(objetivos.replace(/nota \d de 5/g, "")), objetivos.slice(0, 200));

  // ── 8. Gestor: só liderados, sem excluir ──
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir("/pdi");
  checar("Gestor vê PDIs dos liderados", /Diego Ferreira/.test(e.texto) && /Carla Mendes/.test(e.texto));
  e = await nav.ir(`/pdi/${pdiDiego}`);
  checar("Gestor gerencia ações do liderado, sem excluir o plano", !!(await nav.avaliar("!!document.querySelector('form[aria-label^=Atualizar]')")) && !/Excluir/.test(e.texto));
  e = await nav.ir("/pdi/novo");
  const opcoes = await nav.avaliar("[...document.querySelectorAll('main select option')].map(o=>o.textContent).join('|')");
  checar("Gestor só seleciona liderados diretos", /Diego Ferreira/.test(opcoes) && !/Marina Costa/.test(opcoes) && !/Bruno Martins/.test(opcoes), opcoes.slice(0, 160));

  // ── 9. Colaborador e outra empresa ──
  e = await nav.entrar("carla@aurora.test");
  checar("Colaborador não vê PDI no menu", !(await nav.avaliar("!!document.querySelector('nav a[href=\"/pdi\"]')")));
  e = await nav.ir(`/pdi/${pdiCarla}`);
  checar("Colaborador não acessa o módulo (nem o próprio PDI)", e.url.startsWith("/inicio?sem_permissao=pdi"), e.url);
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/pdi/${pdiCarla}`);
  checar("Empresa sem PDI contratado é bloqueada", e.url.startsWith("/inicio?bloqueado=pdi"), e.url);
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
