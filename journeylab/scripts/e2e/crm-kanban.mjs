// Testes E2E: Kanban do CRM (etapas, arrastar e soltar, alternativa acessível,
// histórico, permissões e isolamento), links de WhatsApp nos telefones e remoção
// de "Agendar 1:1" e "Compromissos" do Feedback 1:1.
// Uso: node journeylab/scripts/e2e/crm-kanban.mjs   (app em localhost:3020)
import { fileURLToPath } from "node:url";
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
async function ateNoBanco(sql, p, cond, ms = 15000) {
  const fim = Date.now() + ms;
  let r;
  while (Date.now() < fim) {
    r = await um(sql, p);
    if (cond(r)) return r;
    await esperar(400);
  }
  return r;
}

const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
// Beatriz (seed) na vaga de back-end: volta a "inscrito" para o teste.
const cd = await um(
  "select c.id, c.vaga_id, k.id candidato_id, k.telefone from candidaturas c join candidatos k on k.id=c.candidato_id join vagas v on v.id=c.vaga_id where k.tenant_id=$1 and k.email_norm='beatriz.oliveira@exemplo.test' and v.titulo='Pessoa Desenvolvedora Back-end Pleno'",
  [AURORA],
);
await adm.query("update candidaturas set status='inscrito' where id=$1", [cd.id]);
await adm.query("update vagas set status='aberta' where id=$1", [cd.vaga_id]);

const nav = await abrirNavegador(9459);
try {
  let e = await nav.entrar("rafael@aurora.test");

  // ── 1. Kanban ──
  e = await nav.ir("/crm");
  checar("CRM tem alternância Lista / Kanban", !!(await nav.avaliar("!!document.querySelector('nav[aria-label=Visualização] a[href*=\"visao=kanban\"]')")));
  e = await nav.ir(`/crm?visao=kanban&vaga=${cd.vaga_id}`);
  const colunas = await nav.avaliar("[...document.querySelectorAll('section[data-coluna]')].map(s=>s.querySelector('h3').textContent).join('|')");
  checar("Colunas na ordem do funil", colunas === "Inscrito|Em avaliação|Entrevista|Aprovado|Contratado|Não seguiu|Desistiu", colunas);
  checar("Cartão da candidata na coluna da etapa atual", !!(await nav.avaliar(`!!document.querySelector('section[data-coluna=inscrito] article[data-candidatura="${cd.id}"]')`)));

  // Arrastar e soltar (eventos de arrastar do navegador).
  await nav.avaliar(`(()=>{const c=document.querySelector('article[data-candidatura="${cd.id}"]');const alvo=document.querySelector('section[data-coluna=entrevista]');const dt=new DataTransfer();
    c.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));alvo.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));alvo.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));})()`);
  const r1 = await ateNoBanco("select status from candidaturas where id=$1", [cd.id], (x) => x.status === "entrevista");
  checar("Arrastar para “Entrevista” atualiza a etapa no banco", r1.status === "entrevista");
  checar("Mudança registrada no histórico do candidato", !!(await um("select 1 from interacoes_candidato where candidato_id=$1 and texto like '%Inscrito → Entrevista (Kanban)%'", [cd.candidato_id])));

  // Alternativa acessível: escolher a etapa no cartão.
  e = await nav.ir(`/crm?visao=kanban&vaga=${cd.vaga_id}`);
  await nav.avaliar(`(()=>{const s=document.querySelector('select[aria-label^="Etapa de Beatriz"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'aprovado');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const r2 = await ateNoBanco("select status from candidaturas where id=$1", [cd.id], (x) => x.status === "aprovado");
  checar("Seleção da etapa no cartão (teclado/leitor de tela) também move", r2.status === "aprovado");
  e = await nav.ir(`/crm?visao=kanban&vaga=${cd.vaga_id}`);
  checar("Após recarregar, o cartão está na nova coluna", !!(await nav.avaliar(`!!document.querySelector('section[data-coluna=aprovado] article[data-candidatura="${cd.id}"]')`)));
  e = await nav.ir("/crm?visao=kanban&q=Beatriz");
  checar("Busca por nome também filtra o Kanban", /Beatriz Oliveira/.test(e.texto) && !/Caio Fernandes/.test(e.texto));

  // ── 2. WhatsApp ──
  const esperado = `https://wa.me/55${cd.telefone.replace(/\D/g, "")}`;
  checar("Cartão do Kanban abre o WhatsApp do candidato", !!(await nav.avaliar(`!!document.querySelector('article[data-candidatura="${cd.id}"] a[href="${esperado}"][target=_blank]')`)), esperado);
  e = await nav.ir(`/crm/candidatos/${cd.candidato_id}`);
  checar("Ficha do candidato: telefone abre o WhatsApp", !!(await nav.avaliar(`!!document.querySelector('main a[href="${esperado}"][rel~=noopener]')`)));
  e = await nav.ir("/crm?q=Beatriz");
  checar("Lista do CRM: telefone abre o WhatsApp", !!(await nav.avaliar(`!!document.querySelector('main table a[href="${esperado}"]')`)));
  e = await nav.ir(`/pagina-carreiras/vagas/${cd.vaga_id}`);
  checar("Candidaturas da vaga: telefone abre o WhatsApp", !!(await nav.avaliar(`!!document.querySelector('main table a[href^="https://wa.me/55"]')`)));

  // ── 3. Feedback 1:1 sem “Agendar 1:1” e sem “Compromissos” ──
  e = await nav.ir("/feedback");
  const abas = await nav.avaliar("[...document.querySelectorAll('nav[aria-label=\"Feedback 1:1\"] a')].map(a=>a.textContent.trim()).join('|')");
  checar("Feedback 1:1 sem a aba Compromissos", !/Compromissos/.test(abas), abas);
  checar("Feedback 1:1 sem botão “Agendar 1:1”", !/Agendar 1:1/.test(e.texto) && !(await nav.avaliar("!!document.querySelector('main a[href^=\"/feedback/agendar\"]')")));
  e = await nav.ir("/feedback/agenda");
  checar("Agenda sem botão “Agendar 1:1”", !(await nav.avaliar("!!document.querySelector('main a[href^=\"/feedback/agendar\"]')")));
  const av = await um("select a.id from avaliacoes_feedback a where a.tenant_id=$1 order by a.data desc limit 1", [AURORA]);
  e = await nav.ir(`/feedback/avaliacoes/${av.id}`);
  checar("Avaliação sem “Agendar próximo 1:1”", !/Agendar próximo 1:1/.test(e.texto));

  // ── 4. Permissões e isolamento ──
  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir("/crm?visao=kanban");
  checar("Sem permissão de CRM: Kanban bloqueado", !e.url.startsWith("/crm"), e.url);
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir("/crm?visao=kanban");
  checar("Outra empresa não vê candidaturas da Aurora no Kanban", !/Beatriz Oliveira/.test(e.texto) && !(await nav.avaliar(`!!document.querySelector('article[data-candidatura="${cd.id}"]')`)));
} finally {
  nav.fechar();
  await adm.query("update candidaturas set status='entrevista' where id=$1", [cd.id]);
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
