// Testes E2E da base multitenant (dados do seed).
// Uso: node scripts/e2e/base.mjs   (app em localhost:3020, seed aplicado)
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { abrirNavegador } from "./navegador.mjs";

// Sempre o .env.local do projeto, independentemente da pasta de onde o script é executado.
config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)), quiet: true });
const adm = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await adm.connect();
const um = async (sql, p = []) => (await adm.query(sql, p)).rows[0];
const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
const BRAVO = (await um("select id from organizacoes where slug='bravo-logistica'")).id;
const carlaAurora = (await um("select id from colaboradores where email='carla@aurora.test'")).id;
const papelAurora = (await um("select id from papeis where tenant_id=$1 limit 1", [AURORA])).id;

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✔" : "✘"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}
const produtos = (t) => (t.split("Seus produtos")[1] ?? "").split(/Para você acompanhar|Conhecer outros produtos/)[0];

const nav = await abrirNavegador();
try {
  // 1. Organização com 6 módulos
  let e = await nav.entrar("ana@aurora.test");
  checar("Admin Aurora entra direto no início", e.url.startsWith("/inicio"), e.url);
  for (const m of ["CRM de Candidatos", "Onboarding", "Feedback 1:1", "Pulse", "PDI", "Diagnóstico NR-1"]) {
    checar(`Aurora vê ${m}`, produtos(e.texto).includes(m));
  }
  e = await nav.ir("/pessoas");
  const totalAurora = (await um("select count(*)::int n from colaboradores where tenant_id=$1", [AURORA])).n;
  checar("Aurora: cadastro mostra todas as pessoas da organização", new RegExp(`\\b${totalAurora} registros`).test(e.texto), `${e.texto.match(/\d+ registros?/)?.[0]} (banco: ${totalAurora})`);

  // 2. Organização com 1 módulo
  e = await nav.entrar("helena@bravo.test");
  checar("Bravo vê só CRM", produtos(e.texto).includes("CRM de Candidatos") && !produtos(e.texto).includes("Onboarding"));
  checar("Bravo vê outros produtos como não contratados", /Conhecer outros produtos/.test(e.texto) && /Diagnóstico NR-1/.test(e.texto));
  e = await nav.ir("/pessoas");
  checar("Bravo: só pessoas da Bravo", !/aurora\.test/.test(e.texto) && /bravo\.test/.test(e.texto));

  // 3. Isolamento: URL de registro de outra organização
  e = await nav.ir(`/pessoas/${carlaAurora}`);
  checar("Bravo não abre pessoa da Aurora pela URL", !/Carla Mendes/.test(e.texto), e.h1);
  e = await nav.ir(`/configuracoes/papeis/${papelAurora}`);
  checar("Bravo não abre papel da Aurora pela URL", !/Administrador da organização|Líder\/Gestor/.test(e.h1), e.h1);

  // 4. Isolamento: cookie de organização forjado
  await nav.cookie("jl_org", AURORA);
  e = await nav.ir("/pessoas");
  checar("Cookie forjado com id da Aurora é rejeitado", !/aurora\.test/.test(e.texto) && !e.url.startsWith("/pessoas"), e.url);

  // 5. Escopo do gestor e do colaborador
  e = await nav.entrar("bruno@aurora.test");
  e = await nav.ir("/pessoas");
  const nomes = ["Carla Mendes", "Diego Ferreira", "Elisa Rocha", "Fábio Nunes", "Gabriela Alves", "Bruno Martins"];
  checar("Gestor vê sua equipe", nomes.every((n) => e.texto.includes(n)));
  checar("Gestor não vê outras equipes", !/Marina Costa|Lucas Prado|Rafael Lima/.test(e.texto));
  e = await nav.ir("/configuracoes");
  checar("Gestor não acessa configurações", !e.url.startsWith("/configuracoes"), e.url);
  e = await nav.ir("/plataforma");
  checar("Gestor não acessa administração JourneyLab", !e.url.startsWith("/plataforma"), e.url);

  e = await nav.entrar("carla@aurora.test");
  e = await nav.ir("/pessoas");
  checar("Colaboradora não lista o cadastro", !e.url.startsWith("/pessoas"), e.url);
  checar("Colaboradora não vê NR-1 nem CRM no menu", !/CRM de Candidatos/.test(produtos((await nav.ir("/inicio")).texto)));

  // 6. Usuário em duas organizações
  e = await nav.entrar("consultor@parceiro.test");
  checar("Consultor escolhe organização", e.url.startsWith("/organizacoes") && /Aurora Tecnologia/.test(e.texto) && /Bravo Logística/.test(e.texto));
  await nav.avaliar(`[...document.querySelectorAll('main form button')].find(b=>b.textContent.includes('Bravo')).closest('form').requestSubmit()`);
  await new Promise((r) => setTimeout(r, 3000));
  e = await nav.estado();
  checar("Consultor na Bravo (admin) vê só CRM", produtos(e.texto).includes("CRM") && !produtos(e.texto).includes("PDI"));
  await nav.avaliar(`[...document.querySelectorAll('[data-trocar-org] form button')].find(b=>b.textContent.includes('Aurora')).closest('form').requestSubmit()`);
  await new Promise((r) => setTimeout(r, 3000));
  e = await nav.estado();
  checar("Consultor troca para Aurora (RH) e vê os módulos do papel RH", produtos(e.texto).includes("PDI") && !produtos(e.texto).includes("Diagnóstico NR-1"));
} finally {
  nav.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
