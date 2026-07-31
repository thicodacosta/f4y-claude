import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gerado pelo Supabase CLI (supabase start/stop) — não é código do projeto.
    "supabase/.temp/**",
    // Gerado pelo Prisma — client tipado, não código do projeto.
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
