// Testes E2E: menu por jornada, Colaboradores (importação), Pipeline de Vagas,
// Offboarding (registro + entrevista pública de uso único), Retenção (risco e ações),
// People Analytics (indicadores, filtros, referências, exportação), permissões e isolamento.
// Uso: node journeylab/scripts/e2e/turnover-analytics.mjs   (app em localhost:3020, Supabase local com Mailpit)
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador } from "./navegador.mjs";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const MAILPIT = "http://127.0.0.1:54524/api/v1";

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}
async function ateNoBanco(sql, p, cond, ms = 15000) {
  const fim = Date.now() + ms;
  let r;
  while (Date.now() < fim) {
    r = await um(sql, p);
    if (r && cond(r)) return r;
    await esperar(400);
  }
  return r ?? {};
}

const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
const sufixo = Date.now().toString(36);
const emailSaida = `saida.${sufixo}@exemplo.test`;
const bruno = await um("select id from colaboradores where tenant_id=$1 and email='bruno@aurora.test'", [AURORA]);
const produto = await um("select id from equipes where tenant_id=$1 and nome='Produto'", [AURORA]);
const elisa = await um("select id from colaboradores where tenant_id=$1 and email='elisa@aurora.test'", [AURORA]);
// Pessoa nova para o fluxo de desligamento (removida ao final).
const saindo = await um(
  "insert into colaboradores (id, tenant_id, nome, email, cargo, equipe_id, gestor_id, status, data_admissao, atualizado_em) values (gen_random_uuid(), $1, $2, $3, 'Analista E2E', $4, $5, 'ativo', current_date - 200, now()) returning id",
  [AURORA, `Vitória Saída ${sufixo}`, `vitoria.${sufixo}@aurora.test`, produto.id, bruno.id],
);
const vagaExec = await um("select id, etapa_pipeline, status, publicada from vagas where tenant_id=$1 and titulo like 'Executivo(a) de Contas%' limit 1", [AURORA]);
const configAntes = await um("select referencias from configuracoes_analytics where tenant_id=$1", [AURORA]);

