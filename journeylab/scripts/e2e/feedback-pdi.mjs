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
  checar("Painel do gestor mostra próximo 1:1 e ações de PDI", /Próximos 1:1/.test(e.texto) && /Carla Mendes/.test(e.texto) && /Ações de PDI/.test(e.texto));
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
  await formulario(nav, `f.querySelector('input[name=compromissoId][value="${mapear.id}"]') && f.querySelector('select[name=focoId]')`, { focoId: "novo" });
  const acaoOrigem = await um("select a.id, a.pdi_id from acoes_pdi a where compromisso_origem_id=$1", [mapear.id]);
  checar("Compromisso levado ao PDI vira ação no PDI da pessoa", acaoOrigem?.pdi_id === pdiCarla.id);

  // Agendar novo 1:1 pela tela (agendamento em /feedback/agendar)
  const diego = await um("select id from colaboradores where email='diego@aurora.test'");
  e = await nav.ir(`/feedback/agendar?colaborador=${diego.id}`);
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await formulario(nav, "f.querySelector('select[name=colaboradorId]') && f.querySelector('select[name=horario]')", { data: amanha, horario: "09:30" }, 1000);
  await nav.esperarAte("/\\/feedback\\/[0-9a-f-]{36}$/.test(location.pathname)");
  e = await nav.estado();
  checar("Gestor agenda 1:1 com liderado e abre a ficha", /1:1 · Diego Ferreira/.test(e.texto), e.url);

  // Concluir no PDI a ação que veio de um compromisso de 1:1 conclui também o compromisso.
  const apresentar = await compromisso("Apresentar o roadmap de design para a liderança de produto");
  const acaoApresentar = await um("select id, descricao from acoes_pdi where compromisso_origem_id=$1", [apresentar.id]);
  await nav.ir(`/pdi/${pdiCarla.id}`);
  const form = `form[aria-label="Atualizar ${acaoApresentar.descricao}"]`;
  await nav.avaliar(`(()=>{const s=document.querySelector('${form} select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'concluida');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await esperar(300);
  await nav.avaliar(`document.querySelector('${form}').requestSubmit()`);
  const concluido = await (async () => {
    for (let i = 0; i < 40; i++) {
      if ((await compromisso(apresentar.descricao ?? "Apresentar o roadmap de design para a liderança de produto")).status === "concluido") return true;
      await esperar(400);
    }
    return false;
  })();
  checar("Ação de PDI concluída conclui o compromisso de origem", concluido);
  const pdiDiego = await um("select p.id from pdis p where p.colaborador_id=$1", [diego.id]);

  // ── 3. Colaboradora ──
  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir(`/feedback/${reuniao.id}`);
  // Nesta versão o colaborador não acessa o Feedback 1:1 (as anotações dele continuam preservadas e privadas no banco).
  checar("Colaboradora não acessa o Feedback 1:1 (nem pela URL da reunião)", e.url.startsWith("/inicio?sem_permissao=feedback") && !/avaliar a Carla/.test(e.texto), e.url);
  e = await nav.ir(`/pdi/${pdiCarla.id}`);
  checar("Colaboradora não acessa o PDI nesta versão (nem o próprio)", e.url.startsWith("/inicio?sem_permissao=pdi"), e.url);
  e = await nav.ir(`/pdi/${pdiDiego.id}`);
  checar("Colaboradora não abre o PDI de colega", e.url.startsWith("/inicio?sem_permissao=pdi"), e.url);
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
  checar("RH administra a reunião mas não lê anotações", /visíveis apenas aos participantes/.test(e.texto) && /Gestão da reunião/.test(e.texto) && !/Anotação compartilhada E2E/.test(e.texto));

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
