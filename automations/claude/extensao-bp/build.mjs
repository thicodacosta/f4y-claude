// Empacota src/ em extension/dist/ e gera a página pública das pesquisas
// (public-dist/index.html).
//
// O BP reaproveita os módulos da ToolsKit (../extensao-entrevistas/src): login,
// IA (Claude/Groq), PDF com a marca, tema e motor do Chat. Nada é copiado para
// cá no código-fonte: o esbuild empacota direto de lá, e os estilos e ícones
// base são copiados para dist/ a cada build. Por isso a ToolsKit precisa estar
// com `npm install` feito.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as esbuild from "esbuild";

const TOOLSKIT = "../extensao-entrevistas";

function readEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
  );
}
// Valores próprios do BP têm prioridade; o que faltar vem da ToolsKit (mesmas
// chaves de IA e mesmo projeto Supabase de contas).
const toolskitEnv = readEnv(`${TOOLSKIT}/.env.local`);
// `--env <arquivo>` troca o .env.local (ex.: Supabase local para testes).
const envFlag = process.argv.indexOf("--env");
const ownEnv = readEnv(envFlag > 0 ? process.argv[envFlag + 1] : ".env.local");
const env = { ...toolskitEnv, ...Object.fromEntries(Object.entries(ownEnv).filter(([, v]) => v)) };

if (!existsSync(`${TOOLSKIT}/node_modules`)) {
  console.error(`Rode \`npm install\` em ${TOOLSKIT} antes: o BP usa as dependências da ToolsKit.`);
  process.exit(1);
}

const outdir = "extension/dist";
const options = {
  entryPoints: {
    sidepanel: "src/sidepanel.js",
    options: "src/options.js",
    motion: "src/motion/player-page.js",
  },
  outdir,
  bundle: true,
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  target: "chrome120",
  minify: true,
  sourcemap: true,
  logLevel: "info",
  // Dependências dos módulos da ToolsKit resolvem pelo node_modules de lá.
  nodePaths: [`${TOOLSKIT}/node_modules`],
  define: {
    __EMBEDDED_ANTHROPIC_KEY__: JSON.stringify(env.ANTHROPIC_API_KEY ?? ""),
    __EMBEDDED_GROQ_KEY__: JSON.stringify(env.GROQ_API_KEY ?? ""),
    __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ""),
    __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY ?? ""),
    __BP_PUBLIC_URL__: JSON.stringify(env.BP_PUBLIC_URL ?? ""),
  },
};

console.log(
  `IA embutida: Anthropic ${env.ANTHROPIC_API_KEY ? "sim" : "não"} · Groq ${env.GROQ_API_KEY ? "sim" : "não"} · ` +
    `Supabase ${env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY ? env.SUPABASE_URL : "não configurado"} · ` +
    `página pública ${env.BP_PUBLIC_URL || "não configurada"}`,
);

/**
 * Estilos e tema base da ToolsKit, copiados para dist/; ícones e logo para
 * extension/icons/ (mesmo caminho da ToolsKit: o login e o topo do painel,
 * compartilhados, procuram o logo lá).
 */
function copyShared() {
  mkdirSync("extension/icons", { recursive: true });
  copyFileSync(`${TOOLSKIT}/extension/styles.css`, `${outdir}/base.css`);
  copyFileSync(`${TOOLSKIT}/extension/theme-init.js`, `${outdir}/theme-init.js`);
  for (const icon of ["icon-16.png", "icon-48.png", "icon-128.png", "candydate-logo.png", "toolbar-hint.png"]) {
    copyFileSync(`${TOOLSKIT}/extension/icons/${icon}`, `extension/icons/${icon}`);
  }
  copyFileSync(`${TOOLSKIT}/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`, `${outdir}/pdf.worker.mjs`);
}

/**
 * Página pública de resposta (sem login): um único HTML estático, com a URL e
 * a chave publicável do Supabase embutidas. Publique `public-dist/` em
 * qualquer hospedagem estática (Vercel, Netlify, GitHub Pages).
 */
function buildPublicPage() {
  const html = readFileSync("public/responder.html", "utf8")
    .replace("__SUPABASE_URL__", env.SUPABASE_URL ?? "")
    .replace("__SUPABASE_PUBLISHABLE_KEY__", env.SUPABASE_PUBLISHABLE_KEY ?? "");
  mkdirSync("public-dist", { recursive: true });
  writeFileSync("public-dist/index.html", html);
  // Página de assinatura (checkout com cupom; chama a Edge Function checkout).
  writeFileSync("public-dist/assinar.html", readFileSync("public/assinar.html", "utf8").replace("__SUPABASE_URL__", env.SUPABASE_URL ?? ""));
  cpSync(`${TOOLSKIT}/extension/icons/candydate-logo.png`, "public-dist/candydate-logo.png");
}

if (process.argv.includes("--watch")) {
  copyShared();
  buildPublicPage();
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  rmSync(outdir, { recursive: true, force: true });
  await esbuild.build(options);
  copyShared();
  buildPublicPage();
}
