// Testes E2E do Onboarding (v2): acesso por papel e por contratação, isolamento, status por data,
// tarefas (botões e arrastar no Kanban), progresso e conclusão automáticos, criação automática
// no cadastro, templates por área, fuso horário, lembrete por e-mail e painel.
// Uso: node journeylab/scripts/e2e/onboarding.mjs   (app em localhost:3020; Mailpit em 54524)
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
const MAILPIT = "http://127.0.0.1:54524";

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}
/** Espera uma condição no banco (sem tempo fixo — a rota pode estar compilando). */
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
const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

// ── Preparação: estado do seed ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from onboardings where tenant_id=$1", [AURORA]);
await adm.query("delete from colaboradores where tenant_id=$1 and email like 'e2e.%'", [AURORA]);
await adm.query("delete from modelos_onboarding where tenant_id=$1 and nome like '%E2E%'", [AURORA]);
await adm.query("update colaboradores set status='pre_admissao' where email in ('otavio@aurora.test','rita@aurora.test')");
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });

const onbDe = (email) => um("select o.* from onboardings o join colaboradores c on c.id=o.colaborador_id where c.email=$1 and o.status <> 'cancelado' order by o.criado_em desc limit 1", [email]);
const tarefa = (onbId, titulo) => um("select * from tarefas_onboarding where onboarding_id=$1 and titulo=$2", [onbId, titulo]);
const otavio = await onbDe("otavio@aurora.test");
const rita = await onbDe("rita@aurora.test");
const marina = await onbDe("marina@aurora.test");

/** Clica num botão de ação rápida dentro do item da tarefa. */
const clicar = (nav, tarefaId, texto) =>
  nav.avaliar(`(()=>{const b=[...document.querySelectorAll('#tarefa-${tarefaId} button')].find(b=>b.textContent.trim()==='${texto}');if(!b)return false;b.click();return true;})()`);
const enviarLembrete = (nav) =>
  nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=onboardingId]') && /Enviar lembrete/.test(f.textContent)).requestSubmit()`);

