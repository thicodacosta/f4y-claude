// Testes E2E do Feedback 1:1 avaliado (Performance × Cultura), cadência e agenda de 1:1.
// Uso: node journeylab/scripts/e2e/feedback-avaliacoes.mjs   (app em localhost:3020)
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
const CAMPOS = ["pProdutividade", "pQualidade", "pFerramentas", "pPriorizacao", "pTempo", "pAprendizado", "pRelacionamento", "pComunicacao", "cCriatividade", "cConfianca", "cResultado", "cSensoDono", "cAdaptabilidade", "cResiliencia", "cLongoPrazo", "cColaboracao"];
const COLUNAS = ["p_produtividade", "p_qualidade", "p_ferramentas", "p_priorizacao", "p_tempo", "p_aprendizado", "p_relacionamento", "p_comunicacao", "c_criatividade", "c_confianca", "c_resultado", "c_senso_dono", "c_adaptabilidade", "c_resiliencia", "c_longo_prazo", "c_colaboracao"];
/** A mesma regra do produto, reescrita aqui para conferir tela e banco. */
function regra(n) {
  const p = n.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
  const c = n.slice(8).reduce((a, b) => a + b, 0) / 8;
  const g = (p + c) / 2;
  return { p, c, g, semaforo: g >= 4 ? "verde" : g >= 3 ? "amarelo" : "vermelho" };
}
const umaCasa = (x) => x.toFixed(1).replace(".", ",");
const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somarDiasTxt = (t, d) => new Date(new Date(`${t}T00:00:00Z`).getTime() + d * 86_400_000).toISOString().slice(0, 10);

// ── Preparação: estado do seed ──
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from avaliacoes_feedback where tenant_id=$1", [AURORA]);
await adm.query("delete from reunioes where tenant_id=$1 and colaborador_id in (select id from colaboradores where email in ('elisa@aurora.test','fabio@aurora.test','gabriela@aurora.test'))", [AURORA]);
execSync("npm run db:seed", { cwd: fileURLToPath(new URL("../..", import.meta.url)), stdio: "ignore" });
const pessoa = (email) => um("select id, gestor_id from colaboradores where email=$1", [email]);
const [carla, diego, elisa, fabio, marina] = await Promise.all(["carla@aurora.test", "diego@aurora.test", "elisa@aurora.test", "fabio@aurora.test", "marina@aurora.test"].map(pessoa));
const ultimaDe = (id) => um("select * from avaliacoes_feedback where colaborador_id=$1 order by data desc, criado_em desc limit 1", [id]);
const avDiego = await ultimaDe(diego.id);
const avMarina = await ultimaDe(marina.id);
const avCarla = await ultimaDe(carla.id);

// ── 1. Banco: regra única de médias/semáforo, limites e validações ──
{
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await app.connect();
  const uid = (await um("select id from usuarios where email='ana@aurora.test'")).id;
  const inserir = async (notas, extra = {}, colaboradorId = elisa.id) => {
    await app.query("begin");
    await app.query("select set_config('app.tenant_id',$1,true), set_config('app.usuario_id',$2,true), set_config('app.escopo','tenant',true)", [AURORA, uid]);
    try {
      const cols = [...COLUNAS, ...Object.keys(extra)];
      const vals = [...notas, ...Object.values(extra)];
      const r = await app.query(
        `insert into avaliacoes_feedback (id, tenant_id, colaborador_id, data, autor_id, autor_nome, atualizado_em, ${cols.join(",")})
         values (gen_random_uuid(), $1, $2, current_date, $3, 'E2E', now(), ${cols.map((_, i) => `$${i + 4}`).join(",")}) returning media_performance, media_cultura, media_geral, semaforo`,
        [AURORA, colaboradorId, uid, ...vals],
      );
      return r.rows[0];
    } catch (e) {
      return { erro: e.message };
    } finally {
      await app.query("rollback");
    }
  };
  const quatro = await inserir(Array(16).fill(4));
  checar("Banco: média geral exatamente 4,0 → verde", quatro.semaforo === "verde" && Number(quatro.media_geral) === 4, JSON.stringify(quatro));
  const tres = await inserir(Array(16).fill(3));
  checar("Banco: média geral exatamente 3,0 → amarelo", tres.semaforo === "amarelo", JSON.stringify(tres));
  const abaixo = await inserir([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2]);
  checar("Banco: 2,9375 → vermelho (sem arredondar para cima)", abaixo.semaforo === "vermelho" && Number(abaixo.media_geral) === 2.9375, JSON.stringify(abaixo));
  const forjado = await inserir(Array(16).fill(1), { media_geral: 5, semaforo: "verde" });
  checar("Banco: média/semáforo enviados pela aplicação são recalculados", forjado.semaforo === "vermelho" && Number(forjado.media_geral) === 1, JSON.stringify(forjado));
  const seis = await inserir([6, ...Array(15).fill(3)]);
  checar("Banco: nota fora de 1–5 é recusada", /avaliacoes_notas_1_a_5/.test(seis.erro ?? ""), seis.erro);
  const bravoPessoa = await um("select c.id from colaboradores c join organizacoes o on o.id=c.tenant_id where o.slug='bravo-logistica' limit 1");
  const outra = await inserir(Array(16).fill(3), {}, bravoPessoa.id);
  checar("Banco: não aceita colaborador de outra empresa (mesmo sabendo o id)", /não pertence a esta organização/.test(outra.erro ?? ""), outra.erro?.slice(0, 80));
  await app.end();
}

