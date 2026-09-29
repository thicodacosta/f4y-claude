// Testes E2E do Onboarding (dados do seed).
// Uso: node journeylab/scripts/e2e/onboarding.mjs   (app em localhost:3020, seed aplicado)
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
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

/** Envia o formulário de ação de uma tarefa (concluir/dispensar/reabrir). */
async function acaoTarefa(nav, tarefaId, acao, observacao) {
  const ok = await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=tarefaId][value="${tarefaId}"]') && f.querySelector('input[name=acao][value=${acao}]'));
    if(!f) return false; ${observacao ? `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f.querySelector('input[name=observacao]'),${JSON.stringify(observacao)});` : ""} f.requestSubmit(); return true;})()`);
  await esperar(3000);
  return ok;
}

// ── Preparação: cada execução parte do mesmo estado ──
// 1) Onboarding do Otávio volta ao estado do seed (apagado e recriado pelo seed idempotente).
await adm.query("delete from onboardings where colaborador_id = (select id from colaboradores where email='otavio@aurora.test')");
await adm.query("update colaboradores set status='pre_admissao' where email='otavio@aurora.test'");
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
// 2) Encerra onboardings de teste abertos do Nicolas (a regra permite só um em andamento).
await adm.query("update onboardings set status='cancelado' where status='em_andamento' and colaborador_id = (select id from colaboradores where email='nicolas@aurora.test')");
// 3) Candidato novo para a conversão CRM → colaborador → onboarding.
const sufixo = Date.now();
const candConv = await um(
  `insert into candidatos (id, tenant_id, nome, email, email_norm, nome_norm, competencias, criado_por, atualizado_em)
   values (gen_random_uuid(), $1, $2, $3, $3, $4, '{}', 'E2E', now()) returning id`,
  [AURORA, `Conversão E2E ${sufixo}`, `conversao.${sufixo}@exemplo.test`, `conversao e2e ${sufixo}`],
);
const onb = await um("select o.id from onboardings o join colaboradores c on c.id=o.colaborador_id where c.email='otavio@aurora.test' and o.status='em_andamento'");
const tarefa = async (titulo) => um("select id, status from tarefas_onboarding where onboarding_id=$1 and titulo=$2", [onb.id, titulo]);

const nav = await abrirNavegador(9447);
try {
  // 1. Gestor: tarefa atrasada no painel; conclui a própria; não vê ações de RH
  let e = await nav.entrar("bruno@aurora.test");
  checar("Painel do gestor mostra tarefa de onboarding atrasada", /Tarefas de onboarding/.test(e.texto) && /Reunião de alinhamento/.test(e.texto) && /Atrasada/.test(e.texto));
  e = await nav.ir(`/onboarding/${onb.id}`);
  checar("Gestor vê o onboarding da sua equipe", /Otávio Pires/.test(e.h1) || /Otávio Pires/.test(e.texto));
  const reuniao = await tarefa("Reunião de alinhamento de expectativas");
  await acaoTarefa(nav, reuniao.id, "concluir");
  checar("Gestor conclui a própria tarefa", (await tarefa("Reunião de alinhamento de expectativas")).status === "concluida");
  const pesquisa = await tarefa("Pesquisa de experiência de integração");
  const botaoRh = await nav.avaliar(`!!document.querySelector('input[name=tarefaId][value="${pesquisa.id}"]')`);
  checar("Gestor não tem ação em tarefa de RH", !botaoRh);
  checar("Gestor não vê “Dispensar” nem “Concluir onboarding”", !(await nav.avaliar("document.body.innerText.includes('Dispensar…') || document.body.innerText.includes('Concluir onboarding')")));

  // 2. Novo colaborador: boas-vindas e só as próprias tarefas
  e = await nav.entrar("otavio@aurora.test");
  e = await nav.ir(`/onboarding/${onb.id}`);
  checar("Colaborador vê mensagem de boas-vindas e materiais", /Boas-vindas, Otávio/.test(e.texto) && /Guia de cultura/.test(e.texto));
  const guia = await tarefa("Guia de cultura e jeito de trabalhar");
  await acaoTarefa(nav, guia.id, "concluir");
  checar("Colaborador conclui a própria tarefa", (await tarefa("Guia de cultura e jeito de trabalhar")).status === "concluida");
  const checkpoint = await tarefa("Checkpoint de 30 dias");
  checar("Colaborador não tem ação em tarefa do gestor", !(await nav.avaliar(`!!document.querySelector('input[name=tarefaId][value="${checkpoint.id}"]')`)));
  e = await nav.ir("/pessoas");
  checar("Colaborador não acessa o cadastro geral", !e.url.startsWith("/pessoas"), e.url);

  // 3. Outra colaboradora não enxerga
  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir(`/onboarding/${onb.id}`);
  checar("Colega fora do onboarding não o acessa (404)", !/Otávio Pires/.test(e.texto), e.h1);

  // 4. RH: concluir com pendências é recusado; dispensa com motivo; conclusão ativa a pessoa
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir(`/onboarding/${onb.id}`);
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=onboardingId]') && /Concluir onboarding/.test(f.textContent)).requestSubmit()`);
  await esperar(3000);
  checar("Conclusão com pendências é recusada", /pendente/.test(await nav.mensagem()), await nav.mensagem());
  for (const t of ["Checkpoint de 30 dias", "Pesquisa de experiência de integração"]) {
    await nav.ir(`/onboarding/${onb.id}`);
    await acaoTarefa(nav, (await tarefa(t)).id, "dispensar", "Encerramento antecipado (E2E)");
  }
  checar("RH dispensa tarefas com motivo", (await tarefa("Checkpoint de 30 dias")).status === "dispensada");
  await nav.ir(`/onboarding/${onb.id}`);
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=onboardingId]') && /Concluir onboarding/.test(f.textContent)).requestSubmit()`);
  await esperar(3500);
  const fim = await um("select o.status, c.status as pessoa from onboardings o join colaboradores c on c.id=o.colaborador_id where o.id=$1", [onb.id]);
  checar("Onboarding concluído e pessoa passa a ativa", fim.status === "concluido" && fim.pessoa === "ativo", JSON.stringify(fim));

  // 5. RH cria modelo e inicia onboarding pela tela
  e = await nav.ir("/onboarding/modelos");
  const nomeModelo = `Modelo E2E ${Date.now()}`;
  await nav.preencher({ "input[name=nome]": nomeModelo });
  await nav.enviar("input[name=nome]", 1000);
  await nav.esperarAte("/\\/onboarding\\/modelos\\/[0-9a-f-]{36}$/.test(location.pathname)");
  await nav.esperarEstavel();
  // Espera pelo banco (não por tempo fixo): a rota pode estar compilando no primeiro acesso.
  const ateNoBanco = async (sql, p, ms = 20000) => {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if ((await um(sql, p))?.n > 0) return true;
      await esperar(500);
    }
    return false;
  };
  await nav.esperarAte("[...document.querySelectorAll('form')].some(f=>/Adicionar etapa/.test(f.textContent))");
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>/Adicionar etapa/.test(f.textContent));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f.querySelector('input[name=titulo]'),'Primeiro dia');f.requestSubmit();})()`);
  await ateNoBanco("select count(*)::int n from etapas_modelo e join modelos_onboarding m on m.id=e.modelo_id where m.nome=$1", [nomeModelo]);
  await nav.esperarAte("!!document.querySelector('select[name=responsavel]')");
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('select[name=responsavel]'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f.querySelector('input[name=titulo]'),'Apresentar o time');f.requestSubmit();})()`);
  await ateNoBanco("select count(*)::int n from tarefas_modelo t join etapas_modelo e on e.id=t.etapa_id join modelos_onboarding m on m.id=e.modelo_id where m.nome=$1", [nomeModelo]);
  const modelo = await um("select m.id, (select count(*)::int from tarefas_modelo t join etapas_modelo e on e.id=t.etapa_id where e.modelo_id=m.id) n from modelos_onboarding m where nome=$1", [nomeModelo]);
  checar("Modelo criado com etapa e tarefa", modelo?.n === 1, JSON.stringify(modelo));

  const nicolas = await um("select id from colaboradores where email='nicolas@aurora.test'");
  e = await nav.ir("/onboarding");
  await nav.preencher({ "select[name=colaboradorId]": nicolas.id, "select[name=modeloId]": modelo.id, "input[name=inicio]": new Date().toISOString().slice(0, 10) });
  await nav.enviar("select[name=colaboradorId]", 1000);
  await nav.esperarAte("/\\/onboarding\\/[0-9a-f-]{36}$/.test(location.pathname)");
  e = await nav.estado();
  checar("Onboarding iniciado pela tela abre a ficha com as tarefas do modelo", /Nicolas Reis/.test(e.texto) && /Apresentar o time/.test(e.texto), `${e.url} ${e.texto.slice(0, 200)}`);

  // 6. CRM → colaborador → onboarding no mesmo passo
  e = await nav.ir(`/crm/candidatos/${candConv.id}`);
  const padrao = await um("select id from modelos_onboarding where tenant_id=$1 and nome='Integração padrão'", [AURORA]);
  await nav.preencher({ "input[name=dataAdmissao]": "2026-11-03", "input[name=cargo]": "Desenvolvedora Back-end", "select[name=modeloOnboardingId]": padrao.id });
  await nav.enviar("input[name=dataAdmissao]", 1000);
  await nav.esperarAte("location.pathname.startsWith('/pessoas/')");
  e = await nav.estado();
  const conv = await um("select c.status, o.status as onb, (select count(*)::int from tarefas_onboarding t where t.onboarding_id=o.id) n from colaboradores c join onboardings o on o.colaborador_id=c.id where c.candidato_origem_id=$1", [candConv.id]);
  checar("Conversão no CRM inicia onboarding com as tarefas do modelo", conv?.onb === "em_andamento" && conv.n === 8 && /Onboarding/.test(e.texto), JSON.stringify(conv));

  // 7. Isolamento: Bravo (sem Onboarding ativo) não acessa
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir(`/onboarding/${onb.id}`);
  checar("Bravo não acessa onboarding da Aurora", !/Otávio Pires/.test(e.texto), e.url);
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
