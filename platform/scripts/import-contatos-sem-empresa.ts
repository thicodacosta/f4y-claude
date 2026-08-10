/**
 * Segunda leva do import de contatos de prospecção — os 102 contatos da
 * mesma planilha que não tinham empresa preenchida (deliberadamente
 * pulados em scripts/import-contatos-crm.ts, na época Contato.empresaId
 * era obrigatório). Depois de Contato.empresaId virar opcional, este
 * script cria esses 102 com empresaId=null. Roda uma vez via
 * `npx tsx scripts/import-contatos-sem-empresa.ts`, não faz parte do app
 * em runtime.
 *
 * Consome scripts/contatos-sem-empresa-full.json (gerado localmente a
 * partir da planilha original, NÃO commitado — mesma razão de sempre:
 * dado pessoal de terceiros, repositório público).
 *
 * Idempotente: pula quem já existe (mesmo nome, case-insensitive, sem
 * empresa) — seguro rodar de novo.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type ContatoSemEmpresa = {
  nome: string;
  cargo: string | null;
  area: "rh" | "tecnologia" | null;
  tipo: "decisor" | "influenciador" | "usuario_final" | null;
  nivel: "c_level" | "diretor" | "gestao" | "senior" | "especialista" | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  linkedin: string | null;
};

async function main() {
  const raw = readFileSync(join(__dirname, "contatos-sem-empresa-full.json"), "utf-8");
  const contatos: ContatoSemEmpresa[] = JSON.parse(raw);

  let criados = 0;
  let jaExistentes = 0;

  for (const c of contatos) {
    const jaExiste = await prisma.contato.findFirst({
      where: { empresaId: null, nome: { equals: c.nome.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (jaExiste) {
      jaExistentes += 1;
      continue;
    }

    await prisma.contato.create({
      data: {
        empresaId: null,
        nome: c.nome.trim(),
        cargo: c.cargo,
        area: c.area ?? undefined,
        tipo: c.tipo ?? undefined,
        nivel: c.nivel ?? undefined,
        cidade: c.cidade,
        estado: c.estado,
        telefone: c.telefone,
        email: c.email,
        linkedin: c.linkedin,
      },
    });
    criados += 1;
  }

  console.log("Contatos criados (sem empresa):", criados);
  console.log("Já existentes (pulados):", jaExistentes);

  await prisma.$disconnect();
}

main();
