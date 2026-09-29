// Testes E2E do Pulse: anonimato e mínimo de respondentes no banco + fluxo pela interface.
// Uso: node journeylab/scripts/e2e/pulse.mjs   (app em localhost:3020)
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

// ── Preparação: pesquisas da Aurora voltam ao estado do seed ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from pesquisas_pulse where tenant_id=$1", [AURORA]);
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
const encerrada = await um("select id from pesquisas_pulse where tenant_id=$1 and titulo='Clima rápido · setembro'", [AURORA]);
const aberta = await um("select id from pesquisas_pulse where tenant_id=$1 and titulo='eNPS · outubro'", [AURORA]);
const equipe = async (nome) => (await um("select id from equipes where tenant_id=$1 and nome=$2", [AURORA, nome])).id;
const uid = async (e) => (await um("select id from usuarios where email=$1", [e])).id;

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
  checar("Banco: a aplicação não consegue LER respostas (nem a administradora)", /permission denied/.test(leitura ?? ""), leitura ?? "leu!");
  const gravacao = await falha("insert into respostas_pulse (id,tenant_id,pesquisa_id,pergunta_id,lote,valor) values (gen_random_uuid(),$1,$2,(select id from perguntas_pulse where pesquisa_id=$2 limit 1),gen_random_uuid(),5)", [AURORA, aberta.id]);
  checar("Banco: a aplicação não consegue GRAVAR respostas diretamente", /permission denied/.test(gravacao ?? ""), gravacao ?? "gravou!");
  const partic = (await app.query("select count(*)::int n from participacoes_pulse")).rows[0].n;
  const proprias = (await um("select count(*)::int n from participacoes_pulse p join colaboradores c on c.id=p.colaborador_id where c.email='ana@aurora.test'")).n;
  const todas = (await um("select count(*)::int n from participacoes_pulse where tenant_id=$1", [AURORA])).n;
  checar("Banco: cada pessoa só enxerga a própria participação", partic === proprias && todas > proprias, `vê ${partic} de ${todas}`);

  const resumo = async (equipeId) => (await app.query("select * from jl_resumo_pulse($1, $2)", [encerrada.id, equipeId])).rows[0];
  const linhas = async (equipeId) => (await app.query("select * from jl_resultado_pulse($1, $2)", [encerrada.id, equipeId])).rows.length;
  const org = await resumo(null);
  checar("Banco: organização inteira liberada (11 ≥ 5)", org.liberado && org.respondentes === 11 && (await linhas(null)) === 4, JSON.stringify(org));
  const comercial = await resumo(await equipe("Comercial"));
  checar("Banco: recorte com 3 respondentes é bloqueado (mínimo)", !comercial.liberado && comercial.motivo === "minimo" && (await linhas(await equipe("Comercial"))) === 0, JSON.stringify(comercial));
  const produto = await resumo(await equipe("Produto"));
  checar("Banco: recorte de 6 com complemento de 5 é liberado", produto.liberado && produto.respondentes === 6, JSON.stringify(produto));
  const emColeta = (await app.query("select * from jl_resumo_pulse($1, null)", [aberta.id])).rows[0];
  checar("Banco: pesquisa aberta não libera resultados", !emColeta.liberado && emColeta.motivo === "aberta");
  await app.query("rollback");

  // Regra do complemento: movemos as 3 respostas de "Comercial" para "Produto" (9 de 11).
  // O resto da organização fica com 2 < 5 → o recorte "Produto" precisa ser bloqueado.
  const comercialId = await equipe("Comercial");
  const produtoId = await equipe("Produto");
  const lotes = (await adm.query("select distinct lote from respostas_pulse where pesquisa_id=$1 and equipe_id=$2", [encerrada.id, comercialId])).rows.map((r) => r.lote);
  await adm.query("update respostas_pulse set equipe_id=$1 where lote = any($2::uuid[])", [produtoId, lotes]);
  try {
    await sessao("ana@aurora.test");
    const grande = (await app.query("select * from jl_resumo_pulse($1, $2)", [encerrada.id, produtoId])).rows[0];
    const n = (await app.query("select * from jl_resultado_pulse($1, $2)", [encerrada.id, produtoId])).rows.length;
    await app.query("rollback");
    checar("Banco: recorte cujo complemento é pequeno fica bloqueado (anti-subtração)", !grande.liberado && grande.motivo === "complemento" && n === 0, JSON.stringify(grande));
  } finally {
    await adm.query("update respostas_pulse set equipe_id=$1 where lote = any($2::uuid[])", [comercialId, lotes]);
  }
  await app.end();
}

