// Empacota src/ em extension/dist/. Extensões MV3 não podem carregar código
// remoto, então o SDK da Anthropic precisa ir dentro do bundle.
import { existsSync, readFileSync, rmSync } from "node:fs";
import * as esbuild from "esbuild";

/**
 * Chaves embutidas (opcional): lidas de .env.local, fora do git. Com elas, a
 * equipe não precisa cadastrar chaves; sem elas, cada usuário informa as
 * próprias em Configurações. Quem tiver o pacote consegue extrair as chaves.
 */
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
const env = readEnv(".env.local");

const options = {
  entryPoints: {
    background: "src/background.js",
    sidepanel: "src/sidepanel.js",
    options: "src/options.js",
    offscreen: "src/offscreen.js",
    permission: "src/permission.js",
  },
  outdir: "extension/dist",
  bundle: true,
  format: "esm",
  // Separa em arquivos próprios o que é carregado sob demanda (import()).
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  target: "chrome120",
  minify: true,
  sourcemap: true,
  logLevel: "info",
  define: {
    __EMBEDDED_ANTHROPIC_KEY__: JSON.stringify(env.ANTHROPIC_API_KEY ?? ""),
    __EMBEDDED_GROQ_KEY__: JSON.stringify(env.GROQ_API_KEY ?? ""),
  },
};

console.log(
  `Chaves embutidas: Anthropic ${env.ANTHROPIC_API_KEY ? "sim" : "não"} · Groq ${env.GROQ_API_KEY ? "sim" : "não"}`,
);

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  // Remove arquivos de builds anteriores (chunks com hash antigo).
  rmSync(options.outdir, { recursive: true, force: true });
  await esbuild.build(options);
}