const nav = await abrirNavegador(9461);
try {
  let e = await nav.entrar("ana@aurora.test");

  // ── 1. Menu por jornada ──
  const grupos = await nav.avaliar("[...document.querySelectorAll('nav[aria-label=\"Navegação principal\"] > div')].map(g=>g.querySelector('p')?.textContent??'').filter(Boolean).join('|')");
  checar("Menu em grupos da jornada", grupos === "Atração e Seleção|Desenvolvimento|Saúde do Colaborador|Turnover|People Analytics|Organização", grupos);
  const itens = await nav.avaliar("[...document.querySelectorAll('nav[aria-label=\"Navegação principal\"] a')].map(a=>a.getAttribute('href')).join(' ')");
  checar(
    "Itens: Pipeline de Vagas, Colaboradores, Offboarding, Retenção e People Analytics",
    ["/pipeline-vagas", "/colaboradores", "/offboarding", "/retencao", "/people-analytics"].every((h) => itens.includes(h)) && !itens.includes("/pessoas"),
    itens,
  );
  checar("“Produtos” não aparece mais no menu", !(await nav.avaliar("document.querySelector('nav[aria-label=\"Navegação principal\"]').innerText.includes('Produtos')")));
  e = await nav.ir("/pessoas");
  checar("Endereço antigo /pessoas leva a /colaboradores", e.url.startsWith("/colaboradores"), e.url);

  // ── 2. Colaboradores: base e importação CSV ──
  e = await nav.ir("/colaboradores");
  checar("Colaboradores com indicadores e importação", /Ativos/.test(e.texto) && /Tempo médio de casa/.test(e.texto) && /Importar CSV/.test(e.texto));
  const csv = join(tmpdir(), `colab-${sufixo}.csv`);
  writeFileSync(
    csv,
    `nome;email;cargo;equipe;area;gestor_email;data_admissao;situacao\nImportada Um ${sufixo};imp1.${sufixo}@aurora.test;Analista;Equipe Import ${sufixo};Área Import ${sufixo};imp2.${sufixo}@aurora.test;10/02/2025;ativo\nImportada Dois ${sufixo};imp2.${sufixo}@aurora.test;Coordenadora;Equipe Import ${sufixo};;;2024-05-01;ativo\nSem Data;sem.${sufixo}@aurora.test;;;;;31/02/2025;ativo\n`,
  );
  e = await nav.ir("/colaboradores/importar");
  await nav.anexar("input[name=arquivo]", csv);
  await nav.avaliar("document.querySelector('input[name=arquivo]').form.requestSubmit()");
  await nav.esperarAte("/Importação concluída/.test(document.querySelector('main').innerText)");
  const imp = await um("select c.gestor_id, g.email gestor, e.nome equipe, a.nome area, c.data_admissao::text adm from colaboradores c left join colaboradores g on g.id=c.gestor_id left join equipes e on e.id=c.equipe_id left join areas a on a.id=e.area_id where c.tenant_id=$1 and c.email=$2", [AURORA, `imp1.${sufixo}@aurora.test`]);
  checar("Importação cria pessoa, equipe, área e gestor (do próprio arquivo)", imp?.gestor === `imp2.${sufixo}@aurora.test` && imp?.equipe === `Equipe Import ${sufixo}` && imp?.area === `Área Import ${sufixo}` && imp?.adm === "2025-02-10", JSON.stringify(imp));
  checar("Linha com data inválida é rejeitada e reportada", /Linha 4: Data de admissão inválida/.test((await nav.estado()).texto) && !(await um("select 1 from colaboradores where email=$1", [`sem.${sufixo}@aurora.test`])));
  const exp = await nav.avaliar("fetch('/colaboradores/exportar').then(async r=>r.status+' '+(await r.text()).slice(0,200))");
  checar("Exportação da base de colaboradores (CSV)", /^200 .*"nome";"email";"cargo"/s.test(exp), exp?.slice(0, 60));

  // ── 3. Pipeline de Vagas ──
  e = await nav.ir("/pipeline-vagas");
  const colunas = await nav.avaliar("[...document.querySelectorAll('section[data-etapa]')].map(s=>s.querySelector('h3').textContent).join('|')");
  checar("Pipeline com as etapas do processo", colunas === "Planejamento|Divulgação|Triagem|Entrevistas|Proposta|Concluída", colunas);
  checar("Cartão da vaga com mini-funil e link para os candidatos", !!(await nav.avaliar(`!!document.querySelector('article[data-vaga="${vagaExec.id}"] a[href="/crm?visao=kanban&vaga=${vagaExec.id}"]')`)));
  const mover = async (etapa) =>
    nav.avaliar(`(()=>{window.confirm=()=>true;const s=document.querySelector('article[data-vaga="${vagaExec.id}"] select[aria-label^="Etapa de"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${etapa}');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await mover("entrevistas");
  const p1 = await ateNoBanco("select etapa_pipeline from vagas where id=$1", [vagaExec.id], (x) => x.etapa_pipeline === "entrevistas");
  checar("Mover vaga para “Entrevistas” grava a etapa", p1.etapa_pipeline === "entrevistas");
  e = await nav.ir("/pipeline-vagas");
  await mover("concluida");
  const p2 = await ateNoBanco("select etapa_pipeline, status, publicada from vagas where id=$1", [vagaExec.id], (x) => x.etapa_pipeline === "concluida");
  checar("Concluir encerra a vaga e tira da Página de Carreiras", p2.status === "fechada" && p2.publicada === false, JSON.stringify(p2));
  e = await nav.ir("/pipeline-vagas");
  await mover("triagem");
  const p3 = await ateNoBanco("select etapa_pipeline, status from vagas where id=$1", [vagaExec.id], (x) => x.etapa_pipeline === "triagem");
  checar("Sair de “Concluída” reabre a vaga", p3.status === "aberta");
  checar("Movimentação auditada", !!(await um("select 1 from auditoria where entidade_id=$1 and acao='pipeline.vaga.mover'", [vagaExec.id])));

  // ── 4. Offboarding: registro + entrevista por link ──
  e = await nav.ir(`/offboarding/novo?colaborador=${saindo.id}`);
  await nav.avaliar("document.querySelector('main form button[type=submit]').click()");
  await nav.esperarAte("/^\\/offboarding\\/[0-9a-f-]{36}$/.test(location.pathname)", 20000);
  const d = await ateNoBanco("select d.*, c.status from desligamentos d join colaboradores c on c.id=d.colaborador_id where d.colaborador_id=$1", [saindo.id], (x) => !!x.id);
  checar("Registrar desligamento cria o registro e marca a pessoa como desligada", d.status === "desligado" && d.entrevista_status === "pendente" && d.voluntario === true);
  checar("Registro fotografa gestor, equipe e área na saída", d.gestor_nome === "Bruno Martins" && d.equipe_nome === "Produto" && !!d.area_nome, `${d.gestor_nome} · ${d.equipe_nome} · ${d.area_nome}`);
  await nav.esperarEstavel();
  await nav.preencher({ "main input[type=email]": emailSaida });
  await nav.avaliar("document.querySelector('main input[type=email]').form.requestSubmit()");
  const env = await ateNoBanco("select entrevista_status, email_contato from desligamentos where id=$1", [d.id], (x) => x.entrevista_status === "enviada");
  checar("Envio do link da entrevista ao e-mail pessoal", env.entrevista_status === "enviada" && env.email_contato === emailSaida);
  let link = null;
  for (let i = 0; i < 30 && !link; i++) {
    const msgs = ((await (await fetch(`${MAILPIT}/messages?limit=100`)).json()).messages ?? []).filter((m) => m.To?.some((t) => t.Address === emailSaida));
    if (msgs.length) link = ((await (await fetch(`${MAILPIT}/message/${msgs[0].ID}`)).json()).Text ?? "").match(/https?:\/\/[^\s]+\/desligamento\/[^\s]+/)?.[0];
    if (!link) await esperar(500);
  }
  checar("E-mail com link pessoal da entrevista", !!link);
  const caminho = link ? new URL(link).pathname : "/desligamento/x";

  // Página pública (sem login)
  e = await nav.entrar("x@x.test", "x"); // limpa a sessão (login inválido)
  e = await nav.ir(caminho);
  checar("Página pública abre sem login com o primeiro nome", /Olá, Vitória/.test(e.texto) && /não são compartilhadas com a sua liderança/.test(e.texto));
  await nav.avaliar(`(()=>{const lab=t=>[...document.querySelectorAll('form label')].find(l=>l.textContent.includes(t));
    lab('Liderança direta').querySelector('input').click(); lab('Crescimento e carreira').querySelector('input').click(); return true})()`);
  await nav.esperarAte("document.querySelectorAll('form select').length >= 2");
  await nav.avaliar(`(()=>{const s=[...document.querySelectorAll('form select')].find(x=>[...x.options].some(o=>o.value==='lideranca'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'lideranca');s.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelectorAll('[role=radiogroup][aria-labelledby^="dim-"]').forEach((g,i)=>g.querySelectorAll('input')[i%2?1:3].click());
    document.querySelector('input[name=evitavel][value=sim]').click(); document.querySelector('input[name=enps][value="4"]').click(); document.querySelector('input[name=voltaria][value=talvez]').click(); return true})()`);
  await esperar(300);
  await nav.avaliar("document.querySelector('form').requestSubmit()");
  await nav.esperarAte("/Obrigado pela sinceridade/.test(document.body.innerText) || document.querySelector('[role=alert]')");
  const resp = await ateNoBanco("select entrevista_status, motivo_principal_real, enps, evitavel, entrevista_modo from desligamentos where id=$1", [d.id], (x) => x.entrevista_status === "respondida");
  checar("Respostas gravadas com motivo real, eNPS e evitabilidade", resp.motivo_principal_real === "lideranca" && resp.enps === 4 && resp.evitavel === "sim" && resp.entrevista_modo === "link", JSON.stringify(resp) + " " + (await nav.mensagem()));
  e = await nav.ir(caminho);
  checar("Link de uso único: segunda abertura mostra “já respondida”", /Entrevista já respondida/.test(e.texto));
  e = await nav.ir(caminho.replace(/.$/, (c) => (c === "A" ? "B" : "A")));
  checar("Link adulterado é inválido", /Link inválido/.test(e.texto));

  e = await nav.entrar("ana@aurora.test");
  e = await nav.ir(`/offboarding/${d.id}`);
  checar("RH vê as respostas e a divergência com o motivo informado", /Liderança direta/.test(e.texto) && /difere do motivo informado/.test(e.texto) && /Experiência na empresa/.test(e.texto));
  const expOff = await nav.avaliar("fetch('/offboarding/exportar').then(async r=>r.status+' '+(await r.text()).includes('Motivo principal real'))");
  checar("Exportação de desligamentos (CSV)", expOff === "200 true", expOff);

  // ── 5. Retenção ──
  e = await nav.ir("/retencao");
  checar("Painel de retenção com turnover, motivos e playbook", /Turnover anualizado/.test(e.texto) && /Motivos reais de saída/.test(e.texto) && /Para minimizar o impacto/.test(e.texto));
  e = await nav.ir("/retencao/risco");
  checar("Risco de saída com fatores por escrito", /Como ler/.test(e.texto) && /pts/.test(e.texto) && /indicativa/.test(e.texto));
  e = await nav.ir(`/retencao/acoes?nova=1&colaborador=${elisa.id}&categoria=crescimento&origem=risco`);
  const tituloAcao = `Conversa de carreira E2E ${sufixo}`;
  await nav.preencher({ "#nova-acao input[minlength='3']": tituloAcao });
  await nav.avaliar("document.querySelector('#nova-acao').requestSubmit()");
  const acao = await ateNoBanco("select id, colaborador_id, categoria, origem from acoes_retencao where titulo=$1", [tituloAcao], (x) => !!x.id);
  checar("Ação de retenção criada a partir do risco (pessoa e fator pré-preenchidos)", acao.colaborador_id === elisa.id && acao.categoria === "crescimento" && acao.origem === "risco");
  e = await nav.ir("/retencao/acoes");
  await nav.avaliar(`(()=>{const s=document.querySelector('select[aria-label="Situação de ${tituloAcao}"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'em_andamento');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const st = await ateNoBanco("select status from acoes_retencao where id=$1", [acao.id], (x) => x.status === "em_andamento");
  checar("Situação da ação atualizada", st.status === "em_andamento");

  // ── 6. People Analytics ──
  e = await nav.ir("/people-analytics");
  checar(
    "People Analytics com resumo, insights, ações, preditiva e comparativo",
    ["Resumo executivo", "Insights", "Ações necessárias", "Análise preditiva", "Comparativo de mercado", "Por que as pessoas saem", "Atração e seleção", "Saúde do colaborador"].every((t) => e.texto.includes(t)),
  );
  e = await nav.ir("/people-analytics?periodo=90d");
  checar("Filtro por período (90 dias)", /Últimos 90 dias/.test(e.texto) && /comparação com os 90 dias anteriores/.test(e.texto));
  e = await nav.ir("/people-analytics?periodo=personalizado&de=2026-01-01&ate=2026-06-30");
  checar("Período personalizado", /01\/01\/2026 a 30\/06\/2026/.test(e.texto));
  const area = await um("select id, nome from areas where tenant_id=$1 and nome='Tecnologia'", [AURORA]);
  e = await nav.ir(`/people-analytics?area=${area.id}`);
  checar("Recorte por área", e.texto.includes(`Área: ${area.nome}`));
  const expPa = await nav.avaliar("fetch('/people-analytics/exportar?periodo=12m').then(async r=>r.status+' '+(await r.text()).includes('Turnover anualizado'))");
  checar("Exportação de indicadores agregados (CSV)", expPa === "200 true", expPa);
  e = await nav.ir("/people-analytics/referencias");
  await nav.preencher({ "#ref-turnoverAnual": "20" });
  await nav.avaliar(`(()=>{const ins=[...document.querySelectorAll('main input[inputmode=decimal]')];const s=ins.find(i=>i.placeholder==='Opcional');const m=ins.find(i=>i.placeholder==='Ex.: 6');for(const [el,v] of [[s,'8000'],[m,'6']]){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  await nav.avaliar("document.querySelector('#ref-turnoverAnual').form.requestSubmit()");
  const cfg = await ateNoBanco("select referencias from configuracoes_analytics where tenant_id=$1", [AURORA], (x) => x.referencias?.valores?.turnoverAnual === 20);
  checar("Referências de mercado salvas", cfg.referencias?.valores?.turnoverAnual === 20 && cfg.referencias?.salarioMedioMensal === 8000);
  e = await nav.ir("/people-analytics");
  checar("Custo estimado do turnover com as premissas", /Custo estimado do turnover\s*R\$/.test(e.texto) && /referência 20% ao ano/.test(e.texto));
  e = await nav.ir("/inicio");
  checar("Início mostra indicadores de Offboarding e People Analytics", /Entrevistas de saída/.test(e.texto) && /Turnover 12 meses/.test(e.texto));

  // ── 7. Permissões e isolamento ──
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/people-analytics/referencias");
  checar("RH vê referências sem poder editar", /Somente leitura/.test(e.texto) && !(await nav.avaliar("!!document.querySelector('main button[type=submit]')")));
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir("/offboarding");
  checar("Gestor não acessa Offboarding (entrevistas confidenciais)", !e.url.startsWith("/offboarding"), e.url);
  e = await nav.ir("/retencao");
  checar("Gestor vai direto ao risco da equipe (sem painel da organização)", e.url.startsWith("/retencao/risco"), e.url);
  const nomes = await nav.avaliar("[...document.querySelectorAll('main tbody a[href^=\"/colaboradores/\"]')].map(a=>a.textContent.trim()).join('|')");
  checar("Gestor vê só os liderados diretos", /Diego Ferreira/.test(nomes) && !/Marina Costa/.test(nomes) && !/Bruno Martins/.test(nomes), nomes);
  e = await nav.ir("/retencao/acoes");
  checar("Gestor não tem a opção de alcance “Organização”", !(await nav.avaliar("!!document.querySelector('#nova-acao option[value=organizacao]')")));
  e = await nav.ir("/people-analytics");
  checar("Gestor não acessa People Analytics", !e.url.startsWith("/people-analytics"), e.url);
  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir("/retencao/risco");
  checar("Colaboradora não acessa Retenção", !e.url.startsWith("/retencao"), e.url);
  e = await nav.entrar("helena@bravo.test");
  for (const rota of ["/offboarding", "/retencao", "/people-analytics"]) {
    e = await nav.ir(rota);
    checar(`Outra empresa sem o módulo: ${rota} bloqueado`, !e.url.startsWith(rota), e.url);
  }
  e = await nav.ir("/pipeline-vagas");
  checar("Pipeline da Bravo não mostra vagas da Aurora", !/Executivo\(a\) de Contas/.test(e.texto) && /Pipeline de Vagas/.test(e.texto));
  const vazamento = await nav.avaliar(`fetch('/offboarding/${d.id}').then(r=>r.url)`);
  checar("Desligamento da Aurora inacessível pela Bravo", !String(vazamento).includes(`/offboarding/${d.id}`), vazamento);
} finally {
  nav.fechar();
  await adm.query("update vagas set etapa_pipeline=$2, status=$3, publicada=$4, fechada_em=null where id=$1", [vagaExec.id, vagaExec.etapa_pipeline, vagaExec.status, vagaExec.publicada]);
  await adm.query("delete from acoes_retencao where titulo like $1", [`%E2E ${sufixo}`]);
  await adm.query("delete from desligamentos where colaborador_id=$1", [saindo.id]);
  await adm.query("delete from colaboradores where id=$1 or email like $2", [saindo.id, `%.${sufixo}@aurora.test`]);
  await adm.query("delete from equipes where tenant_id=$1 and nome=$2", [AURORA, `Equipe Import ${sufixo}`]);
  await adm.query("delete from areas where tenant_id=$1 and nome=$2", [AURORA, `Área Import ${sufixo}`]);
  if (configAntes) await adm.query("update configuracoes_analytics set referencias=$2 where tenant_id=$1", [AURORA, configAntes.referencias]);
  else await adm.query("delete from configuracoes_analytics where tenant_id=$1", [AURORA]);
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
