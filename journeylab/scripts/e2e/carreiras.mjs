// Testes E2E da Página de Carreiras: gestão de vagas, página pública, candidatura
// sem login → CRM (novo ou existente), currículo privado, aviso ao criador (falha e
// reenvio), antisspam e isolamento entre empresas.
// Uso: node journeylab/scripts/e2e/carreiras.mjs   (app em localhost:3020, Supabase local com Mailpit)
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador, BASE } from "./navegador.mjs";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const MAILPIT = "http://127.0.0.1:54524/api/v1";
const emails = async (f) => ((await (await fetch(`${MAILPIT}/messages?limit=200`)).json()).messages ?? []).filter(f);

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

// Arquivos de teste: PDF e DOCX pela assinatura; e um "PDF" falso (texto).
const pasta = mkdtempSync(join(tmpdir(), "jl-carreiras-"));
const PDF = join(pasta, "curriculo.pdf");
const DOCX = join(pasta, "curriculo.docx");
const FALSO = join(pasta, "falso.pdf");
writeFileSync(PDF, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
writeFileSync(DOCX, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(200, 1)]));
writeFileSync(FALSO, "isto não é um PDF");

const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
const sufixo = Date.now();
const TITULO = `Analista de Dados E2E ${sufixo}`;
const EMAIL = `carreiras.${sufixo}@exemplo.test`;
await adm.query("delete from vagas where tenant_id=$1 and titulo like 'Analista de Dados E2E%'", [AURORA]);
await fetch(`${MAILPIT}/messages`, { method: "DELETE" });

const nav = await abrirNavegador(9455);
const pub = await abrirNavegador(9456);
const corpo = (n) => n.avaliar("document.body.innerText");
async function candidatarUI(n, url, { nome, email, telefone, arquivo, site }) {
  await n.ir(url);
  await n.esperarAte("document.querySelector('input[name=nome]')");
  await n.preencher({ "input[name=nome]": nome, "input[name=email]": email, "input[name=telefone]": telefone });
  if (site) await n.preencher({ "input[name=site]": site });
  if (arquivo) await n.anexar("input[name=curriculo]", arquivo);
  await n.avaliar("document.querySelector('input[name=nome]').form.requestSubmit()");
  await n.esperarAte("/Candidatura enviada/.test(document.body.innerText) || document.querySelector('[role=alert]')", 30000);
  return corpo(n);
}

