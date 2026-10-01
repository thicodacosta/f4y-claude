// Testes E2E da personalização da Página de Carreiras: envio de imagens (validação
// real), capa, sobre, blocos de texto e imagem, benefícios, depoimentos, galeria,
// banco de talentos e links; renderização pública, filtros de vagas e isolamento.
// Uso: node journeylab/scripts/e2e/carreiras-pagina.mjs   (app em localhost:3020)
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
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

/** PNG gerado localmente: gradiente entre duas cores (sem dependências). */
function png(caminho, largura, altura, [r1, g1, b1], [r2, g2, b2]) {
  const crcTab = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTab[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloco = (tipo, dados) => {
    const t = Buffer.from(tipo);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(dados.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, dados])));
    return Buffer.concat([len, t, dados, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const linhas = [];
  for (let y = 0; y < altura; y++) {
    const l = Buffer.alloc(1 + largura * 3);
    for (let x = 0; x < largura; x++) {
      const t = (x / largura + y / altura) / 2;
      l[1 + x * 3] = Math.round(r1 + (r2 - r1) * t);
      l[2 + x * 3] = Math.round(g1 + (g2 - g1) * t);
      l[3 + x * 3] = Math.round(b1 + (b2 - b1) * t);
    }
    linhas.push(l);
  }
  writeFileSync(caminho, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco("IHDR", ihdr), bloco("IDAT", deflateSync(Buffer.concat(linhas))), bloco("IEND", Buffer.alloc(0))]));
}

const pasta = mkdtempSync(join(tmpdir(), "jl-pagina-"));
const IMG = {
  capa: join(pasta, "capa.png"),
  sobre: join(pasta, "sobre.png"),
  bloco: join(pasta, "bloco.png"),
  foto: join(pasta, "foto.png"),
  g1: join(pasta, "g1.png"),
  g2: join(pasta, "g2.png"),
  falsa: join(pasta, "falsa.png"),
};
png(IMG.capa, 480, 200, [11, 31, 58], [20, 184, 166]);
png(IMG.sobre, 320, 240, [20, 184, 166], [224, 242, 241]);
png(IMG.bloco, 320, 240, [30, 58, 95], [148, 163, 184]);
png(IMG.foto, 96, 96, [232, 163, 23], [251, 191, 36]);
png(IMG.g1, 240, 240, [82, 97, 115], [226, 232, 240]);
png(IMG.g2, 240, 240, [14, 122, 78], [187, 247, 208]);
writeFileSync(IMG.falsa, "não é imagem");

const AURORA = (await um("select id from organizacoes where slug='aurora-tecnologia'")).id;
await adm.query("delete from paginas_carreiras where tenant_id=$1", [AURORA]);
// Duas vagas publicadas para os filtros (e uma para o banco de talentos).
const rafael = await um("select id, email from usuarios where email='rafael@aurora.test'");
for (const [titulo, slug, local, modelo, tipo] of [
  ["Designer de Produto E2E", "designer-de-produto-e2e", "São Paulo/SP", "hibrido", "clt"],
  ["Banco de talentos E2E", "banco-de-talentos-e2e", "Remoto (Brasil)", "remoto", "clt"],
]) {
  await adm.query(
    `insert into vagas (id,tenant_id,titulo,slug,local,modelo,tipo_contratacao,status,publicada,publicada_em,criado_por,criado_por_usuario_id,email_notificacao,email_confirmado_em,aberta_em,atualizado_em)
     values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,'aberta',true,now(),'Rafael Lima',$7,$8,now(),now(),now())
     on conflict (tenant_id, slug) do update set publicada=true, status='aberta'`,
    [AURORA, titulo, slug, local, modelo, tipo, rafael.id, rafael.email],
  );
}

const nav = await abrirNavegador(9457);
const pub = await abrirNavegador(9458);
const enviarImagem = async (rotulo, arquivo) => {
  const antes = await nav.avaliar("document.querySelectorAll('main img').length");
  await nav.anexar(`input[aria-label="Enviar ${rotulo.toLowerCase()}"]`, arquivo);
  await nav.esperarAte(`document.querySelectorAll('main img').length > ${antes}`, 20000);
};
const set = (sel, v) => nav.preencher({ [sel]: v });

