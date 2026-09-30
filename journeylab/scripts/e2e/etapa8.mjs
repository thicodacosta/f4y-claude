// Testes E2E da Etapa 8: compra → ativação (Kiwify/site), rotina diária, retenção, exportações e jornada integrada.
// Uso: node journeylab/scripts/e2e/etapa8.mjs   (app em localhost:3020)
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador, BASE } from "./navegador.mjs";

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
async function aguardarEvento(pedido, tipo, cond, ms = 15000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const e = await um("select * from eventos_integracao where pedido_id=$1 and tipo=$2 order by recebido_em desc limit 1", [pedido, tipo]);
    if (e && cond(e)) return e;
    await esperar(500);
  }
  return um("select * from eventos_integracao where pedido_id=$1 and tipo=$2 order by recebido_em desc limit 1", [pedido, tipo]);
}
const kiwify = (corpo, token = process.env.KIWIFY_WEBHOOK_TOKEN) =>
  fetch(`${BASE}/api/webhooks/kiwify?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
const ent = (modulo) => um("select e.* from entitlements e join organizacoes o on o.id=e.tenant_id where o.slug='bravo-logistica' and e.modulo=$1", [modulo]);

// ── Preparação ──
const BRAVO = (await um("select id from organizacoes where slug='bravo-logistica'")).id;
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("update organizacoes set identificadores_externos='{@bravo.test}' where id=$1", [BRAVO]);
await adm.query(
  `insert into produtos_externos (id, canal, id_externo, descricao, modulos, duracao_dias, ativo)
   values (gen_random_uuid(), 'kiwify', 'prod-e2e', 'Pacote Desenvolvimento (E2E)', '{pdi,feedback}', 365, true)
   on conflict (canal, id_externo) do update set modulos='{pdi,feedback}', duracao_dias=365, ativo=true`,
);
await adm.query(
  `insert into produtos_externos (id, canal, id_externo, descricao, modulos, duracao_dias, ativo)
   values (gen_random_uuid(), 'site', 'site-e2e', 'Onboarding pelo site (E2E)', '{onboarding}', null, true)
   on conflict (canal, id_externo) do nothing`,
);
const pedido = `E2E-${Date.now()}`;
const crmAntes = await ent("crm");

const nav = await abrirNavegador(9452);
try {
  // ── 1. Webhook Kiwify: grava, interpreta e aguarda revisão (ativação automática desligada) ──
  let r = await kiwify({ order_id: pedido, webhook_event_type: "order_approved", Product: { product_id: "prod-e2e" }, Customer: { email: "Compras@Bravo.test", CNPJ: "12.345.678/0001-90" } });
  checar("Webhook Kiwify responde 200", r.status === 200);
  let ev = await aguardarEvento(pedido, "aprovado", (e) => !!e.organizacao_id);
  checar("Evento interpretado: compra aprovada, produto e organização identificados", ev?.organizacao_id === BRAVO && ev.produto_id_externo === "prod-e2e" && ev.comprador_documento === "12345678000190", JSON.stringify({ org: ev?.organizacao_id, erro: ev?.erro }));
  checar("Sem ativação automática: aguarda revisão e não muda acessos", ev?.status === "recebido" && (await ent("pdi"))?.referencia_externa !== pedido, ev?.erro);

  r = await kiwify({ order_id: `${pedido}-x`, webhook_event_type: "order_approved", Product: { product_id: "prod-e2e" } }, "token-errado");
  const falso = await um("select status, erro from eventos_integracao where corpo->>'order_id'=$1", [`${pedido}-x`]);
  checar("Token incorreto: evento gravado como ignorado", falso?.status === "ignorado", falso?.erro);

  // ── 2. Superadmin aplica ──
  let e = await nav.entrar("admin@journeylab.local");
  e = await nav.ir("/plataforma/integracoes?status=recebido");
  checar("Superadmin vê o evento interpretado", e.texto.includes(pedido) && /Compra aprovada/.test(e.texto) && /Pacote Desenvolvimento/.test(e.texto));
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=eventoId][value="${ev.id}"]') && f.querySelector('select[name=organizacaoId]')).requestSubmit()`);
  await esperar(3500);
  const pdi = await ent("pdi");
  const fb = await ent("feedback");
  const dias = pdi?.fim ? Math.round((new Date(pdi.fim) - Date.now()) / 86_400_000) : null;
  checar("Aplicação ativa os módulos do produto com origem, pedido e prazo cadastrados", pdi?.status === "ativo" && fb?.status === "ativo" && pdi.origem === "kiwify" && pdi.referencia_externa === pedido && dias >= 364 && dias <= 365, JSON.stringify({ status: pdi?.status, dias }));
  const hist = await um("select count(*)::int n from historico_entitlements where tenant_id=$1 and motivo like $2", [BRAVO, `%${pedido}%`]);
  checar("Histórico registra a mudança com o pedido", hist.n === 2, `${hist.n}`);
  e = await nav.entrar("helena@bravo.test");
  checar("Bravo passa a ver os módulos comprados", /PDI/.test(e.texto) && /Feedback 1:1/.test(e.texto));

  // ── 3. Duplicado e reembolso ──
  await kiwify({ order_id: pedido, webhook_event_type: "order_approved", Product: { product_id: "prod-e2e" }, Customer: { email: "compras@bravo.test" } });
  await esperar(2000);
  const dup = await um("select id from eventos_integracao where pedido_id=$1 and tipo='aprovado' and status='recebido'", [pedido]);
  e = await nav.entrar("admin@journeylab.local");
  await nav.ir("/plataforma/integracoes?status=recebido");
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=eventoId][value="${dup.id}"]') && f.querySelector('select[name=organizacaoId]')).requestSubmit()`);
  await esperar(3000);
  checar("Evento duplicado do mesmo pedido é ignorado (idempotência)", (await um("select status from eventos_integracao where id=$1", [dup.id])).status === "ignorado");

  await kiwify({ order_id: pedido, webhook_event_type: "order_refunded", Product: { product_id: "prod-e2e" }, Customer: { email: "compras@bravo.test" } });
  const reemb = await aguardarEvento(pedido, "reembolso", (x) => !!x.organizacao_id);
  await nav.ir("/plataforma/integracoes?status=recebido");
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=eventoId][value="${reemb.id}"]') && f.querySelector('select[name=organizacaoId]')).requestSubmit()`);
  await esperar(3500);
  const crmDepois = await ent("crm");
  checar("Reembolso suspende só os módulos do pedido; CRM manual intacto", (await ent("pdi")).status === "suspenso" && (await ent("feedback")).status === "suspenso" && crmDepois.status === crmAntes.status && crmDepois.origem === crmAntes.origem);

  // ── 4. Webhook do site (HMAC) ──
  const corpoSite = JSON.stringify({ pedido_id: `${pedido}-site`, tipo: "aprovado", produto_id: "site-e2e", email: "rh@bravo.test" });
  r = await fetch(`${BASE}/api/webhooks/site`, { method: "POST", headers: { "content-type": "application/json", "x-journeylab-assinatura": "0".repeat(64) }, body: corpoSite });
  checar("Site: assinatura inválida é recusada (401)", r.status === 401);
  const assinatura = createHmac("sha256", process.env.SITE_WEBHOOK_SECRET).update(corpoSite).digest("hex");
  r = await fetch(`${BASE}/api/webhooks/site`, { method: "POST", headers: { "content-type": "application/json", "x-journeylab-assinatura": assinatura }, body: corpoSite });
  const site = await aguardarEvento(`${pedido}-site`, "aprovado", (x) => !!x.organizacao_id);
  checar("Site: assinatura válida, evento interpretado e ligado à organização", r.status === 200 && site?.organizacao_id === BRAVO && site.status === "recebido");

  // ── 5. Rotina diária ──
  r = await fetch(`${BASE}/api/cron/manutencao`);
  checar("Rotina diária exige segredo (401)", r.status === 401);
  await adm.query(
    `insert into entitlements (id, tenant_id, modulo, status, inicio, fim, origem, atualizado_em)
     values (gen_random_uuid(), $1, 'pulse', 'teste', now() - interval '20 days', now() - interval '1 day', 'manual', now())
     on conflict (tenant_id, modulo) do update set status='teste', inicio=now() - interval '20 days', fim=now() - interval '1 day'`,
    [BRAVO],
  );
  r = await fetch(`${BASE}/api/cron/manutencao`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const cron = await r.json();
  const pulse = await ent("pulse");
  checar("Rotina marca como expirado o módulo vencido, com histórico de origem sistema", r.status === 200 && pulse.status === "expirado" && !!(await um("select 1 from historico_entitlements where tenant_id=$1 and modulo='pulse' and status_novo='expirado' and origem='sistema'", [BRAVO])), JSON.stringify(cron).slice(0, 80));

  // ── 6. Retenção (Aurora) ──
  const velho = await um(
    `insert into candidatos (id, tenant_id, nome, email, email_norm, nome_norm, competencias, criado_por, criado_em, atualizado_em)
     values (gen_random_uuid(), $1, 'Candidato Antigo E2E', 'antigo.e2e@exemplo.test', 'antigo.e2e@exemplo.test', 'candidato antigo e2e', '{}', 'E2E', now() - interval '3 years', now() - interval '3 years') returning id`,
    [AURORA],
  );
  e = await nav.entrar("ana@aurora.test");
  e = await nav.ir("/configuracoes/retencao");
  await nav.preencher({ "#campo-crmCandidatosMeses": "24" });
  await nav.enviar("#campo-crmCandidatosMeses", 3000);
  checar("Administradora salva a política de retenção", (await um("select crm_candidatos_meses m from politicas_retencao where tenant_id=$1", [AURORA]))?.m === 24);
  await nav.ir("/configuracoes/retencao");
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=modo][value=simular]')).requestSubmit()`);
  await esperar(3000);
  const simulacao = await nav.mensagem();
  checar("Simulação mostra o efeito sem excluir", /Simulação/.test(simulacao) && !!(await um("select 1 from candidatos where id=$1", [velho.id])), simulacao);
  await nav.ir("/configuracoes/retencao");
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=modo][value=aplicar]')).requestSubmit()`);
  await esperar(3000);
  checar("Aplicar sem confirmar é recusado", /definitiva/.test(await nav.mensagem()) && !!(await um("select 1 from candidatos where id=$1", [velho.id])));
  await nav.ir("/configuracoes/retencao");
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=modo][value=aplicar]'));f.querySelector('input[name=confirmo]').checked=true;f.requestSubmit();})()`);
  await esperar(3500);
  const auditRet = await um("select detalhes from auditoria where tenant_id=$1 and acao='retencao.executar' order by criado_em desc limit 1", [AURORA]);
  checar("Retenção elimina o candidato antigo e registra na auditoria", !(await um("select 1 from candidatos where id=$1", [velho.id])) && !!auditRet, JSON.stringify(auditRet?.detalhes));
  checar("Candidatos com processo ativo são preservados", !!(await um("select 1 from candidatos where email='beatriz.oliveira@exemplo.test' and tenant_id=$1", [AURORA])));
  await adm.query("delete from politicas_retencao where tenant_id=$1", [AURORA]);

  // ── 7. Exportações ──
  const baixar = (url) => nav.avaliar(`fetch('${url}').then(async r=>r.status+'|'+(r.headers.get('content-type')||'')+'|'+(await r.text()))`);
  let x = await baixar("/onboarding/exportar");
  checar("Exportação de Onboarding (CSV)", x.startsWith("200|text/csv") && /Otávio Pires|Nicolas Reis|Daniela Moura/.test(x));
  x = await baixar("/feedback/exportar");
  checar("Exportação de Feedback traz compromissos e NENHUMA anotação", x.startsWith("200|") && /Apresentar o roadmap/.test(x) && !/avaliar a Carla|pedir feedback mais frequente|desenvolver comunicação com executivos/.test(x));
  x = await baixar("/pdi/exportar");
  checar("Exportação de PDI (CSV)", x.startsWith("200|") && /Desenvolvimento 2026/.test(x));
  const encerrada = await um("select id from pesquisas_pulse where tenant_id=$1 and titulo='Clima rápido · setembro'", [AURORA]);
  x = await baixar(`/pulse/${encerrada.id}/exportar`);
  checar("Exportação do Pulse só agregada; recorte pequeno bloqueado; sem comentários", x.startsWith("200|") && /Recorte não liberado/.test(x) && !/O time é muito colaborativo/.test(x));
  const auditExp = await um("select count(*)::int n from auditoria where tenant_id=$1 and acao in ('onboarding.exportar','feedback.exportar','pdi.exportar','pulse.exportar') and criado_em > now() - interval '5 minutes'", [AURORA]);
  checar("Todas as exportações foram auditadas", auditExp.n >= 4, `${auditExp.n}`);

  // ── 8. Jornada integrada na ficha da pessoa ──
  const carla = await um("select id from colaboradores where email='carla@aurora.test'");
  e = await nav.ir(`/pessoas/${carla.id}`);
  checar("Ficha da pessoa mostra a jornada entre módulos (1:1 e PDI)", /Jornada na organização/.test(e.texto) && /Feedback 1:1/.test(e.texto) && /Desenvolvimento 2026/.test(e.texto));

  // ── 9. Permissões de exportação ──
  e = await nav.entrar("carla@aurora.test");
  checar("Colaboradora não exporta Onboarding", (await baixar("/onboarding/exportar")).startsWith("403"));
  checar("Colaboradora não exporta Feedback (não acessa o módulo)", (await baixar("/feedback/exportar")).startsWith("403"));
  e = await nav.entrar("rafael@aurora.test");
  checar("RH exporta Feedback (administra os feedbacks da empresa)", (await baixar("/feedback/exportar")).startsWith("200"));
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