const nav = await abrirNavegador(9454);
/** Marca as 16 notas no formulário (clique real nos rádios — dispara a prévia ao vivo). */
const marcar = (notas, pular = -1) =>
  nav.avaliar(`(()=>{const c=${JSON.stringify(CAMPOS)};const n=${JSON.stringify(notas)};c.forEach((campo,i)=>{if(i===${pular})return;document.querySelector('input[name="n_'+campo+'"][value="'+n[i]+'"]').click();});})()`);
const enviarAvaliacao = () => nav.avaliar("document.querySelector('input[name^=n_]').form.requestSubmit()");
try {
  // ── 2. Contratação e papéis ──
  let e = await nav.entrar("helena@bravo.test");
  for (const u of ["/feedback", `/feedback/avaliacoes/${avDiego.id}`, "/feedback-1on1?action=create"]) {
    e = await nav.ir(u);
    checar(`Empresa sem Feedback 1:1 bloqueada em ${u.split("?")[0]}`, e.url.startsWith("/inicio?bloqueado=feedback"), e.url);
  }
  e = await nav.entrar("carla@aurora.test");
  checar("Colaborador não vê Feedback 1:1 no menu", !(await nav.avaliar("[...document.querySelectorAll('nav a')].some(a=>a.getAttribute('href')==='/feedback')")));
  e = await nav.ir(`/feedback/avaliacoes/${avCarla.id}`);
  checar("Colaborador não acessa o próprio feedback pela URL", e.url.startsWith("/inicio?sem_permissao=feedback"), e.url);

  // ── 3. Gestor: só o próprio time ──
  e = await nav.entrar("bruno@aurora.test");
  checar("Painel do gestor mostra a cadência de feedback", /Cadência de feedback/.test(e.texto) && /Fábio Nunes/.test(e.texto));
  e = await nav.ir("/feedback");
  checar("Gestor lista só feedbacks do time", /Diego Ferreira/.test(e.texto) && /Carla Mendes/.test(e.texto) && !/Marina Costa/.test(e.texto));
  checar("Lista ordena por atenção (vermelho primeiro) com status em texto", (await nav.avaliar("document.querySelector('tbody tr')?.innerText || ''")).includes("Vermelho · atenção"));
  e = await nav.ir(`/feedback/avaliacoes/${avMarina.id}`);
  checar("Gestor não abre feedback de outra equipe (404)", !/Marina Costa/.test(e.texto));
  e = await nav.ir(`/feedback-1on1?action=create&employee=${marina.id}`);
  checar("Link interno com colaborador fora do escopo é recusado", e.url.startsWith("/feedback/novo") && /não está entre as pessoas que você pode avaliar/.test(e.texto) && !(await nav.avaliar(`!!document.querySelector('select[name=colaboradorId] option[value="${marina.id}"]')`)));
  // Tentativa de forjar o formulário com a pessoa de outra equipe: o servidor recusa.
  await nav.avaliar(`(()=>{const s=document.querySelector('select[name=colaboradorId]');const o=document.createElement('option');o.value='${marina.id}';s.appendChild(o);s.value='${marina.id}';})()`);
  await marcar(Array(16).fill(3));
  await enviarAvaliacao();
  await nav.esperarAte("/não pode registrar feedback/.test(document.body.innerText)");
  checar("Servidor recusa feedback para pessoa fora do time (payload forjado)", /não pode registrar feedback para esta pessoa/.test(await nav.mensagem()), await nav.mensagem());

  // ── 4. Criar feedback com prévia ao vivo e validação ──
  e = await nav.ir(`/feedback-1on1?action=create&employee=${elisa.id}`);
  checar("Link /feedback-1on1?action=create pré-seleciona o colaborador permitido", (await nav.avaliar("document.querySelector('select[name=colaboradorId]').value")) === elisa.id);
  const notasElisa = [5, 4, 4, 4, 4, 4, 2, 4, 4, 4, 4, 4, 4, 4, 4, 1];
  await marcar(notasElisa, 15);
  const parcial = await nav.avaliar("document.querySelector('#resumo').parentElement.innerText");
  checar("Sem média final enquanto falta nota", /Faltam 1/.test(parcial) && !/Geral/.test(parcial), parcial.replace(/\n/g, " "));
  // Validação do servidor (removendo o bloqueio do navegador)
  await nav.avaliar("document.querySelectorAll('input[name^=n_]').forEach(i=>i.removeAttribute('required'))");
  await enviarAvaliacao();
  await nav.esperarAte("document.querySelector('[role=alert]')");
  checar("Servidor recusa feedback incompleto com mensagem clara", /falta 1 critério/.test(await nav.mensagem()), await nav.mensagem());
  await marcar(notasElisa);
  const esperado = regra(notasElisa);
  const previa = await nav.avaliar("document.querySelector('#resumo').parentElement.innerText");
  checar("Prévia mostra médias e semáforo pela mesma regra", previa.includes(umaCasa(esperado.g)) && previa.includes(umaCasa(esperado.p)) && /Amarelo|Verde|Vermelho/.test(previa), `${umaCasa(esperado.p)}/${umaCasa(esperado.c)}/${umaCasa(esperado.g)} ${esperado.semaforo}`);
  checar("Perguntas sugeridas para as notas mais baixas", /Perguntas para a conversa/.test(previa + (await nav.avaliar("document.body.innerText"))) && (await nav.avaliar("document.body.innerText")).includes("Colaboração · nota 1"));
  await nav.preencher({ "textarea[name=observacoes]": "Feedback E2E <script>alert(1)</script>" });
  await enviarAvaliacao();
  await nav.esperarAte("/\\/feedback\\/avaliacoes\\/[0-9a-f-]{36}$/.test(location.pathname)");
  e = await nav.estado();
  const avElisa = await ultimaDe(elisa.id);
  checar("Feedback salvo com médias do banco iguais às da tela", !!avElisa && Math.abs(Number(avElisa.media_geral) - esperado.g) < 1e-9 && avElisa.semaforo === esperado.semaforo, JSON.stringify({ banco: avElisa?.media_geral, tela: esperado.g }));
  checar("Detalhe mostra médias com uma casa e status com rótulo", e.texto.includes(umaCasa(esperado.g)) && /Feedback salvo/.test(e.texto) && /(Verde · bom|Amarelo · acompanhar|Vermelho · atenção)/.test(e.texto));
  checar("Observações exibidas como texto (sem executar HTML)", e.texto.includes("<script>alert(1)</script>") && !(await nav.avaliar("!!document.querySelector('main script')")));
  checar("Gestor registrado é o do cadastro, não do navegador", avElisa.gestor_id === elisa.gestor_id);
  checar("Data exibida = data gravada", e.texto.includes(`${hojeSP.slice(8, 10)} de`), hojeSP);

  // ── 5. Editar, comparar com o anterior, excluir com confirmação ──
  e = await nav.ir(`/feedback/avaliacoes/${avElisa.id}/editar`);
  await nav.avaliar(`document.querySelector('input[name="n_cColaboracao"][value="5"]').click()`);
  await enviarAvaliacao();
  await nav.esperarAte("location.search.includes('salvo=1')");
  const editado = await um("select c_colaboracao, media_geral from avaliacoes_feedback where id=$1", [avElisa.id]);
  const esperado2 = regra([...notasElisa.slice(0, 15), 5]);
  checar("Edição recalcula as médias", editado.c_colaboracao === 5 && Math.abs(Number(editado.media_geral) - esperado2.g) < 1e-9);
  e = await nav.ir(`/feedback/avaliacoes/${avCarla.id}`);
  checar("Detalhe compara com o feedback anterior", /Anterior:/.test(e.texto) && /feedback anterior, de/.test(e.texto));
  e = await nav.ir(`/feedback/avaliacoes/${avElisa.id}`);
  await nav.avaliar(`[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=confirmo]') && f.querySelector('input[name=id]')).requestSubmit()`);
  await nav.esperarAte("document.querySelector('[role=alert]')");
  checar("Excluir sem confirmar é recusado", /Confirme a exclusão/.test(await nav.mensagem()) && !!(await um("select 1 from avaliacoes_feedback where id=$1", [avElisa.id])));
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=confirmo]') && f.querySelector('input[name=id]'));f.querySelector('input[name=confirmo]').checked=true;f.requestSubmit();})()`);
  await nav.esperarAte("location.search.includes('excluido=1')");
  checar("Excluir com confirmação remove e avisa", !(await um("select 1 from avaliacoes_feedback where id=$1", [avElisa.id])) && /Feedback excluído/.test((await nav.estado()).texto));

  // ── 6. Sugestão de PDI: só com confirmação e só com PDI contratado ──
  const pdisAntes = (await um("select count(*)::int n from objetivos_pdi o join pdis p on p.id=o.pdi_id where p.colaborador_id=$1", [diego.id])).n;
  e = await nav.ir(`/feedback/avaliacoes/${avDiego.id}`);
  checar("Critérios ≤ 2 geram sugestão de PDI com prévia editável", /Sugestão de PDI/.test(e.texto) && (await nav.avaliar("document.querySelectorAll('input[name=objetivo]').length")) >= 5);
  checar("Nada é criado no PDI antes da confirmação", (await um("select count(*)::int n from objetivos_pdi o join pdis p on p.id=o.pdi_id where p.colaborador_id=$1", [diego.id])).n === pdisAntes);
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=avaliacaoId]') && f.querySelector('input[name=objetivo]'));
    const i=f.querySelector('#obj-0');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Objetivo revisado E2E');
    f.querySelectorAll('input[name=objetivo]').forEach((x,k)=>{if(k>1)Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(x,'');});
    f.requestSubmit();})()`);
  await nav.esperarAte("/\\/pdi\\/[0-9a-f-]{36}$/.test(location.pathname)");
  const objetivos = await um("select count(*)::int n, bool_or(o.titulo='Objetivo revisado E2E') revisado from objetivos_pdi o join pdis p on p.id=o.pdi_id where p.colaborador_id=$1", [diego.id]);
  checar("Após confirmar, PDI recebe só os objetivos revisados", objetivos.n === pdisAntes + 2 && objetivos.revisado, JSON.stringify(objetivos));
  await adm.query("update entitlements set status='suspenso' where tenant_id=$1 and modulo='pdi'", [AURORA]);
  e = await nav.ir(`/feedback/avaliacoes/${avDiego.id}`);
  checar("Sem PDI contratado: feedback funciona e a sugestão some", /Diego Ferreira/.test(e.texto) && !/Sugestão de PDI/.test(e.texto));
  await adm.query("update entitlements set status='ativo' where tenant_id=$1 and modulo='pdi'", [AURORA]);

  // ── 7. Cadência ──
  e = await nav.ir("/feedback");
  const cad = await nav.avaliar("document.querySelector('[aria-labelledby=cadencia]')?.innerText || ''");
  checar("Sem histórico: referência pela data de entrada (Fábio atrasado)", /Fábio Nunes/.test(cad) && /referência: data de entrada/.test(cad) && /Atrasado 10 d/.test(cad), cad.replace(/\n/g, " ").slice(0, 200));
  checar("Próximo quando faltam até 7 dias (Carla, em 5 d)", /Carla Mendes[\s\S]*Em 5 d/.test(cad));
  checar("Em dia não aparece nos alertas (Gabriela, trimestral)", !/Gabriela/.test(cad));
  checar("Alerta abre o agendamento já preenchido", await nav.avaliar(`!!document.querySelector('#cadencia-${fabio.id} a[href="/feedback/agendar?colaborador=${fabio.id}"]')`));

  // ── 8. Agenda: passado recusado, recorrência, duplicidade, cancelamentos, calendário ──
  e = await nav.ir(`/feedback/agendar?colaborador=${fabio.id}`);
  checar("Agendamento pré-seleciona o colaborador do alerta", (await nav.avaliar("document.querySelector('select[name=colaboradorId]').value")) === fabio.id);
  await nav.preencher({ "input[name=data]": somarDiasTxt(hojeSP, -1), "select[name=horario]": "10:00" });
  await nav.avaliar("document.querySelector('input[name=data]').removeAttribute('min')");
  await nav.enviar("select[name=horario]", 2500);
  checar("Data no passado é recusada", /não pode estar no passado/.test(await nav.mensagem()), await nav.mensagem());
  const inicio = somarDiasTxt(hojeSP, 3);
  await nav.preencher({ "input[name=data]": inicio, "select[name=horario]": "14:30", "select[name=duracao]": "45", "select[name=recorrencia]": "mensal", "textarea[name=observacoes]": "Revisar metas" });
  await nav.enviar("select[name=horario]", 1000);
  await nav.esperarAte("location.search.includes('agendado=1')");
  e = await nav.estado();
  const serie = (await adm.query("select id, data_hora, duracao_min, serie_id, status from reunioes where colaborador_id=$1 and status='agendada' order by data_hora", [fabio.id])).rows;
  const meses = serie.map((r) => r.data_hora.toISOString().slice(0, 7));
  checar("Recorrência mensal cria a reunião inicial + 3 na mesma série", serie.length === 4 && new Set(serie.map((r) => r.serie_id)).size === 1 && !!serie[0].serie_id && new Set(meses).size === 4 && serie[0].duracao_min === 45, meses.join(","));
  // A coluna guarda o instante em UTC; converte no banco para o horário de São Paulo.
  const hora = (await um("select to_char((data_hora at time zone 'UTC') at time zone 'America/Sao_Paulo', 'HH24:MI') h from reunioes where id=$1", [serie[0].id])).h;
  checar("Horário gravado no fuso correto (14:30 em São Paulo)", hora === "14:30", hora);
  checar("Links de calendário identificados como “adicionar”, sem sincronização", /Adicionar ao Google Agenda/.test(e.texto) && /Adicionar ao Outlook/.test(e.texto) && /não há sincronização automática/.test(e.texto) && (await nav.avaliar("[...document.querySelectorAll('a')].some(a=>a.href.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'))")));
  checar("Observações não vão para o link do calendário", !(await nav.avaliar("[...document.querySelectorAll('a')].some(a=>a.href.includes('Revisar'))")));
  e = await nav.ir(`/feedback/agendar?colaborador=${fabio.id}`);
  await nav.preencher({ "input[name=data]": inicio, "select[name=horario]": "14:30", "select[name=recorrencia]": "nenhuma" });
  await nav.enviar("select[name=horario]", 2500);
  checar("Mesmo horário para a mesma pessoa é recusado (sem duplicidade)", /Já existe 1:1 ativo/.test(await nav.mensagem()), await nav.mensagem());
  // Cancelar só a 2ª ocorrência
  e = await nav.ir(`/feedback/${serie[1].id}`);
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name=acao][value=cancelar]'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f.querySelector('input[name=motivo]'),'Férias');f.requestSubmit();})()`);
  await ateNoBanco("select status from reunioes where id=$1", [serie[1].id], (r) => r?.status === "cancelada");
  const aposUma = (await adm.query("select status from reunioes where serie_id=$1 order by data_hora", [serie[0].serie_id])).rows.map((r) => r.status);
  checar("Cancelar uma ocorrência não afeta as demais", aposUma.join(",") === "agendada,cancelada,agendada,agendada", aposUma.join(","));
  // Cancelar a partir da 3ª (esta e as próximas)
  e = await nav.ir(`/feedback/${serie[2].id}`);
  await nav.avaliar(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('#motivo-serie'));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f.querySelector('#motivo-serie'),'Mudança de área');f.querySelector('input[name=confirmo]').checked=true;f.requestSubmit();})()`);
  await ateNoBanco("select status from reunioes where id=$1", [serie[3].id], (r) => r?.status === "cancelada");
  const aposSerie = (await adm.query("select status from reunioes where serie_id=$1 order by data_hora", [serie[0].serie_id])).rows.map((r) => r.status);
  checar("Cancelar “esta e as próximas” preserva as anteriores", aposSerie.join(",") === "agendada,cancelada,cancelada,cancelada", aposSerie.join(","));

  // ── 9. RH: toda a empresa; exportação sem anotações ──
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/feedback?periodo=todos");
  checar("RH vê feedbacks de toda a empresa", /Marina Costa/.test(e.texto) && /Diego Ferreira/.test(e.texto));
  e = await nav.ir("/feedback?periodo=todos&status=vermelho");
  checar("Filtro por status", /Diego Ferreira/.test(e.texto) && !/Marina Costa/.test(await nav.avaliar("document.querySelector('table')?.innerText || ''")));
  const csv = await nav.avaliar("fetch('/feedback/exportar').then(async r=>r.status+'|'+(await r.text()))");
  checar("Exportação traz avaliações e nenhuma anotação de 1:1", csv.startsWith("200|") && /FEEDBACKS AVALIADOS/.test(csv) && /Produtividade/.test(csv) && !/avaliar a Carla para liderar/.test(csv));
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
