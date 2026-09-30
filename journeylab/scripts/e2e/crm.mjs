// Testes E2E do CRM de Candidatos (dados do seed).
// Uso: node journeylab/scripts/e2e/crm.mjs   (app em localhost:3020, seed aplicado)
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador } from "./navegador.mjs";

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
const BRAVO = (await um("select id from organizacoes where slug='bravo-logistica'")).id;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

// PDF mínimo válido e um arquivo falso com extensão .pdf.
const pdf = join(tmpdir(), "curriculo-e2e.pdf");
writeFileSync(pdf, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const falso = join(tmpdir(), "falso-e2e.pdf");
writeFileSync(falso, "MZ executável disfarçado");

const sufixo = Date.now();
const nav = await abrirNavegador(9446);
try {
  // 1. RH da Aurora cadastra candidato
  let e = await nav.entrar("rafael@aurora.test");
  // Busca por nome: a lista é paginada e execuções anteriores acumulam candidatos de teste.
  e = await nav.ir("/crm?q=Beatriz");
  const beatriz = /Beatriz Oliveira/.test(e.texto);
  e = await nav.ir("/crm?q=Henrique");
  checar("RH vê candidatos do seed da Aurora (e não os da Bravo)", beatriz && !/Henrique Castro/.test(e.texto));
  e = await nav.ir("/crm");
  e = await nav.ir("/crm/candidatos/novo");
  await nav.preencher({
    "input[name=nome]": `Candidata E2E ${sufixo}`,
    "input[name=email]": `candidata.${sufixo}@exemplo.test`,
    "input[name=telefone]": `(11) 9${String(sufixo).slice(-8)}`,
    "input[name=cidade]": "São Paulo",
    "input[name=uf]": "sp",
    "input[name=competencias]": "Recrutamento, People Analytics",
    "input[name=tags]": "E2E, Indicação",
  });
  e = await nav.enviar("input[name=nome]", 1000);
  await nav.esperarAte("/\\/crm\\/candidatos\\/[0-9a-f-]{36}$/.test(location.pathname)");
  e = await nav.estado();
  const candId = e.url.split("/").pop();
  checar("Cadastro cria candidato e abre a ficha", /^[0-9a-f-]{36}$/.test(candId), e.url);

  // 2. Duplicidade: mesmo e-mail é bloqueado sem confirmação
  e = await nav.ir("/crm/candidatos/novo");
  await nav.preencher({ "input[name=nome]": "Outra Pessoa", "input[name=email]": `CANDIDATA.${sufixo}@exemplo.test` });
  await nav.enviar("input[name=nome]", 3000);
  checar("Duplicidade por e-mail é detectada", /Possível duplicidade/.test(await nav.mensagem()), await nav.mensagem());

  // 3. Upload: arquivo falso recusado; PDF aceito; download protegido
  e = await nav.ir(`/crm/candidatos/${candId}`);
  await nav.anexar("#arquivo", falso);
  await nav.enviar("#arquivo", 3000);
  checar("Arquivo com assinatura inválida é recusado", /Formato não aceito/.test(await nav.mensagem()), await nav.mensagem());
  await nav.ir(`/crm/candidatos/${candId}`);
  await nav.anexar("#arquivo", pdf);
  await nav.enviar("#arquivo", 4000);
  const anexo = await um("select id, caminho from anexos_candidato where candidato_id=$1", [candId]);
  checar("Currículo PDF enviado e caminho prefixado pela organização", anexo?.caminho.startsWith(`${AURORA}/crm/`), anexo?.caminho);
  const download = await nav.avaliar(`fetch('/crm/anexos/${anexo?.id}', {redirect:'manual'}).then(r=>r.type+'|'+r.status)`);
  checar("Download gera redirecionamento para URL temporária", /opaqueredirect|30[27]/.test(download), download);

  // 4. Vaga, situação e conversão com vínculo ao cadastro
  const vaga = await um("select id from vagas where tenant_id=$1 and titulo like 'Pessoa Desenvolvedora%'", [AURORA]);
  await nav.ir(`/crm/candidatos/${candId}`);
  await nav.preencher({ "select[name=vagaId]": vaga.id });
  await nav.enviar("select[name=vagaId]", 3000);
  const cd = await um("select id, status from candidaturas where candidato_id=$1", [candId]);
  checar("Candidato associado à vaga", cd?.status === "inscrito");
  await nav.ir(`/crm/candidatos/${candId}`);
  await nav.avaliar(`(()=>{const f=document.querySelector('input[name=id][value="${cd.id}"]').form;const s=f.querySelector('select[name=status]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'contratado');f.requestSubmit();})()`);
  await esperar(3000);
  checar("Situação alterada para contratado", (await um("select status from candidaturas where id=$1", [cd.id])).status === "contratado");
  const hist = await um("select count(*)::int n from interacoes_candidato where candidato_id=$1 and texto like '%Contratado%'", [candId]);
  checar("Mudança de situação registrada no histórico", hist.n >= 1);

  await nav.ir(`/crm/candidatos/${candId}`);
  await nav.preencher({ "input[name=cargo]": "Analista de RH", "input[name=dataAdmissao]": "2026-10-15", "select[name=candidaturaId]": cd.id });
  await nav.enviar("input[name=dataAdmissao]", 1000);
  await nav.esperarAte("location.pathname.startsWith('/pessoas/')");
  e = await nav.estado();
  checar("Conversão cria colaborador e abre o cadastro de pessoas", e.url.startsWith("/pessoas/") && /Originada de candidato/.test(e.texto), e.url);
  const colab = await um("select status, candidato_origem_id from colaboradores where candidato_origem_id=$1", [candId]);
  checar("Colaborador em pré-admissão vinculado ao candidato", colab?.status === "pre_admissao");
  await nav.ir(`/crm/candidatos/${candId}`);
  const reconverter = await nav.avaliar("!!document.querySelector('input[name=modo]') || !!document.querySelector('select[name=modo]')");
  checar("Candidato convertido não pode ser convertido de novo", !reconverter);

  // 5. Exportação: RH pode; gestor e colaboradora não
  const exp = await nav.avaliar(`fetch('/crm/exportar').then(async r=>r.status+'|'+r.headers.get('content-type')+'|'+(await r.text()).includes('Beatriz Oliveira'))`);
  checar("RH exporta CSV com permissão", /^200\|text\/csv.*\|true$/.test(exp), exp);
  const aud = await um("select count(*)::int n from auditoria where tenant_id=$1 and acao='crm.exportar'", [AURORA]);
  checar("Exportação auditada", aud.n >= 1);
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir("/crm");
  checar("Gestor sem permissão de CRM é bloqueado no servidor", !e.url.startsWith("/crm"), e.url);
  const expG = await nav.avaliar(`fetch('/crm/exportar').then(r=>r.status)`);
  checar("Gestor não exporta (403)", expG === 403, String(expG));

  // 6. Isolamento: Bravo não acessa candidato, vaga nem anexo da Aurora
  e = await nav.entrar("helena@bravo.test");
  e = await nav.ir("/crm");
  checar("Bravo vê só candidatos da Bravo", /Henrique Castro/.test(e.texto) && !/Beatriz Oliveira/.test(e.texto));
  e = await nav.ir(`/crm/candidatos/${candId}`);
  checar("Bravo não abre candidato da Aurora pela URL", !/Candidata E2E/.test(e.texto), e.h1);
  e = await nav.ir(`/crm/vagas/${vaga.id}`);
  checar("Bravo não abre vaga da Aurora pela URL", !/Pessoa Desenvolvedora/.test(e.texto), e.h1);
  const dl = await nav.avaliar(`fetch('/crm/anexos/${anexo?.id}', {redirect:'manual'}).then(r=>r.status)`);
  checar("Bravo não baixa anexo da Aurora (404)", dl === 404, String(dl));
  const expB = await nav.avaliar(`fetch('/crm/exportar').then(r=>r.text())`);
  checar("Exportação da Bravo não contém dados da Aurora", !/Beatriz|Candidata E2E/.test(expB) && /Henrique Castro/.test(expB));
  const bravoCand = await um("select id from candidatos where tenant_id=$1 and nome='Isabela Freitas'", [BRAVO]);
  e = await nav.ir(`/crm/candidatos/${bravoCand.id}`);
  checar("Empresa só com CRM não oferece iniciar onboarding", /Converter em colaborador/.test(e.texto) && !/Iniciar onboarding/.test(e.texto));

  // 7. Colaboradora sem CRM no papel
  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir("/crm");
  checar("Colaboradora não acessa o CRM", !e.url.startsWith("/crm"), e.url);
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