try {
  // ── 1. Gestão interna ──
  let e = await nav.entrar("rafael@aurora.test");
  const menu = await nav.avaliar("[...document.querySelectorAll('nav a')].map(a=>a.textContent.trim())");
  const iCrm = menu.indexOf("CRM de Candidatos");
  checar("Menu: “Página de Carreiras” logo abaixo de “CRM de Candidatos”", iCrm >= 0 && menu[iCrm + 1] === "Página de Carreiras", menu.slice(0, 5).join(" | "));
  e = await nav.ir("/crm/vagas");
  checar("Endereço antigo de vagas do CRM leva à Página de Carreiras", e.url === "/pagina-carreiras", e.url);
  e = await nav.ir("/pagina-carreiras/nova");
  checar("Criação informa o e-mail do criador para avisos", /rafael@aurora\.test/.test(e.texto));
  await nav.preencher({
    "input[name=titulo]": TITULO,
    "textarea[name=descricao]": "Análises para o time de produto.",
    "textarea[name=requisitos]": "SQL\nPython",
    "input[name=local]": "Remoto (Brasil)",
    "select[name=modelo]": "remoto",
    "select[name=tipoContratacao]": "pj",
  });
  await nav.avaliar("document.querySelector('input[name=titulo]').form.requestSubmit()");
  await nav.esperarAte("/\\/pagina-carreiras\\/vagas\\/[0-9a-f-]{36}$/.test(location.pathname)", 20000);
  const vaga = await um("select id, slug, publicada, criado_por_usuario_id, email_notificacao from vagas where titulo=$1", [TITULO]);
  checar("Vaga criada não publicada, com criador e e-mail registrados", vaga && !vaga.publicada && !!vaga.criado_por_usuario_id && vaga.email_notificacao === "rafael@aurora.test", JSON.stringify(vaga));
  const urlVaga = `/carreiras/aurora-tecnologia/vagas/${vaga.slug}`;
  await pub.ir(urlVaga);
  checar("Vaga não publicada não aparece publicamente (404)", /could not be found|não encontrad|404/i.test(await corpo(pub)));
  await nav.esperarAte("[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Publicar na Página'))", 20000);
  checar("Publicar exige conferir o e-mail", !!(await nav.avaliar("[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Publicar na Página')).disabled")));
  await nav.avaliar(`[...document.querySelectorAll('main label')].find(l=>l.textContent.includes('Confirmo que os avisos')).querySelector('input').click()`);
  await esperar(200);
  await nav.avaliar("[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Publicar na Página')).click()");
  const pubd = await ateNoBanco("select publicada, email_confirmado_em from vagas where id=$1", [vaga.id], (r) => r.publicada);
  checar("Vaga publicada com e-mail conferido", pubd.publicada && !!pubd.email_confirmado_em);

  // Vaga antiga sem criador registrado: publicar exige configurar o responsável pelos avisos.
  const legado = await um("select id from vagas where tenant_id=$1 and titulo='Executivo(a) de Contas'", [AURORA]);
  await adm.query("update vagas set publicada=false, criado_por_usuario_id=null, email_notificacao=null, email_confirmado_em=null, status='aberta' where id=$1", [legado.id]);
  e = await nav.ir(`/pagina-carreiras/vagas/${legado.id}`);
  checar("Sem e-mail válido do criador: publicação bloqueada com mensagem clara", /não tem um e-mail válido do criador/.test(e.texto) && !(await nav.avaliar("[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Publicar na Página'))")));

  // ── 2. Página pública ──
  e = await pub.ir("/carreiras/aurora-tecnologia");
  const txt = await corpo(pub);
  checar("Página pública lista a vaga publicada, sem dados internos", txt.includes(TITULO) && !/Executivo\(a\) de Contas/.test(txt) && !/rafael@|Rafael Lima|Ana Souza/.test(txt));
  e = await pub.ir(urlVaga);
  const html = await pub.avaliar("document.documentElement.outerHTML");
  checar("Detalhe público com requisitos, formulário e JobPosting (SEO)", /Requisitos/.test(await corpo(pub)) && /Candidatar-se/.test(await corpo(pub)) && /"JobPosting"/.test(html) && !/rafael@aurora/.test(html));
  checar("Aviso de privacidade com link para a política existente", !!(await pub.avaliar("!!document.querySelector('form a[href=\"/privacidade\"]')")));
  await pub.avaliar("document.querySelector('input[name=nome]').form.requestSubmit()");
  await esperar(300);
  checar("Validação no navegador (campos obrigatórios)", /Informe seu nome/.test(await corpo(pub)) && /Anexe seu currículo/.test(await corpo(pub)));
  let r = await candidatarUI(pub, urlVaga, { nome: "Pessoa Falsa", email: `falso.${sufixo}@exemplo.test`, telefone: "(11) 91234-5678", arquivo: FALSO });
  checar("Servidor recusa arquivo que não é PDF/DOCX de verdade", /Formato não aceito/.test(r) && !(await um("select 1 from candidatos where email_norm=$1", [`falso.${sufixo}@exemplo.test`])));
  r = await candidatarUI(pub, urlVaga, { nome: "Robô", email: `robo.${sufixo}@exemplo.test`, telefone: "(11) 91234-5678", arquivo: PDF, site: "http://spam" });
  checar("Campo-armadilha bloqueia envio automatizado sem gravar nada", /Não foi possível enviar/.test(r) && !(await um("select 1 from candidatos where email_norm=$1", [`robo.${sufixo}@exemplo.test`])));

  // ── 3. Candidatura → CRM (novo) + aviso ──
  r = await candidatarUI(pub, urlVaga, { nome: "Marina Candidata E2E", email: EMAIL, telefone: "(11) 97777-0000", arquivo: PDF });
  checar("Confirmação clara após o envio", /Candidatura enviada/.test(r));
  const cand = await um("select id, nome, origem, telefone from candidatos where tenant_id=$1 and email_norm=$2", [AURORA, EMAIL]);
  checar("Contato criado no CRM da empresa com origem Página de Carreiras", cand?.origem === "Página de Carreiras" && cand.telefone === "(11) 97777-0000", JSON.stringify(cand));
  const cd = await ateNoBanco(
    "select c.id, c.origem, c.anexo_id, c.notificacao_status, a.caminho, a.tenant_id from candidaturas c left join anexos_candidato a on a.id=c.anexo_id where c.vaga_id=$1 and c.candidato_id=$2",
    [vaga.id, cand.id],
    (x) => x?.notificacao_status && x.notificacao_status !== "pendente",
  );
  checar("Candidatura vinculada à vaga, com currículo no caminho privado da empresa", cd?.origem === "carreiras" && !!cd.anexo_id && cd.caminho.startsWith(`${AURORA}/crm/carreiras/`) && cd.tenant_id === AURORA, JSON.stringify(cd));
  checar("Histórico do candidato registra vaga e data", !!(await um("select 1 from interacoes_candidato where candidato_id=$1 and texto like $2", [cand.id, `%${TITULO}%`])));
  checar("Aviso ao criador enviado", cd.notificacao_status === "enviado", cd.notificacao_status);
  await esperar(800);
  const aviso = (await emails((m) => m.Subject.includes(TITULO) && m.Subject.includes("Marina Candidata E2E")))[0];
  if (aviso) {
    const msg = await (await fetch(`${MAILPIT}/message/${aviso.ID}`)).json();
    checar(
      "E-mail ao criador: dados do candidato e link autenticado do currículo (sem anexo)",
      msg.To?.[0]?.Address === "rafael@aurora.test" && /\(11\) 97777-0000/.test(msg.HTML) && /\/crm\/anexos\//.test(msg.HTML) && /\/crm\/candidatos\//.test(msg.HTML) && !(msg.Attachments ?? []).length,
    );
  } else checar("E-mail ao criador recebido", false);

  // ── 4. Mesmo e-mail de novo (mesma vaga): reaproveita contato, guarda novo currículo, não duplica ──
  r = await candidatarUI(pub, urlVaga, { nome: "Marina C. E2E", email: EMAIL.toUpperCase(), telefone: "(21) 96666-0000", arquivo: DOCX });
  const cont = await um(
    "select (select count(*)::int from candidatos where tenant_id=$1 and email_norm=$2) cands, (select count(*)::int from candidaturas where candidato_id=$3) cds, (select count(*)::int from anexos_candidato where candidato_id=$3) anexos, (select telefone from candidatos where id=$3) tel",
    [AURORA, EMAIL, cand.id],
  );
  checar("Reenvio: mesmo contato, uma candidatura, dois currículos, telefone anterior preservado", /Candidatura enviada/.test(r) && cont.cands === 1 && cont.cds === 1 && cont.anexos === 2 && cont.tel === "(11) 97777-0000", JSON.stringify(cont));
  checar("Diferenças ficam no histórico (não sobrescritas)", !!(await um("select 1 from interacoes_candidato where candidato_id=$1 and texto like '%(21) 96666-0000%'", [cand.id])));

  // ── 5. Candidato já existente no CRM (cadastro manual) ──
  const beatriz = await um("select id, nome, origem from candidatos where tenant_id=$1 and email_norm='beatriz.oliveira@exemplo.test'", [AURORA]);
  r = await candidatarUI(pub, urlVaga, { nome: "Beatriz O.", email: "beatriz.oliveira@exemplo.test", telefone: "(11) 98888-1001", arquivo: PDF });
  const b2 = await um("select nome, origem, (select count(*)::int from candidatos where tenant_id=$2 and email_norm='beatriz.oliveira@exemplo.test') n from candidatos where id=$1", [beatriz.id, AURORA]);
  checar("E-mail já no CRM: contato existente reaproveitado sem perder dados", /Candidatura enviada/.test(r) && b2.n === 1 && b2.nome === beatriz.nome && b2.origem === beatriz.origem, JSON.stringify(b2));

  // ── 6. Falha no aviso: candidatura mantida; reenvio pelo painel ──
  const forasteiro = (await um("select id from usuarios where email='helena@bravo.test'")).id;
  await adm.query("update vagas set criado_por_usuario_id=$2 where id=$1", [vaga.id, forasteiro]);
  r = await candidatarUI(pub, urlVaga, { nome: "Otto Falha E2E", email: `otto.${sufixo}@exemplo.test`, telefone: "(11) 95555-0000", arquivo: PDF });
  const falha = await ateNoBanco(
    "select c.id, c.notificacao_status, c.notificacao_erro, c.notificacao_tentativas from candidaturas c join candidatos k on k.id=c.candidato_id where k.email_norm=$1",
    [`otto.${sufixo}@exemplo.test`],
    (x) => x?.notificacao_status && x.notificacao_status !== "pendente",
  );
  checar("Criador sem acesso à empresa: currículo não é enviado; candidatura mantida como “falhou”", /Candidatura enviada/.test(r) && falha.notificacao_status === "falhou" && /não tem mais acesso/.test(falha.notificacao_erro ?? ""), JSON.stringify(falha));
  checar("Nenhum e-mail sai para usuário de outra empresa", (await emails((m) => m.Subject.includes("Otto Falha E2E"))).length === 0);
  await adm.query("update vagas set criado_por_usuario_id=(select id from usuarios where email='rafael@aurora.test') where id=$1", [vaga.id]);
  e = await nav.ir(`/pagina-carreiras/vagas/${vaga.id}`);
  checar("Painel mostra a falha do aviso", /Falha no aviso/.test(e.texto) && /Reenviar aviso/.test(e.texto));
  await nav.avaliar("[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Reenviar aviso')).click()");
  const reenvio = await ateNoBanco("select notificacao_status, notificacao_tentativas from candidaturas where id=$1", [falha.id], (x) => x.notificacao_status === "enviado");
  const nCd = (await um("select count(*)::int n from candidaturas where vaga_id=$1", [vaga.id])).n;
  checar("Reenvio envia o aviso sem duplicar a candidatura", reenvio.notificacao_status === "enviado" && reenvio.notificacao_tentativas === 2 && nCd === 3, JSON.stringify({ ...reenvio, nCd }));
  e = await nav.ir(`/pagina-carreiras/vagas/${vaga.id}`);
  checar("Visão interna: contagem, contato, data, currículo e link para o CRM", /Candidaturas \(3\)/.test(e.texto) && /Marina Candidata E2E/.test(e.texto) && !!(await nav.avaliar("!!document.querySelector('main a[href^=\"/crm/candidatos/\"]') && !!document.querySelector('main a[href^=\"/crm/anexos/\"]')")));
  e = await nav.ir(`/crm?q=${encodeURIComponent(EMAIL)}`);
  checar("Candidato aparece na busca do CRM", /Marina Candidata E2E/.test(e.texto));
  e = await nav.ir(`/crm/candidatos/${cand.id}`);
  checar("Ficha do CRM mostra a candidatura pela Página de Carreiras", /Candidatura pela Página de Carreiras/.test(e.texto) && e.texto.includes(TITULO));
  const anexo = await um("select id from anexos_candidato where candidato_id=$1 limit 1", [cand.id]);
  const dl = await nav.avaliar(`fetch('/crm/anexos/${anexo.id}',{redirect:'manual'}).then(r=>r.status + ' ' + r.type)`);
  checar("Currículo: usuário autorizado recebe redirecionamento para URL temporária", /^0 opaqueredirect|^30[27]/.test(dl), dl);

  // ── 7. Rate limit por e-mail e vaga ──
  const outro = `limite.${sufixo}@exemplo.test`;
  for (let i = 0; i < 3; i++) await candidatarUI(pub, urlVaga, { nome: "Limite E2E", email: outro, telefone: "(11) 94444-0000", arquivo: PDF });
  r = await candidatarUI(pub, urlVaga, { nome: "Limite E2E", email: outro, telefone: "(11) 94444-0000", arquivo: PDF });
  checar("Envio repetido em excesso é bloqueado", /várias vezes/.test(r));

  // ── 8. Encerrar / despublicar ──
  await pub.ir(urlVaga);
  await pub.esperarAte("document.querySelector('input[name=nome]')");
  e = await nav.ir(`/pagina-carreiras/vagas/${vaga.id}`);
  await nav.avaliar("window.confirm=()=>true;[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Encerrar vaga')).click()");
  await ateNoBanco("select status from vagas where id=$1", [vaga.id], (x) => x.status === "fechada");
  // Formulário aberto antes do encerramento: o servidor recusa.
  await pub.preencher({ "input[name=nome]": "Tarde E2E", "input[name=email]": `tarde.${sufixo}@exemplo.test`, "input[name=telefone]": "(11) 93333-0000" });
  await pub.anexar("input[name=curriculo]", PDF);
  await pub.avaliar("document.querySelector('input[name=nome]').form.requestSubmit()");
  await pub.esperarAte("document.querySelector('[role=alert]') || /Candidatura enviada/.test(document.body.innerText)", 20000);
  checar("Vaga encerrada recusa candidatura no servidor", /não está recebendo candidaturas/.test(await corpo(pub)) && !(await um("select 1 from candidatos where email_norm=$1", [`tarde.${sufixo}@exemplo.test`])));
  await pub.ir(urlVaga);
  checar("Página da vaga encerrada não mostra formulário", /não está recebendo candidaturas/.test(await corpo(pub)) && !(await pub.avaliar("!!document.querySelector('input[name=nome]')")));
  await pub.ir("/carreiras/aurora-tecnologia");
  checar("Vaga encerrada sai da listagem pública", !(await corpo(pub)).includes(TITULO));

  // ── 9. Isolamento e permissões ──
  await pub.ir("/carreiras/bravo-logistica");
  checar("Empresa sem CRM/ativa ou sem vagas: página própria, sem vagas da Aurora", !(await corpo(pub)).includes(TITULO));
  await pub.ir(`/carreiras/bravo-logistica/vagas/${vaga.slug}`);
  checar("Slug de vaga da Aurora não abre na página de outra empresa", /could not be found|não encontrad|404/i.test(await corpo(pub)));
  const semLogin = await pub.avaliar(`fetch('/crm/anexos/${anexo.id}',{redirect:'manual'}).then(r=>r.type + ' ' + r.status)`);
  const bravoDl = await (async () => {
    await nav.entrar("helena@bravo.test");
    return nav.avaliar(`fetch('/crm/anexos/${anexo.id}',{redirect:'manual'}).then(r=>r.status)`);
  })();
  checar("Currículo inacessível sem login e para outra empresa", !/^basic 200/.test(semLogin) && bravoDl === 404, `${semLogin} / ${bravoDl}`);
  e = await nav.ir(`/pagina-carreiras/vagas/${vaga.id}`);
  checar("Outra empresa não abre a vaga interna", !e.texto.includes(TITULO));
  e = await nav.entrar("carla@aurora.test");
  const menuC = await nav.avaliar("[...document.querySelectorAll('nav a')].map(a=>a.textContent.trim())");
  e = await nav.ir("/pagina-carreiras");
  checar("Sem permissão de CRM: sem menu e sem acesso", !menuC.includes("Página de Carreiras") && !e.url.startsWith("/pagina-carreiras"), e.url);
} finally {
  nav.fechar();
  pub.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
