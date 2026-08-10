/**
 * Backfill único — os 351 contatos importados em
 * scripts/import-contatos-crm.ts ganharam campos novos (tipo, nível,
 * cidade, estado) depois da criação. Roda uma vez via
 * `npx tsx scripts/backfill-contatos-tipo-nivel.ts`, não faz parte do app
 * em runtime.
 *
 * Consome scripts/contatos-backfill.json (gerado localmente a partir da
 * mesma planilha original, NÃO commitado — mesma razão do import original:
 * dado pessoal de terceiros, repositório público).
 *
 * Casa por nome (case-insensitive) + empresa (case-insensitive) — mesma
 * chave usada na criação original, então cada linha atualiza exatamente o
 * contato que ela criou.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Backfill = {
  nome: string;
  empresa: string;
  tipo: "decisor" | "influenciador" | "usuario_final" | null;
  nivel: "c_level" | "diretor" | "gestao" | "senior" | "especialista" | null;
  cidade: string | null;
  estado: string | null;
};

async function main() {
  const raw = readFileSync(join(__dirname, "contatos-backfill.json"), "utf-8");
  const linhas: Backfill[] = JSON.parse(raw);

  let atualizados = 0;
  let naoEncontrados = 0;

  for (const linha of linhas) {
    const empresa = await prisma.empresa.findFirst({
      where: { nome: { equals: linha.empresa.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (!empresa) {
      naoEncontrados += 1;
      continue;
    }

    const resultado = await prisma.contato.updateMany({
      where: { empresaId: empresa.id, nome: { equals: linha.nome.trim(), mode: "insensitive" } },
      data: {
        tipo: linha.tipo ?? undefined,
        nivel: linha.nivel ?? undefined,
        cidade: linha.cidade,
        estado: linha.estado,
      },
    });
    if (resultado.count > 0) atualizados += resultado.count;
    else naoEncontrados += 1;
  }

  console.log("Contatos atualizados:", atualizados);
  console.log("Sem match (empresa ou contato não encontrado):", naoEncontrados);

  await prisma.$disconnect();
}

main();
