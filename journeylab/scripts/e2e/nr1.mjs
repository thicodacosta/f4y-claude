// Testes E2E do Diagnóstico NR-1: anonimato/agregação no banco, acesso restrito, riscos, plano de ação e exportação.
// Uso: node journeylab/scripts/e2e/nr1.mjs   (app em localhost:3020)
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

const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from ciclos_nr1 where tenant_id=$1", [AURORA]);
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
const encerrado = await um("select id from ciclos_nr1 where tenant_id=$1 and status='encerrado'", [AURORA]);
const aberto = await um("select id from ciclos_nr1 where tenant_id=$1 and status='aberto'", [AURORA]);
const uid = async (e) => (await um("select id from usuarios where email=$1", [e])).id;
const equipe = async (nome) => (await um("select id from equipes where tenant_id=$1 and nome=$2", [AURORA, nome])).id;

// ── 1. Banco ──
{
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  await app.query("begin");
  await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo','tenant',true)", [AURORA, await uid("ana@aurora.test")]);
  let erro = null;
  try {
    await app.query("savepoint s");
    await app.query("select * from respostas_nr1 limit 1");
  } catch (e) {
    erro = e.message;
    await app.query("rollback to savepoint s");
  }
  checar("Banco: a aplicação não lê respostas do NR-1", /permission denied/.test(erro ?? ""), erro ?? "leu!");
  const org = (await app.query("select * from jl_resumo_nr1($1, null)", [encerrado.id])).rows[0];
  checar("Banco: resultado da organização liberado (11 participantes)", org.liberado && org.respondentes === 11, JSON.stringify(org));
  const dims = (
    await app.query(
      "select d.nome, avg(r.indice)::numeric(5,1) indice from jl_resultado_nr1($1, null) r join dimensoes_nr1 d on d.id=r.dimensao_id group by d.nome",
      [encerrado.id],
    )
  ).rows;
  const ind = (n) => Number(dims.find((d) => d.nome === n)?.indice);
  checar("Banco: índice por dimensão calculado com inversão de itens", ind("Demandas e ritmo de trabalho") < 50 && ind("Relações e convivência") >= 70, dims.map((d) => `${d.nome.split(" ")[0]}=${d.indice}`).join(" "));
  const com = (await app.query("select * from jl_resumo_nr1($1, $2)", [encerrado.id, await equipe("Comercial")])).rows[0];
  const linhasCom = (await app.query("select * from jl_resultado_nr1($1, $2)", [encerrado.id, await equipe("Comercial")])).rows.length;
  checar("Banco: recorte abaixo do mínimo não devolve dados", !com.liberado && linhasCom === 0, JSON.stringify(com));
  const emColeta = (await app.query("select * from jl_resultado_nr1($1, null)", [aberto.id])).rows.length;
  checar("Banco: ciclo aberto não devolve resultados", emColeta === 0);
  await app.query("rollback");
  await app.end();
}