const nav = await abrirNavegador(9453);
try {
  // ── 1. Contratação e papéis ──
  let e = await nav.entrar("helena@bravo.test");
  e = await nav.ir("/onboarding");
  checar("Empresa sem Onboarding contratado não acessa a rota", e.url.startsWith("/inicio?bloqueado=onboarding"), e.url);
  e = await nav.ir(`/onboarding/${otavio.id}`);
  checar("…nem um onboarding de outra empresa pela URL", e.url.startsWith("/inicio?bloqueado=onboarding") && !/Otávio/.test(e.texto), e.url);

  e = await nav.entrar("carla@aurora.test");
  checar("Colaborador não vê Onboarding no menu nem no painel", !/Alertas de onboarding/.test(e.texto) && !(await nav.avaliar("[...document.querySelectorAll('nav a')].some(a=>a.getAttribute('href')==='/onboarding')")));
  e = await nav.ir(`/onboarding/${otavio.id}`);
  checar("Colaborador não acessa o módulo (URL direta)", e.url.startsWith("/inicio?sem_permissao=onboarding"), e.url);
  // Mesmo que um administrador conceda "próprio" ao papel de colaborador, o escopo mínimo bloqueia.
  await adm.query(
    `insert into papel_permissoes (id, tenant_id, papel_id, area, acao, escopo)
     select gen_random_uuid(), p.tenant_id, p.id, 'onboarding', 'visualizar', 'proprio' from papeis p where p.tenant_id=$1 and p.base='colaborador'
     on conflict (papel_id, area, acao) do nothing`,
    [AURORA],
  );
  e = await nav.entrar("otavio@aurora.test");
  e = await nav.ir(`/onboarding/${otavio.id}`);
  checar("Escopo “próprio” concedido não dá acesso (escopo mínimo no servidor)", e.url.startsWith("/inicio?sem_permissao=onboarding"), e.url);
  await adm.query("delete from papel_permissoes where area='onboarding' and papel_id in (select id from papeis where tenant_id=$1 and base='colaborador')", [AURORA]);

  // ── 2. Gestor: só a própria equipe ──
  e = await nav.entrar("bruno@aurora.test");
  checar("Gestor vê o painel de alertas de onboarding", /Alertas de onboarding/.test(e.texto) && /Reunião com o gestor direto/.test(e.texto));
  e = await nav.ir("/onboarding");
  checar("Gestor lista só os subordinados diretos", /Otávio Pires/.test(e.texto) && /Rita Campos/.test(e.texto) && !/Marina Costa/.test(e.texto));
  e = await nav.ir(`/onboarding/${marina.id}`);
  checar("Gestor não abre onboarding de outra equipe (404)", !/Marina Costa/.test(e.texto));
  e = await nav.ir(`/onboarding/${otavio.id}`);
  const rhTarefa = await tarefa(otavio.id, "Avaliação final do onboarding");
  checar("Gestor não tem ações em tarefas de RH", !(await nav.avaliar(`!!document.querySelector('#tarefa-${rhTarefa.id} button')`)));
  checar("Tarefa que vence hoje aparece como “Vence hoje”", /Vence hoje/.test(e.texto));
  const conhecer = await tarefa(otavio.id, "Conhecer o time");
  const dataTela = await nav.avaliar(`document.querySelector('#tarefa-${conhecer.id}').textContent`);
  const dia = conhecer.prazo.toISOString().slice(8, 10);
  checar("Data exibida = data gravada (sem deslocamento de fuso)", new RegExp(`prazo ${dia} de`).test(dataTela), `${conhecer.prazo.toISOString().slice(0, 10)} → ${dataTela.match(/prazo [^·(]+/)?.[0]}`);
  const politicas = await tarefa(otavio.id, "Leitura das políticas da empresa");
  await clicar(nav, politicas.id, "Concluir");
  const pol = await ateNoBanco("select status from tarefas_onboarding where id=$1", [politicas.id], (r) => r?.status === "concluida");
  checar("Gestor conclui tarefa do colaborador (acompanhada por gestor/RH)", pol?.status === "concluida");
  const o1 = await um("select progresso from onboardings where id=$1", [otavio.id]);
  checar("Progresso recalculado na mesma operação (2/12 = 17%)", o1.progresso === 17, `${o1.progresso}%`);

  // ── 3. RH: botões, bloqueio com motivo, Kanban (arrastar) ──
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir(`/onboarding/${otavio.id}`);
  const entender = await tarefa(otavio.id, "Entender os processos da área");
  await clicar(nav, entender.id, "Iniciar");
  const t1 = await ateNoBanco("select status, iniciada_em from tarefas_onboarding where id=$1", [entender.id], (r) => r?.status === "em_andamento");
  checar("Iniciar tarefa persiste status e data de início", t1?.status === "em_andamento" && !!t1.iniciada_em);
  await nav.ir(`/onboarding/${otavio.id}`);
  await clicar(nav, entender.id, "Bloquear");
  await nav.esperarAte("!!document.querySelector('#motivo-tarefa')");
  await nav.avaliar(`(()=>{const t=document.querySelector('#motivo-tarefa');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Aguardando acesso ao ambiente');t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await esperar(300);
  await nav.avaliar("document.querySelector('#motivo-tarefa').form.requestSubmit()");
  const t2 = await ateNoBanco("select status, bloqueio_motivo from tarefas_onboarding where id=$1", [entender.id], (r) => r?.status === "bloqueada");
  checar("Bloquear exige e grava o motivo", t2?.status === "bloqueada" && t2.bloqueio_motivo === "Aguardando acesso ao ambiente");
  checar("Tarefa bloqueada não aumenta o progresso", (await um("select progresso from onboardings where id=$1", [otavio.id])).progresso === 17);

  e = await nav.ir(`/onboarding/${otavio.id}?visao=kanban`);
  await nav.esperarAte("!!document.querySelector('[data-coluna=concluida]')");
  const participar = await tarefa(otavio.id, "Participar de reuniões do time");
  await nav.avaliar(`(()=>{const dt=new DataTransfer();const card=document.querySelector('[data-tarefa="${participar.id}"]');const col=document.querySelector('[data-coluna=concluida]');
    card.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
    col.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
    col.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
    card.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));})()`);
  const t3 = await ateNoBanco("select status from tarefas_onboarding where id=$1", [participar.id], (r) => r?.status === "concluida");
  checar("Arrastar no Kanban persiste no banco", t3?.status === "concluida");
  const o2 = await ateNoBanco("select progresso from onboardings where id=$1", [otavio.id], (r) => r?.progresso === 25);
  checar("…e usa o mesmo recálculo de progresso (3/12 = 25%)", o2?.progresso === 25, `${o2?.progresso}%`);
  await nav.ir(`/onboarding/${otavio.id}?visao=kanban`);
  await nav.esperarAte(`!!document.querySelector('[data-coluna=concluida] [data-tarefa="${participar.id}"]')`);
  checar("Após recarregar, o cartão está na coluna Concluída", await nav.avaliar(`!!document.querySelector('[data-coluna=concluida] [data-tarefa="${participar.id}"]')`));

  // ── 4. Conclusão automática e reabertura ──
  await adm.query("update tarefas_onboarding set status='concluida', bloqueio_motivo=null where onboarding_id=$1 and titulo <> 'Avaliação final do onboarding'", [otavio.id]);
  await nav.ir(`/onboarding/${otavio.id}`);
  await clicar(nav, rhTarefa.id, "Concluir");
  const fim = await ateNoBanco("select o.status, o.progresso, c.status as pessoa from onboardings o join colaboradores c on c.id=o.colaborador_id where o.id=$1", [otavio.id], (r) => r?.status === "concluido");
  checar("Última obrigatória concluída → “Concluído” automaticamente e pessoa ativa", fim?.status === "concluido" && fim.progresso === 100 && fim.pessoa === "ativo", JSON.stringify(fim));
  await nav.ir(`/onboarding/${otavio.id}`);
  await clicar(nav, rhTarefa.id, "Reabrir");
  const reab = await ateNoBanco("select status, progresso from onboardings where id=$1", [otavio.id], (r) => r?.status === "em_andamento");
  checar("Reabrir uma obrigatória volta o onboarding para “Em andamento”", reab?.status === "em_andamento" && reab.progresso === 92, JSON.stringify(reab));

  // ── 5. “Não iniciado” muda sozinho quando a data chega ──
  e = await nav.ir(`/onboarding/${rita.id}`);
  checar("Início futuro mostra “Não iniciado”", /Não iniciado/.test(e.texto) && /Antes do início/.test(e.texto));
  await adm.query("update onboardings set inicio=$2::date where id=$1", [rita.id, hojeSP]);
  e = await nav.ir(`/onboarding/${rita.id}`);
  checar("Com a data de início chegando, passa a “Em andamento” (sem rotina agendada)", /Em andamento/.test(e.texto) && !/Antes do início/.test(e.texto));

  // ── 6. Lembrete por e-mail ao gestor ──
  await nav.ir(`/onboarding/${otavio.id}`);
  await enviarLembrete(nav);
  await ateNoBanco("select lembrete_em from onboardings where id=$1", [otavio.id], (r) => !!r?.lembrete_em);
  let caixa = { messages: [] };
  for (let i = 0; i < 20 && !caixa.messages.length; i++) {
    caixa = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:bruno@aurora.test")}`)).json();
    if (!caixa.messages.length) await esperar(500);
  }
  const msg = caixa.messages[0];
  checar("Lembrete chega ao e-mail do gestor com nome e progresso", !!msg && /Otávio Pires/.test(msg.Subject) && /92% concluído/.test(msg.Subject), msg?.Subject);
  const corpo = msg ? await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json() : null;
  checar("E-mail lista as tarefas pendentes", !!corpo && /Avaliação final do onboarding/.test(corpo.Text));
  await nav.ir(`/onboarding/${otavio.id}`);
  await enviarLembrete(nav);
  await nav.esperarAte("/última hora/.test(document.body.innerText)", 15000);
  checar("Reenvio na mesma hora é recusado com mensagem clara", /última hora/.test(await nav.mensagem()), await nav.mensagem());
  const nicolas = await um("select id, email from colaboradores where email='nicolas@aurora.test'");
  const ritaPessoa = await um("select id, gestor_id from colaboradores where email='rita@aurora.test'");
  await adm.query("update colaboradores set gestor_id=$1 where id=$2", [nicolas.id, ritaPessoa.id]);
  await adm.query("update colaboradores set email='nicolas-invalido' where id=$1", [nicolas.id]);
  e = await nav.ir(`/onboarding/${rita.id}`);
  checar("Gestor com e-mail inválido: lembrete indisponível com explicação", /não tem e-mail válido/.test(e.texto) && !/Enviar lembrete por e-mail/.test(e.texto));
  await adm.query("update colaboradores set email=$1 where id=$2", [nicolas.email, nicolas.id]);
  await adm.query("update colaboradores set gestor_id=null where id=$1", [ritaPessoa.id]);
  e = await nav.ir(`/onboarding/${rita.id}`);
  checar("Sem gestor: lembrete indisponível com explicação", /Defina o gestor/.test(e.texto));
  await adm.query("update colaboradores set gestor_id=$1 where id=$2", [ritaPessoa.gestor_id, ritaPessoa.id]);

  // ── 7. Template por área e criação automática no cadastro ──
  e = await nav.entrar("ana@aurora.test");
  e = await nav.ir("/onboarding/modelos");
  const tecnologia = await um("select id from areas where tenant_id=$1 and nome='Tecnologia'", [AURORA]);
  const nomeTpl = `Onboarding Tecnologia E2E ${Date.now()}`;
  await nav.preencher({ "input[name=nome]": nomeTpl, "select[name=areaId]": tecnologia.id });
  await nav.enviar("input[name=nome]", 1000);
  await nav.esperarAte("/\\/onboarding\\/modelos\\/[0-9a-f-]{36}$/.test(location.pathname)");
  const tpl = await um("select id from modelos_onboarding where nome=$1", [nomeTpl]);
  await nav.esperarEstavel();
  await nav.preencher({ "#nova-fase-titulo": "Integração técnica", "#nova-fase-marco": "15" });
  await nav.enviar("#nova-fase-titulo", 500);
  const fase = await ateNoBanco("select id from etapas_modelo where modelo_id=$1", [tpl.id], (r) => !!r);
  await nav.ir(`/onboarding/modelos/${tpl.id}`);
  await nav.esperarAte(`!!document.querySelector('#titulo-${fase.id}')`);
  await nav.preencher({ [`#titulo-${fase.id}`]: "Configurar ambiente de desenvolvimento", [`#resp-${fase.id}`]: "gestor" });
  await nav.enviar(`#titulo-${fase.id}`, 500);
  await ateNoBanco("select count(*)::int n from tarefas_modelo where etapa_id=$1", [fase.id], (r) => r?.n === 1);

  const produto = await um("select id from equipes where tenant_id=$1 and nome='Produto'", [AURORA]);
  const email = `e2e.${Date.now()}@aurora.test`;
  const futuro = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  e = await nav.ir("/colaboradores/nova");
  checar("Cadastro oferece a criação automática do onboarding", await nav.avaliar("!!document.querySelector('input[name=criarOnboarding]:checked')"));
  await nav.preencher({ "input[name=nome]": "Pessoa Nova E2E", "input[name=email]": email, "input[name=dataAdmissao]": futuro, "select[name=equipeId]": produto.id });
  await nav.enviar("input[name=nome]", 1000);
  await nav.esperarAte("location.search.includes('onboarding=')");
  e = await nav.estado();
  const novo = await onbDe(email);
  checar("Cadastro cria o onboarding automaticamente (origem cadastro) e avisa", !!novo && novo.origem === "cadastro" && /Onboarding criado automaticamente/.test(e.texto), e.url);
  checar("…com o template da área da pessoa", novo?.modelo_nome === nomeTpl, novo?.modelo_nome);
  checar("…e a data de entrada preservada (sem deslocamento)", novo?.inicio.toISOString().slice(0, 10) === futuro, novo?.inicio.toISOString());
  e = await nav.ir("/colaboradores/nova");
  await nav.preencher({ "input[name=nome]": "Pessoa Nova E2E", "input[name=email]": email, "input[name=dataAdmissao]": futuro });
  await nav.enviar("input[name=nome]", 3000);
  const qtd = await um("select count(*)::int n from onboardings o join colaboradores c on c.id=o.colaborador_id where c.email=$1", [email]);
  checar("Reenvio do cadastro não duplica pessoa nem onboarding", qtd.n === 1 && /Já existe/.test(await nav.mensagem()), await nav.mensagem());

  const semData = `e2e.semdata.${Date.now()}@aurora.test`;
  e = await nav.ir("/colaboradores/nova");
  await nav.preencher({ "input[name=nome]": "Sem Data E2E", "input[name=email]": semData });
  await nav.enviar("input[name=nome]", 1000);
  await nav.esperarAte("location.search.includes('onboarding=')");
  e = await nav.estado();
  checar("Sem data de admissão: cadastro salvo e aviso claro, sem onboarding", /informe a data de admissão/.test(e.texto) && !(await onbDe(semData)));

  const pessoaNova = await um("select id from colaboradores where email=$1", [email]);
  e = await nav.ir("/onboarding/novo");
  checar("Criação manual não oferece quem já tem onboarding ativo", !(await nav.avaliar(`!!document.querySelector('select[name=colaboradorId] option[value="${pessoaNova.id}"]')`)));
  const semDataPessoa = await um("select id from colaboradores where email=$1", [semData]);
  await nav.preencher({ "select[name=colaboradorId]": semDataPessoa.id, "input[name=inicio]": hojeSP });
  await nav.enviar("select[name=colaboradorId]", 1000);
  await nav.esperarAte("/\\/onboarding\\/[0-9a-f-]{36}$/.test(location.pathname)");
  const manual = await onbDe(semData);
  checar("Criação manual com o template aplicável (padrão 30/60/90 para quem não tem área)", manual?.origem === "manual" && manual.modelo_nome === "Onboarding 30/60/90", manual?.modelo_nome);
  await adm.query("update modelos_onboarding set ativo=false where id=$1", [tpl.id]);

  // ── 8. Painel e visualizações ──
  await adm.query("update tarefas_onboarding set prazo = $2::date - 1, prazo_fixo = true where onboarding_id=$1 and titulo='Conhecer o time'", [rita.id, hojeSP]);
  e = await nav.ir("/inicio");
  checar("Painel da administradora mostra alertas de onboarding com link direto", /Alertas de onboarding/.test(e.texto) && (await nav.avaliar("[...document.querySelectorAll('a')].some(a=>/^\\/onboarding\\/[0-9a-f-]{36}#tarefa-/.test(a.getAttribute('href')||''))")));
  e = await nav.ir("/onboarding?visao=kanban");
  checar("Visualização Kanban por situação", /Não iniciado/.test(e.texto) && /Concluído/.test(e.texto) && /Marina Costa/.test(e.texto));
  e = await nav.ir("/onboarding?visao=painel");
  checar("Visualização Painel com alertas e pendências por responsável", /Pendências por responsável/.test(e.texto) && /Em andamento por fase/.test(e.texto));
  e = await nav.ir("/onboarding?q=Marina");
  checar("Busca por nome", /Marina Costa/.test(e.texto) && !/Otávio Pires/.test(e.texto));
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