try {
  // ── 1. Acesso ──
  let e = await nav.entrar("carla@aurora.test");
  e = await nav.ir("/pagina-carreiras/configuracoes");
  checar("Sem permissão no CRM: configurações da página bloqueadas", !e.url.startsWith("/pagina-carreiras/configuracoes"), e.url);
  e = await nav.entrar("rafael@aurora.test");
  e = await nav.ir("/pagina-carreiras");
  checar("Aba “Configurações da página” na Página de Carreiras", !!(await nav.avaliar("!!document.querySelector('a[href=\"/pagina-carreiras/configuracoes\"]')")));
  e = await nav.ir("/pagina-carreiras/configuracoes");
  checar("Editor com as seções da página", ["Capa", "Sobre a empresa", "Blocos de texto e imagem", "Benefícios", "Depoimentos", "Galeria", "Banco de talentos", "Conheça mais"].every((t) => e.texto.includes(t)));

  // ── 2. Imagens ──
  await nav.anexar('input[aria-label="Enviar imagem de capa"]', IMG.falsa);
  await nav.esperarAte("/Formato não aceito/.test(document.body.innerText)", 15000);
  checar("Arquivo que não é imagem é recusado pelo servidor", /Formato não aceito/.test(await nav.avaliar("document.body.innerText")));
  await enviarImagem("imagem de capa", IMG.capa);
  const nMidias = (await um("select count(*)::int n from midias_carreiras where tenant_id=$1", [AURORA])).n;
  checar("Imagem enviada e registrada na organização", nMidias >= 1);

  // ── 3. Conteúdo ──
  await set('input[placeholder="Ex.: Tecnologia que transforma o comércio global"]', "Tecnologia que transforma pessoas e negócios");
  await set('input[placeholder="Ex.: Faça parte do nosso time"]', "Faça parte do time da Aurora");
  await nav.avaliar(`[...document.querySelectorAll('input[aria-label^="Descrição da imagem"]')][0] && (()=>{const i=document.querySelector('input[aria-label^="Descrição da imagem (Imagem de capa)"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Equipe da Aurora reunida');i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const secao = (t) => `[...document.querySelectorAll('main section')].find(s=>s.querySelector('h3')?.textContent==='${t}')`;
  await nav.avaliar(`(()=>{const s=${secao("Sobre a empresa")};const f=(el,v)=>{Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
    f(s.querySelector('input'),'Estamos transformando a gestão de pessoas');f(s.querySelector('textarea'),'Somos uma empresa de tecnologia.\\nAntes de conectar sistemas, conectamos pessoas.');})()`);
  await enviarImagem("imagem", IMG.sobre);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Adicionar bloco')).click()`);
  await esperar(300);
  await nav.avaliar(`(()=>{const s=${secao("Blocos de texto e imagem")};const f=(el,v)=>{Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
    f(s.querySelector('fieldset input'),'Cultura de aprendizado');f(s.querySelector('fieldset textarea'),'Trilhas de desenvolvimento e mentorias para todo o time.');})()`);
  await enviarImagem("imagem do bloco", IMG.bloco);
  await nav.avaliar(`(()=>{const s=${secao("Benefícios")};const t=s.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Plano de saúde nacional\\nVale-refeição\\nDay-off de aniversário');t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Adicionar depoimento')).click()`);
  await esperar(300);
  await nav.avaliar(`(()=>{const s=${secao("Depoimentos")};const f=(el,v)=>{Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
    const i=s.querySelectorAll('fieldset input:not([type=file])');f(i[0],'Luiza Prado');f(i[1],'Analista Financeira');f(s.querySelector('fieldset textarea'),'Aqui meu trabalho é reconhecido e tenho espaço para crescer.');})()`);
  await enviarImagem("foto", IMG.foto);
  await enviarImagem("nova foto", IMG.g1);
  await enviarImagem("nova foto", IMG.g2);
  await nav.avaliar(`(()=>{const s=${secao("Banco de talentos")};s.querySelector('input[type=checkbox]').click();})()`);
  await esperar(300);
  await nav.avaliar(`(()=>{const s=${secao("Banco de talentos")};const sel=s.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(sel,'banco-de-talentos-e2e');sel.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await nav.avaliar(`(()=>{const s=${secao("Conheça mais")};const i=s.querySelectorAll('input');const f=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};f(i[0],'https://aurora.exemplo.test');f(i[1],'http://inseguro.test');})()`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Salvar página').click()`);
  await nav.esperarAte("document.querySelector('[role=alert]')", 15000);
  const diag = await nav.avaliar("[...document.querySelectorAll('[role=alert],[data-sonner-toast]')].map(e=>e.textContent).join(' | ') + ' #imgs=' + document.querySelectorAll('main img').length + ' url=' + location.pathname");
  checar("Link sem https é recusado ao salvar", /https/.test(diag), diag);
  await nav.avaliar(`(()=>{const s=${secao("Conheça mais")};const i=s.querySelectorAll('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i[1],'https://www.linkedin.com/company/aurora');i[1].dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await nav.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Salvar página').click()`);
  await nav.esperarAte("[...document.querySelectorAll('[data-sonner-toast]')].some(t=>/Página de carreiras atualizada/.test(t.textContent))", 30000);
  let salvo = null;
  for (let i = 0; i < 40 && !salvo; i++) {
    salvo = (await um("select conteudo from paginas_carreiras where tenant_id=$1", [AURORA]))?.conteudo;
    await esperar(400);
  }
  checar(
    "Conteúdo salvo com imagens, textos, benefícios, depoimento, galeria e links",
    !!salvo && !!salvo.capa.imagem && salvo.capa.imagem.alt === "Equipe da Aurora reunida" && !!salvo.sobre.imagem && salvo.blocos.length === 1 && salvo.beneficios.itens.length === 3 && salvo.depoimentos[0]?.foto && salvo.galeria.length === 2 && salvo.links.linkedin.startsWith("https://"),
    JSON.stringify(salvo)?.slice(0, 200),
  );

  // Imagem de outra organização (para os testes de isolamento da rota pública).
  const midiaBravo = await um(
    "insert into midias_carreiras (id,tenant_id,caminho,nome_arquivo,mime,tamanho,enviado_por) values (gen_random_uuid(),(select id from organizacoes where slug='bravo-logistica'),'x/'||gen_random_uuid(),'x.png','image/png',1,'t') returning id",
  );

  // ── 4. Página pública ──
  e = await pub.ir("/carreiras/aurora-tecnologia");
  const txt = await pub.avaliar("document.body.innerText");
  checar("Capa com título e chamada configurados", txt.includes("Tecnologia que transforma pessoas e negócios") && txt.includes("Faça parte do time da Aurora"));
  checar("Sobre, bloco de texto e imagem, benefícios e depoimento", ["Estamos transformando a gestão de pessoas", "Cultura de aprendizado", "Plano de saúde nacional", "Luiza Prado", "Analista Financeira"].every((t) => txt.includes(t)));
  // Imagens abaixo da dobra usam carregamento preguiçoso: confere cada uma buscando a URL.
  const imgs = await pub.avaliar("Promise.all([...document.querySelectorAll('main img')].map(async i=>({src:i.getAttribute('src'),alt:i.getAttribute('alt'),lazy:i.loading,status:(await fetch(i.getAttribute('src'))).status})))");
  checar("Imagens servidas pela rota pública da empresa (capa imediata, demais sob demanda)", imgs.length >= 6 && imgs.every((i) => i.src.startsWith("/carreiras/aurora-tecnologia/midia/") && i.status === 200) && imgs[0].lazy === "eager" && imgs.slice(1).every((i) => i.lazy === "lazy"), `${imgs.length} imagens`);
  checar("Texto alternativo aplicado", imgs.some((i) => i.alt === "Equipe da Aurora reunida"));
  checar("Banco de talentos leva à vaga escolhida", !!(await pub.avaliar("!!document.querySelector('a[href=\"/carreiras/aurora-tecnologia/vagas/banco-de-talentos-e2e\"]')")));
  checar("Links oficiais exibidos", !!(await pub.avaliar("!!document.querySelector('a[href=\"https://www.linkedin.com/company/aurora\"]')")));
  e = await pub.ir("/carreiras/aurora-tecnologia?modalidade=hibrido#vagas");
  const filtrado = await pub.avaliar("document.querySelector('#vagas').innerText");
  checar("Filtro por modo de trabalho", filtrado.includes("Designer de Produto E2E") && !filtrado.includes("Banco de talentos E2E") && /1 filtro/.test(filtrado));
  e = await pub.ir("/carreiras/aurora-tecnologia?q=designer#vagas");
  checar("Busca por palavra-chave", (await pub.avaliar("document.querySelector('#vagas').innerText")).includes("Designer de Produto E2E"));
  const og = await pub.avaliar("document.querySelector('meta[property=\"og:image\"]')?.content ?? ''");
  checar("Imagem de capa como og:image (compartilhamento)", og.includes("/midia/"), og);

  // ── 5. Isolamento das imagens ──
  const capaId = salvo.capa.imagem.id;
  const outra = await pub.avaliar(`fetch('/carreiras/bravo-logistica/midia/${capaId}').then(r=>r.status)`);
  checar("Imagem da Aurora não é servida pela página de outra empresa", outra === 404, String(outra));
  const bravoNaAurora = await pub.avaliar(`fetch('/carreiras/aurora-tecnologia/midia/${midiaBravo.id}').then(r=>r.status)`);
  checar("Imagem da Bravo não é servida pela página da Aurora", bravoNaAurora === 404, String(bravoNaAurora));
  const anexo = await um("select id from anexos_candidato limit 1");
  const cv = anexo ? await pub.avaliar(`fetch('/carreiras/aurora-tecnologia/midia/${anexo.id}').then(r=>r.status)`) : 404;
  checar("Currículos nunca passam pela rota de imagens", cv === 404, String(cv));
  const tipo = await pub.avaliar(`fetch('/carreiras/aurora-tecnologia/midia/${capaId}').then(r=>r.headers.get('content-type')+'|'+r.headers.get('x-content-type-options'))`);
  checar("Imagem servida com tipo gravado e nosniff", tipo === "image/png|nosniff", tipo);
  await adm.query("delete from midias_carreiras where id=$1", [midiaBravo.id]);

  // ── 6. Conteúdo vazio: seções somem, página continua funcional ──
  await adm.query("update paginas_carreiras set conteudo='{\"quebrado\":1}' where tenant_id=$1", [AURORA]);
  e = await pub.ir("/carreiras/aurora-tecnologia");
  const vazio = await pub.avaliar("document.body.innerText");
  checar("Conteúdo ausente/inválido não quebra a página (padrões e vagas)", /Trabalhe na Aurora Tecnologia/.test(vazio) && /Vagas abertas/.test(vazio) && !/Luiza Prado/.test(vazio));
  await adm.query("update paginas_carreiras set conteudo=$2 where tenant_id=$1", [AURORA, JSON.stringify(salvo)]);
} finally {
  nav.fechar();
  pub.fechar();
  await adm.end();
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
