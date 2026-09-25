// Empacota src/ em extension/dist/. Extensões MV3 não podem carregar código
// remoto, então o SDK da Anthropic precisa ir dentro do bundle.
import * as esbuild from "esbuild";

const options = {
  entryPoints: {
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
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
