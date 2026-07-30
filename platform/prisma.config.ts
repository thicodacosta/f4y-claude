// Config do Prisma CLI (migrate/generate/studio). Carrega .env.local — o
// mesmo arquivo que o Next.js usa — para não duplicar variável de ambiente
// em dois lugares. Ver .env.example para a lista de variáveis esperadas.
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

// process.env direto (não o helper `env()`) de propósito: `env()` lança erro
// se a variável não existir, o que quebraria `prisma generate` num clone
// novo do repositório antes do .env.local existir. `migrate`/`studio` seguem
// falhando normalmente na conexão se a URL estiver ausente — só `generate`
// (que não precisa de banco) fica desbloqueado.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7 (@prisma/config) só aceita `url`/`shadowDatabaseUrl` aqui —
    // não há `directUrl` neste nível. Para Supabase, use a connection string
    // direta (porta 5432, não o pooler 6543) em DATABASE_URL para rodar
    // `prisma migrate dev` sem as limitações do pgbouncer em modo transação;
    // DIRECT_URL fica reservada em .env.example para quando o app em
    // produção precisar diferenciar pooler (runtime) de conexão direta
    // (migrations) — ver platform/README.md.
    url: process.env["DATABASE_URL"],
  },
});
