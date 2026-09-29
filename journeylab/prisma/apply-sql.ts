// Aplica um arquivo SQL com a conexão administrativa (DATABASE_MIGRATE_URL).
// Para prisma/rls.sql, também define a senha do papel da aplicação.
// Uso: npm run db:rls
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) throw new Error("Informe o arquivo SQL.");
  const client = new Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
  await client.connect();
  try {
    await client.query(readFileSync(arquivo, "utf8"));
    const senha = process.env.JOURNEYLAB_APP_DB_PASSWORD;
    if (arquivo.endsWith("rls.sql")) {
      if (!senha) throw new Error("Defina JOURNEYLAB_APP_DB_PASSWORD.");
      await client.query(`alter role journeylab_app password '${senha.replace(/'/g, "''")}'`);
    }
    console.log(`Aplicado: ${arquivo}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