const nav = await abrirNavegador(9451);
try {
  // ── 2. Colaboradora participa ──
  let e = await nav.entrar("carla@aurora.test");
  checar("Painel mostra diagnóstico para participar", /Diagnóstico para participar/.test(e.texto));
  e = await nav.ir(`/nr1/responder/${aberto.id}`);
  checar("Formulário informa anonimato e canais de apoio (sem caráter clínico)", /anônima/.test(e.texto) && /188/.test(e.texto) && /não é canal de denúncia/.test(e.texto));
  await nav.avaliar(`(()=>{const nomes=new Set([...document.querySelectorAll('input[type=radio]')].map(i=>i.name));
    for(const n of nomes){document.querySelector('input[name="'+n+'"][value="4"]').checked=true;}
    document.querySelector('input[name=cicloId]').form.requestSubmit();})()`);
  await nav.esperarAte("location.search.includes('respondido=1')");
  const carla = await um("select id from colaboradores where email='carla@aurora.test'");
  const n = await um("select count(*)::int n from respostas_nr1 where ciclo_id=$1", [aberto.id]);
  checar("Participação registrada; 21 respostas anônimas gravadas", !!(await um("select 1 from participacoes_nr1 where ciclo_id=$1 and colaborador_id=$2", [aberto.id, carla.id])) && n.n === 21, `${n.n}`);
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("Colaboradora não vê resultados", e.url === "/nr1", e.url);

  // ── 3. RH sem permissão concedida ──
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("RH (sem permissão NR-1 por padrão) não vê resultados", e.url === "/nr1", e.url);
  const exp = await nav.avaliar(`fetch('/nr1/${encerrado.id}/exportar').then(r=>r.status)`);
  checar("RH não exporta o relatório", exp === 403, String(exp));

  // ── 4. Administradora: resultados, riscos, plano de ação, exportação ──
  e = await nav.entrar("ana@aurora.test");
  const auditAntes = (await um("select count(*)::int n from auditoria where acao='nr1.resultado.visualizar'")).n;
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("Administradora vê índices por dimensão com faixas", /Demandas e ritmo de trabalho/.test(e.texto) && /Prioritário/.test(e.texto) && /Favorável/.test(e.texto));
  checar("Aviso de que não é avaliação clínica nem parecer jurídico", /[Nn]ão constitui avaliação clínica/.test(e.texto));
  checar("Visualização de resultados é auditada", (await um("select count(*)::int n from auditoria where acao='nr1.resultado.visualizar'")).n > auditAntes);
  e = await nav.ir(`/nr1/${encerrado.id}?equipe=${await equipe("Comercial")}`);
  checar("Recorte pequeno é bloqueado na tela", /mínimo de participantes/.test(e.texto));

  await nav.ir(`/nr1/${encerrado.id}`);
  await nav.preencher({ "input[name=titulo][placeholder^='Ex.: Sobrecarga']": "Comunicação de mudanças pouco antecipada (E2E)" });
  await nav.enviar("input[name=titulo][placeholder^='Ex.: Sobrecarga']", 3000);
  const risco = await um("select id, status from riscos_nr1 where titulo='Comunicação de mudanças pouco antecipada (E2E)'");
  checar("Fator de risco registrado", !!risco);
  await nav.ir(`/nr1/${encerrado.id}`);
  await nav.preencher({ [`#med-${risco.id}`]: "Comunicar mudanças com 15 dias de antecedência", [`#resp-${risco.id}`]: "Comunicação Interna" });
  await nav.enviar(`#med-${risco.id}`, 3000);
  const medida = await um("select a.id, r.status from acoes_nr1 a join riscos_nr1 r on r.id=a.risco_id where a.risco_id=$1", [risco.id]);
  checar("Medida incluída e risco passa a 'em tratamento'", !!medida && medida.status === "em_tratamento");
  await nav.ir(`/nr1/${encerrado.id}`);
  await nav.preencher({ [`#st-${medida.id}`]: "concluida" });
  await nav.enviar(`#st-${medida.id}`, 3000);
  checar("Concluir medida sem evidência é recusado", /evidência/.test(await nav.mensagem()), await nav.mensagem());

  const csv = await nav.avaliar(`fetch('/nr1/${encerrado.id}/exportar').then(async r=>r.status+'|'+(await r.text()))`);
  checar("Relatório CSV com índices, riscos e medidas", csv.startsWith("200|") && /Demandas e ritmo de trabalho/.test(csv) && /Comunicação Interna/.test(csv) && /não constitui avaliação clínica/.test(csv));
  checar("Relatório não contém respostas individuais", !/lote|colaborador/i.test(csv));

  // Novo ciclo pelo questionário de referência
  e = await nav.ir("/nr1");
  await nav.preencher({ "input[name=titulo]": "Ciclo E2E" });
  await nav.enviar("input[name=titulo]", 1000);
  await nav.esperarAte("/\\/nr1\\/[0-9a-f-]{36}$/.test(location.pathname)");
  const novo = await um("select c.id, (select count(*)::int from dimensoes_nr1 d where d.ciclo_id=c.id) d, (select count(*)::int from perguntas_nr1 q where q.ciclo_id=c.id) q from ciclos_nr1 c where titulo='Ciclo E2E' order by criado_em desc limit 1");
  checar("Ciclo criado com o questionário de referência (7 × 21)", novo?.d === 7 && novo.q === 21, JSON.stringify(novo));
  await nav.esperarEstavel();
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=acao][value=abrir]')).requestSubmit()`);
  await esperar(3000);
  checar("Ciclo aberto para participação", (await um("select status from ciclos_nr1 where id=$1", [novo.id])).status === "aberto");

  // ── 5. Isolamento ──
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/nr1/${encerrado.id}`);
  checar("Bravo (sem NR-1) é bloqueada", e.url.startsWith("/inicio?bloqueado=nr1"), e.url);
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
