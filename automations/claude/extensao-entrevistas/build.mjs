// Empacota src/ em extension/dist/. Extensões MV3 não podem carregar código
// remoto, então o SDK da Anthropic precisa ir dentro do bundle.
import * as esbuild from "esbuild";

const options = {
  entryPoints: { sidepanel: "src/sidepanel.js", options: "src/options.js" },
  outdir: "extension/dist",
  bundle: true,
  format: "esm",
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
