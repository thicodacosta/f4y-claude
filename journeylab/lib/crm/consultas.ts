import "server-only";

import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { DbCliente, Tx } from "@/lib/db";
import { normalizarEmail, normalizarLinkedin, normalizarTelefone, normalizarTexto, STATUS_CANDIDATURA } from "./normalizar";

/**
 * Escopo no CRM: "todos" vê a base inteira; "equipe"/"próprio" veem apenas
 * candidatos associados a vagas em que a pessoa é a gestora responsável.
 */
export function filtroCandidatos(ctx: Contexto, escopo: Escopo): Prisma.CandidatoWhereInput {
  if (escopo === "todos") return {};
  const eu = ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000";
  return { candidaturas: { some: { vaga: { gestorId: eu } } } };
}

export function filtroVagas(ctx: Contexto, escopo: Escopo): Prisma.VagaWhereInput {
  if (escopo === "todos") return {};
  return { gestorId: ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000" };
}

export type Duplicado = { id: string; nome: string; motivo: string };

/** Possíveis duplicidades por e-mail, telefone, LinkedIn ou nome idêntico (dentro da organização). */
export async function buscarDuplicidades(
  db: DbCliente | Tx,
  dados: { nome: string; email?: string | null; telefone?: string | null; linkedin?: string | null },
  excluirId?: string,
): Promise<Duplicado[]> {
  const email = normalizarEmail(dados.email);
  const tel = normalizarTelefone(dados.telefone);
  const li = normalizarLinkedin(dados.linkedin);
  const nome = normalizarTexto(dados.nome);
  const ou: Prisma.CandidatoWhereInput[] = [{ nomeNorm: nome }];
  if (email) ou.push({ emailNorm: email });
  if (tel) ou.push({ telefoneNorm: tel });
  if (li) ou.push({ linkedinNorm: li });
  const achados = await db.candidato.findMany({
    where: { OR: ou, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { id: true, nome: true, emailNorm: true, telefoneNorm: true, linkedinNorm: true, nomeNorm: true },
    take: 10,
  });
  return achados.map((c) => ({
    id: c.id,
    nome: c.nome,
    motivo: [
      email && c.emailNorm === email && "mesmo e-mail",
      tel && c.telefoneNorm === tel && "mesmo telefone",
      li && c.linkedinNorm === li && "mesmo LinkedIn",
      c.nomeNorm === nome && "mesmo nome",
    ]
      .filter(Boolean)
      .join(", "),
  }));
}

/** Filtros da lista de candidatos (também usados na exportação). */
export function filtroLista(sp: Record<string, string | undefined>): Prisma.CandidatoWhereInput {
  const e: Prisma.CandidatoWhereInput[] = [];
  if (sp.q) {
    e.push({
      OR: [
        { nome: { contains: sp.q, mode: "insensitive" } },
        { email: { contains: sp.q, mode: "insensitive" } },
        { cidade: { contains: sp.q, mode: "insensitive" } },
        { competencias: { has: sp.q } },
      ],
    });
  }
  // Parâmetros malformados na URL são ignorados (nunca chegam ao banco).
  const uuid = (v?: string) => (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : undefined);
  const tag = uuid(sp.tag);
  const vaga = uuid(sp.vaga);
  const status = sp.status && sp.status in STATUS_CANDIDATURA ? (sp.status as keyof typeof STATUS_CANDIDATURA) : undefined;
  if (sp.uf && /^[a-z]{2}$/i.test(sp.uf)) e.push({ uf: sp.uf.toUpperCase() });
  if (tag) e.push({ tags: { some: { tagId: tag } } });
  if (vaga || status) {
    e.push({ candidaturas: { some: { ...(vaga ? { vagaId: vaga } : {}), ...(status ? { status } : {}) } } });
  }
  return { AND: e };
}
