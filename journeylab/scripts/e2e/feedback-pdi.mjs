// Testes E2E de Feedback 1:1 e PDI (dados do seed).
// Uso: node journeylab/scripts/e2e/feedback-pdi.mjs   (app em localhost:3020)
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

/** Preenche e envia o primeiro formulário que satisfaz o predicado (JS sobre `f`). */
async function formulario(nav, predicado, campos = {}, ms = 3000) {
  const ok = await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>${predicado});if(!f) return false;
    const campos=${JSON.stringify(campos)};
    for(const [n,v] of Object.entries(campos)){const el=f.querySelector('[name='+n+']'+(typeof v==='object'?'[value='+v.radio+']':''));if(!el) throw new Error('campo '+n);
      if(typeof v==='object'){el.checked=true;continue;}
      const pr=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(pr,'value').set.call(el,v);}
    f.requestSubmit();return true;})()`);
  await esperar(ms);
  return ok;
}

// ── Preparação: estado do seed (Feedback/PDI recriados) ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query(
  "delete from reunioes where colaborador_id in (select id from colaboradores where email in ('carla@aurora.test','diego@aurora.test'))",
);
await adm.query("delete from pdis where colaborador_id in (select id from colaboradores where email in ('carla@aurora.test','diego@aurora.test'))");
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
const reuniao = await um("select r.id from reunioes r join colaboradores c on c.id=r.colaborador_id where c.email='carla@aurora.test' and r.status='realizada'");
const pdiCarla = await um("select p.id from pdis p join colaboradores c on c.id=p.colaborador_id where c.email='carla@aurora.test'");
const compromisso = (d) => um("select id, status from compromissos where reuniao_id=$1 and descricao=$2", [reuniao.id, d]);

// ── 1. Privacidade das anotações NO BANCO (papel da aplicação, sem bypass de RLS) ──
{
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  const uid = async (e) => (await um("select id from usuarios where email=$1", [e])).id;
  const ler = async (email, escopo = "tenant") => {
    await app.query("begin");
    await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo',$3,true)", [AURORA, await uid(email), escopo]);
    const r = (await app.query("select autor_nome, visibilidade from anotacoes_reuniao where reuniao_id=$1", [reuniao.id])).rows;
    await app.query("rollback");
    return r.map((x) => `${x.autor_nome.split(" ")[0]}/${x.visibilidade}`).sort().join(",");
  };
  const bruno = await ler("bruno@aurora.test");
  const carla = await ler("carla@aurora.test");
  checar("Banco: gestor lê as compartilhadas + as próprias privadas", bruno === "Bruno/compartilhada,Bruno/privada,Carla/compartilhada", bruno);
  checar("Banco: colaboradora lê as compartilhadas + as próprias privadas", carla === "Bruno/compartilhada,Carla/compartilhada,Carla/privada", carla);
  checar("Banco: administradora não lê nenhuma anotação", (await ler("ana@aurora.test")) === "");
  checar("Banco: RH não lê nenhuma anotação", (await ler("rafael@aurora.test")) === "");
  checar("Banco: escopo de plataforma não lê nenhuma anotação", (await ler("admin@journeylab.local", "plataforma")) === "");
  await app.query("begin");
  await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo','tenant',true)", [AURORA, await uid("ana@aurora.test")]);
  let bloqueado = false;
  try {
    await app.query(
      "insert into anotacoes_reuniao (id,tenant_id,reuniao_id,autor_usuario_id,autor_nome,visibilidade,texto,atualizado_em) values (gen_random_uuid(),$1,$2,$3,'Ana','compartilhada','x',now())",
      [AURORA, reuniao.id, await uid("ana@aurora.test")],
    );
  } catch {
    bloqueado = true;
  }
  await app.query("rollback");
  checar("Banco: não participante não consegue gravar anotação", bloqueado);
  await app.end();
}

const nav = await abrirNavegador(9448);
try {
  // ── 2. Gestor ──
  let e = await nav.entrar("bruno@aurora.test");
  checar("Painel do gestor mostra próximo 1:1 e ações de PDI", /Próximos 1:1/.test(e.texto) && /Carla Mendes/.test(e.texto) && /Ações de PDI em aberto/.test(e.texto));
  e = await nav.ir(`/feedback/${reuniao.id}`);
  checar("Gestor vê a própria nota privada e a compartilhada da liderada", /avaliar a Carla para liderar/.test(e.texto) && /desenvolver comunicação com executivos/.test(e.texto));
  checar("Gestor NÃO vê a nota privada da liderada", !/pedir feedback mais frequente/.test(e.texto));
  await formulario(nav, "f.querySelector('input[name=descricao]')", { descricao: "Revisar portfólio de casos (E2E)" });
  checar("Gestor registra compromisso", !!(await compromisso("Revisar portfólio de casos (E2E)")));
  await formulario(nav, "f.querySelector('textarea[name=texto]') && f.querySelector('input[name=visibilidade]')", { texto: "Anotação compartilhada E2E do gestor", visibilidade: { radio: "compartilhada" } });
  checar("Gestor grava anotação compartilhada", !!(await um("select 1 from anotacoes_reuniao where texto='Anotação compartilhada E2E do gestor'")));

  // Integração 1:1 → PDI
  const mapear = await compromisso("Mapear pontos de atrito do onboarding de clientes");
  await nav.ir(`/feedback/${reuniao.id}`);
  await formulario(nav, `f.querySelector('input[name=compromissoId][value="${mapear.id}"]') && f.querySelector('select[name=objetivoId]')`, { objetivoId: "novo" });
  const acaoOrigem = await um("select a.id, a.pdi_id from acoes_pdi a where compromisso_origem_id=$1", [mapear.id]);
  checar("Compromisso levado ao PDI vira ação no PDI da pessoa", acaoOrigem?.pdi_id === pdiCarla.id);

  // Agendar novo 1:1 pela tela
  const diego = await um("select id from colaboradores where email='diego@aurora.test'");
  e = await nav.ir("/feedback");
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 11) + "09:30";
  await formulario(nav, "f.querySelector('select[name=colaboradorId]') && f.querySelector('input[name=dataHora]')", { colaboradorId: diego.id, dataHora: amanha }, 1000);
  await nav.esperarAte("/\\/feedback\\/[0-9a-f-]{36}$/.test(location.pathname)");
  e = await nav.estado();
  checar("Gestor agenda 1:1 com liderado e abre a ficha", /1:1 · Diego Ferreira/.test(e.texto), e.url);

  // PDI: criar, ativação recusada sem ações, incluir objetivo/ação, ativar
  e = await nav.ir("/pdi");
  await formulario(nav, "f.querySelector('select[name=colaboradorId]') && f.querySelector('input[name=titulo]')", { colaboradorId: diego.id, titulo: "PDI E2E Diego" }, 1000);
  await nav.esperarAte("/\\/pdi\\/[0-9a-f-]{36}$/.test(location.pathname)");
  const pdiDiego = await um("select id, status from pdis where colaborador_id=$1 and status='rascunho'", [diego.id]);
  checar("Gestor cria PDI em rascunho para liderado", !!pdiDiego);
  await nav.esperarEstavel();
  await formulario(nav, "f.querySelector('input[name=acao][value=ativar]')");
  checar("Ativação sem ações é recusada", /ao menos um objetivo/.test(await nav.mensagem()), await nav.mensagem());
  await formulario(nav, "f.querySelector('input[name=competencia]')", { titulo: "Dominar observabilidade", competencia: "Técnica" });
  await nav.ir(`/pdi/${pdiDiego.id}`);
  await formulario(nav, "f.querySelector('input[name=objetivoId]') && f.querySelector('select[name=tipo]')", { titulo: "Instrumentar serviço de pagamentos", tipo: "projeto" });
  await nav.ir(`/pdi/${pdiDiego.id}`);
  await formulario(nav, "f.querySelector('input[name=acao][value=ativar]')");
  checar("PDI ativado após objetivo e ação", (await um("select status from pdis where id=$1", [pdiDiego.id])).status === "ativo");

  // ── 3. Colaboradora ──
  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir(`/feedback/${reuniao.id}`);
  checar("Colaboradora vê a própria privada e as compartilhadas", /pedir feedback mais frequente/.test(e.texto) && /Anotação compartilhada E2E do gestor/.test(e.texto));
  checar("Colaboradora NÃO vê a nota privada do gestor", !/avaliar a Carla para liderar/.test(e.texto));
  checar("Colaboradora não registra compromissos nem gerencia a reunião", !(await nav.avaliar("!!document.querySelector('input[name=descricao]') || document.body.innerText.includes('Marcar como realizada') || document.body.innerText.includes('Reabrir como agendada')")));
  const apresentar = await compromisso("Apresentar o roadmap de design para a liderança de produto");
  // Concluir a ação de PDI (sem evidência → recusado; com evidência → conclui também o compromisso de origem)
  const acaoApresentar = await um("select id from acoes_pdi where compromisso_origem_id=$1", [apresentar.id]);
  await nav.ir(`/pdi/${pdiCarla.id}`);
  await formulario(nav, `f.querySelector('input[name=acaoId][value="${acaoApresentar.id}"]')`, { status: "concluida" });
  checar("Concluir ação sem evidência é recusado", /evidência/.test(await nav.mensagem()), await nav.mensagem());
  await nav.ir(`/pdi/${pdiCarla.id}`);
  await formulario(nav, `f.querySelector('input[name=acaoId][value="${acaoApresentar.id}"]')`, { status: "concluida", evidencia: "Apresentação feita em 12/10 para a diretoria." });
  checar("Ação concluída com evidência conclui o compromisso de origem", (await compromisso("Apresentar o roadmap de design para a liderança de produto")).status === "concluido");
  checar("Colaboradora não vê ativar/concluir/arquivar o próprio PDI", !(await nav.avaliar("!!document.querySelector('input[name=acao][value=concluir]') || !!document.querySelector('input[name=acao][value=arquivar]')")));
  await formulario(nav, "f.querySelector('textarea[name=texto]') && f.querySelector('input[name=pdiId]')", { texto: "Comentário E2E da colaboradora" });
  checar("Colaboradora comenta no próprio PDI", !!(await um("select 1 from registros_pdi where texto='Comentário E2E da colaboradora' and tipo='comentario'")));
  e = await nav.ir(`/pdi/${pdiDiego.id}`);
  checar("Colaboradora não abre o PDI de colega (404)", !/PDI E2E Diego/.test(e.texto));
  e = await nav.ir("/feedback/modelos");
  checar("Colaboradora não acessa modelos de pauta", !e.url.startsWith("/feedback/modelos"), e.url);

  // ── 4. Administradora e RH: metadados sem anotações ──
  e = await nav.entrar("ana@aurora.test");
  e = await nav.ir(`/feedback/${reuniao.id}`);
  checar("Administradora vê compromissos mas nenhuma anotação", /Apresentar o roadmap/.test(e.texto) && /visíveis apenas aos participantes/.test(e.texto) && !/Anotação compartilhada E2E/.test(e.texto) && !/avaliar a Carla/.test(e.texto));
  e = await nav.ir("/feedback/modelos");
  checar("Administradora gerencia modelos de pauta", /1:1 quinzenal/.test(e.texto) && /Novo modelo/.test(e.texto));
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir(`/feedback/${reuniao.id}`);
  checar("RH vê metadados sem anotações e sem gestão", /visíveis apenas aos participantes/.test(e.texto) && !/Gestão da reunião/.test(e.texto));

  // ── 5. Isolamento: Bravo (sem Feedback/PDI) ──
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/feedback/${reuniao.id}`);
  checar("Bravo não acessa Feedback da Aurora", e.url.startsWith("/inicio?bloqueado=feedback"), e.url);
  e = await nav.ir(`/pdi/${pdiCarla.id}`);
  checar("Bravo não acessa PDI da Aurora", e.url.startsWith("/inicio?bloqueado=pdi"), e.url);
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
