/**
 * Import único de contatos de prospecção (planilha
 * "contatos-find4you-2026-08-08.xlsx", fornecida pelo usuário) pro CRM.
 * Já rodou e os dados estão no banco — este arquivo fica só como
 * documentação da lógica exata usada, NÃO é re-executável a partir daqui.
 *
 * Consumia scripts/contatos-import.json (gerado por um script Python
 * separado que limpou a planilha), que continha nome/e-mail/telefone reais
 * de 453 pessoas — de propósito NÃO commitado neste repositório (que é
 * público no GitHub), pra não publicar dado pessoal de terceiros. Pra
 * reexecutar algo parecido no futuro, regenere esse JSON localmente a
 * partir de uma nova planilha e nunca dê `git add` nele.
 *
 * Premissas assumidas (documentadas pra revisão depois):
 * - Contato.empresaId é obrigatório no schema — as 102 linhas da planilha
 *   sem empresa preenchida foram DELIBERADAMENTE ignoradas (mesma regra do
 *   import de vagas: sem empresa não há como cadastrar corretamente). Lista
 *   completa dos nomes pulados em scripts/contatos-sem-empresa.json.
 * - Empresa é casada por nome (case-insensitive, trim) contra Empresa já
 *   cadastrada; se não existir, cria nova com cidade/estado do primeiro
 *   contato encontrado pra essa empresa.
 * - Quando a planilha tinha múltiplos e-mails/telefones separados por "|"
 *   pro mesmo contato, só o primeiro foi importado (Contato.email/telefone
 *   são campos únicos, não lista).
 * - Telefone "N/A" ou com menos de 8 dígitos virou null (não é um telefone
 *   de verdade) — o link de WhatsApp já aparece automaticamente em
 *   qualquer Contato com telefone válido (lib/whatsapp.ts#waLink), sem
 *   precisar de UI nova.
 * - Idempotente: pula contato já existente (mesmo nome, case-insensitive,
 *   na mesma empresa) — seguro rodar de novo.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type ContatoImport = {
  nome: string;
  cargo: string | null;
  area: "rh" | "tecnologia" | null;
  empresa: string;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  linkedin: string | null;
};

async function main() {
  const raw = readFileSync(join(__dirname, "contatos-import.json"), "utf-8");
  const contatos: ContatoImport[] = JSON.parse(raw);

  const empresasExistentes = await prisma.empresa.findMany({ select: { id: true, nome: true } });
  const empresaIdPorNomeLower = new Map(empresasExistentes.map((e) => [e.nome.trim().toLowerCase(), e.id]));

  let empresasCriadas = 0;
  let contatosCriados = 0;
  let contatosJaExistentes = 0;
  let comTelefoneValido = 0;

  for (const c of contatos) {
    const nomeEmpresaLower = c.empresa.trim().toLowerCase();
    let empresaId = empresaIdPorNomeLower.get(nomeEmpresaLower);

    if (!empresaId) {
      const empresa = await prisma.empresa.create({
        data: { nome: c.empresa.trim(), cidade: c.cidade, estado: c.estado },
      });
      empresaId = empresa.id;
      empresaIdPorNomeLower.set(nomeEmpresaLower, empresaId);
      empresasCriadas += 1;
    }

    const jaExiste = await prisma.contato.findFirst({
      where: { empresaId, nome: { equals: c.nome.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (jaExiste) {
      contatosJaExistentes += 1;
      continue;
    }

    await prisma.contato.create({
      data: {
        empresaId,
        nome: c.nome.trim(),
        cargo: c.cargo,
        area: c.area ?? undefined,
        telefone: c.telefone,
        email: c.email,
        linkedin: c.linkedin,
      },
    });
    contatosCriados += 1;
    if (c.telefone) comTelefoneValido += 1;
  }

  console.log("Empresas criadas:", empresasCriadas);
  console.log("Contatos criados:", contatosCriados);
  console.log("Contatos já existentes (pulados):", contatosJaExistentes);
  console.log("Contatos criados com telefone válido (WhatsApp automático):", comTelefoneValido);

  await prisma.$disconnect();
}

main();