const nav = await abrirNavegador(9449);
try {
  // ── 2. Colaboradora responde (anônimo) ──
  let e = await nav.entrar("carla@aurora.test");
  checar("Painel mostra pesquisa para responder", /Pesquisas para responder/.test(e.texto) && /eNPS · outubro/.test(e.texto));
  e = await nav.ir(`/pulse/responder/${aberta.id}`);
  checar("Formulário explica o anonimato", /anônima/.test(e.texto));
  const perguntas = (await adm.query("select id, tipo from perguntas_pulse where pesquisa_id=$1 order by ordem", [aberta.id])).rows;
  await nav.avaliar(`(()=>{document.querySelector('input[name="q_${perguntas[0].id}"][value="8"]').checked=true;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(document.querySelector('textarea[name="q_${perguntas[1].id}"]'),'Comentário anônimo E2E');
    document.querySelector('input[name=pesquisaId]').form.requestSubmit();})()`);
  await nav.esperarAte("location.search.includes('respondido=1')");
  e = await nav.estado();
  checar("Resposta enviada e confirmada", /Resposta registrada de forma anônima/.test(e.texto), e.url);
  const carla = await um("select id from colaboradores where email='carla@aurora.test'");
  checar("Participação registrada só com a data", !!(await um("select 1 from participacoes_pulse where pesquisa_id=$1 and colaborador_id=$2", [aberta.id, carla.id])));
  const resp = await um("select count(*)::int n from respostas_pulse where pesquisa_id=$1", [aberta.id]);
  const colunas = (await adm.query("select column_name from information_schema.columns where table_name='respostas_pulse'")).rows.map((r) => r.column_name);
  checar("Resposta gravada sem pessoa nem horário", resp.n === 2 && !colunas.some((c) => /colaborador|usuario|criado|em$/.test(c)), colunas.join(","));
  e = await nav.ir(`/pulse/responder/${aberta.id}`);
  checar("Não é possível responder duas vezes", !/Enviar respostas/.test(e.texto));
  e = await nav.ir(`/pulse/${encerrada.id}`);
  checar("Colaboradora não acessa a gestão/resultados", e.url === "/pulse" || e.url.startsWith("/pulse?"), e.url);

  // ── 3. RH: cria, abre, vê resultados com recortes ──
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/pulse");
  await nav.preencher({ "input[name=titulo]": "Pulse E2E", "select[name=modelo]": "clima" });
  await nav.enviar("input[name=titulo]", 1000);
  await nav.esperarAte("/\\/pulse\\/[0-9a-f-]{36}$/.test(location.pathname)");
  const nova = await um("select p.id, p.status, (select count(*)::int from perguntas_pulse q where q.pesquisa_id=p.id) n from pesquisas_pulse p where titulo='Pulse E2E' order by criado_em desc limit 1");
  checar("RH cria rascunho a partir do modelo", nova?.status === "rascunho" && nova.n === 6, JSON.stringify(nova));
  await nav.esperarEstavel();
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=acao][value=abrir]')).requestSubmit()`);
  await esperar(3000);
  checar("RH abre a pesquisa", (await um("select status from pesquisas_pulse where id=$1", [nova.id])).status === "aberta");
  e = await nav.ir(`/pulse/${nova.id}`);
  checar("Pesquisa aberta mostra adesão e não aceita edição", /Adesão/.test(e.texto) && !(await nav.avaliar("!!document.querySelector('select[name=tipo]')")));
  e = await nav.ir(`/pulse/${encerrada.id}`);
  checar("RH vê resultados agregados da organização (média e eNPS)", /11 respondente\(s\)/.test(e.texto) && /eNPS/.test(e.texto) && /de 5/.test(e.texto), e.texto.slice(0, 120));
  checar("Comentários aparecem sem metadados", /O time é muito colaborativo/.test(e.texto));
  e = await nav.ir(`/pulse/${encerrada.id}?equipe=${await equipe("Comercial")}`);
  checar("Recorte pequeno exibe aviso de anonimato, sem números", /mínimo de respondentes/.test(e.texto) && !/de 5 ·/.test(e.texto));

  // ── 4. Gestor: só o recorte da equipe que lidera ──
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir(`/pulse/${encerrada.id}`);
  const opcoes = await nav.avaliar("[...document.querySelectorAll('#recorte option')].map(o=>o.textContent).join('|')");
  checar("Gestor vê resultados só da própria equipe", opcoes === "Produto" && /6 respondente\(s\)/.test(e.texto), opcoes);
  e = await nav.ir(`/pulse/${nova.id}`);
  checar("Gestor não vê pesquisa sem resultado da sua equipe como gestão", !/Abrir para respostas|Encerrar e liberar/.test(e.texto));

  // ── 5. Isolamento ──
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/pulse/${encerrada.id}`);
  checar("Bravo (sem Pulse) é bloqueada", e.url.startsWith("/inicio?bloqueado=pulse"), e.url);
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
