// Testes E2E de administração: módulos (entitlements), suporte, convites e permissões.
// Uso: node scripts/e2e/administracao.mjs   (app em localhost:3020, seed aplicado)
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador } from "./navegador.mjs";

// Sempre o .env.local do projeto, independentemente da pasta de onde o script é executado.
config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const BRAVO = (await um("select id from organizacoes where slug='bravo-logistica'")).id;
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}
const produtos = (t) => (t.split("Seus produtos")[1] ?? "").split(/Para você acompanhar|Conhecer outros produtos/)[0];
const fimEmDias = (d) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

/** Envia o formulário de módulo (página da organização na administração). */
async function alterarModulo(nav, modulo, status, fim, motivo) {
  const pronto = await nav.esperarAte(`document.querySelector('input[name=modulo][value=${modulo}]')`);
  if (!pronto) throw new Error("Formulário do módulo não carregou.");
  const antes = await um("select atualizado_em from entitlements where tenant_id=$1 and modulo=$2", [BRAVO, modulo]);
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=modulo][value=${modulo}]'));
    const set=(n,v)=>{const el=f.querySelector('[name='+n+']');const pr=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(pr,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    set('status','${status}');set('fim','${fim}');set('motivo','${motivo}');f.requestSubmit();})()`);
  // Espera a gravação de fato (atualizado_em muda), sem depender de pausa fixa.
  for (let i = 0; i < 40; i++) {
    const agora = await um("select atualizado_em from entitlements where tenant_id=$1 and modulo=$2", [BRAVO, modulo]);
    if (agora && (!antes || agora.atualizado_em.getTime() !== antes.atualizado_em.getTime())) return;
    await esperar(500);
  }
  throw new Error(`Mudança do módulo ${modulo} não foi gravada.`);
}

const nav = await abrirNavegador(9445);
try {
  // 1. Superadmin ativa Onboarding em teste para a Bravo
  let e = await nav.entrar("admin@journeylab.local");
  checar("Superadmin cai na administração", e.url.startsWith("/plataforma"), e.url);
  e = await nav.ir(`/plataforma/organizacoes/${BRAVO}`);
  await alterarModulo(nav, "onboarding", "teste", fimEmDias(30), "Periodo de teste comercial (E2E)");
  const ent = await um("select status, fim from entitlements where tenant_id=$1 and modulo='onboarding'", [BRAVO]);
  checar("Entitlement gravado como teste com expiração", ent?.status === "teste" && !!ent.fim);
  const hist = await um("select responsavel_nome, motivo, origem from historico_entitlements where tenant_id=$1 and modulo='onboarding' order by criado_em desc limit 1", [BRAVO]);
  checar("Histórico registra responsável, origem e motivo", hist?.responsavel_nome === "Equipe JourneyLab" && hist.origem === "manual" && /E2E/.test(hist.motivo));

  e = await nav.entrar("helena@bravo.test");
  checar("Bravo passa a ver Onboarding (em teste)", produtos(e.texto).includes("Onboarding") && /Em teste/.test(produtos(e.texto)));
  e = await nav.ir("/configuracoes/modulos");
  checar("Bravo vê o histórico do módulo", /Periodo de teste comercial \(E2E\)/.test(e.texto));

  // 2. Suspensão bloqueia sem apagar dados
  await nav.entrar("admin@journeylab.local");
  await nav.ir(`/plataforma/organizacoes/${BRAVO}`);
  await alterarModulo(nav, "onboarding", "suspenso", "", "Suspensao de teste (E2E)");
  e = await nav.entrar("helena@bravo.test");
  checar("Módulo suspenso some do início", !produtos(e.texto).includes("Onboarding"));
  const hist2 = (await adm.query("select status_anterior, status_novo from historico_entitlements where tenant_id=$1 and modulo='onboarding' order by criado_em", [BRAVO])).rows;
  checar("Histórico mantém as duas mudanças", hist2.length >= 2 && hist2.at(-1).status_anterior === "teste" && hist2.at(-1).status_novo === "suspenso");

  // 3. Acesso de suporte: somente leitura
  await nav.entrar("admin@journeylab.local");
  await nav.ir(`/plataforma/organizacoes/${AURORA}`);
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('textarea[name=motivo]') && f.querySelector('[name=horas]'));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(f.querySelector('textarea[name=motivo]'),'Chamado E2E - verificar cadastro de equipes');f.requestSubmit();})()`);
  await esperar(4000);
  e = await nav.estado();
  checar("Suporte abre a Aurora com faixa de aviso", e.url.startsWith("/inicio") && /somente leitura/.test(await nav.avaliar("document.body.innerText")));
  e = await nav.ir("/colaboradores/nova");
  checar("Suporte não pode criar pessoa (redirecionado)", !e.url.startsWith("/colaboradores/nova"), e.url);
  e = await nav.ir("/equipes");
  checar("Suporte vê equipes sem formulários de edição", /Produto/.test(e.texto) && !/Nova equipe/.test(e.texto));
  const audSup = await um("select count(*)::int n from auditoria where tenant_id=$1 and acao='suporte.iniciar'", [AURORA]);
  checar("Início do suporte auditado na organização", audSup.n >= 1);
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>/Encerrar suporte/.test(f.textContent)).requestSubmit()`);
  await esperar(3000);
  e = await nav.ir("/inicio");
  checar("Após encerrar, superadmin não tem mais acesso à Aurora", !e.url.startsWith("/inicio") || !/Aurora Tecnologia/.test(e.texto), e.url);

  // 4. Admin da organização convida usuário (e-mail real no Mailpit)
  e = await nav.entrar("ana@aurora.test");
  e = await nav.ir("/configuracoes/usuarios");
  const email = `convidado.${Date.now()}@aurora.test`;
  const papelRh = (await um("select id from papeis where tenant_id=$1 and base='rh'", [AURORA])).id;
  await nav.preencher({ "input[name=email]": email, "input[name=nome]": "Pessoa Convidada", "select[name=papelId]": papelRh });
  e = await nav.enviar("input[name=email]", 4500);
  checar("Convite enviado pela administradora", /Convite enviado/.test(await nav.mensagem()), await nav.mensagem());
  const mail = await (await fetch(`http://127.0.0.1:54524/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
  checar("E-mail de convite JourneyLab entregue", mail.messages?.[0]?.Subject === "Seu acesso ao JourneyLab", mail.messages?.[0]?.Subject);
  const assoc = await um("select a.status, p.base from associacoes a join usuarios u on u.id=a.usuario_id join papeis p on p.id=a.papel_id where u.email=$1", [email]);
  checar("Associação criada com o papel escolhido", assoc?.base === "rh" && assoc.status === "ativa");

  // 5. RH cria pessoa; gestor não pode
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/colaboradores/nova");
  await nav.preencher({ "input[name=nome]": "Pessoa Criada E2E", "input[name=email]": `pessoa.${Date.now()}@aurora.test`, "input[name=cargo]": "Analista" });
  e = await nav.enviar("input[name=nome]", 4000);
  // Sem data de admissão: a ficha abre com o aviso de que o onboarding não foi criado.
  checar("RH cadastra pessoa e abre a ficha", /^\/colaboradores\/[0-9a-f-]{36}(\?onboarding=sem_data)?$/.test(e.url), e.url);
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir("/colaboradores/nova");
  checar("Gestor não acessa cadastro de nova pessoa", !e.url.startsWith("/colaboradores/nova"), e.url);
} finally {
  nav.fechar();
  // Limpeza: devolve a Bravo ao estado do seed (entitlement e histórico ficam como registro).
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
