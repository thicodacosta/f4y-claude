"use server";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import { PAPEIS_ATS, PAPEIS_CRM } from "@/lib/roles";
import { podeVerConfidencial } from "@/modules/ats/queries";

export type BuscaGlobalResultado = {
  candidatos: { id: string; nome: string; cargoAtual: string | null }[];
  vagas: { id: string; cargo: string; empresaNome: string; confidencial: boolean }[];
  empresas: { id: string; nome: string }[];
  oportunidades: { id: string; empresaNome: string; vertical: string }[];
};

const VAZIO: BuscaGlobalResultado = { candidatos: [], vagas: [], empresas: [], oportunidades: [] };

/** Busca global do Command Palette — cada grupo é omitido (não lança erro)
 * se o papel do usuário não tiver acesso àquele domínio, já que perfis como
 * financeiro não têm PAPEIS_ATS/PAPEIS_CRM mas ainda usam a paleta pra
 * navegação estática. Vagas confidenciais seguem o mesmo corte de
 * getVagas() — excluídas da busca, não só do detalhe. */
export async function buscaGlobal(termo: string): Promise<BuscaGlobalResultado> {
  const usuario = await requireUsuario();
  const termoLimpo = termo.trim();
  if (termoLimpo.length < 2) return VAZIO;

  const podeAts = !!usuario.papel && (PAPEIS_ATS as string[]).includes(usuario.papel);
  const podeCrm = !!usuario.papel && (PAPEIS_CRM as string[]).includes(usuario.papel);

  const [candidatos, vagas, empresas, oportunidades] = await Promise.all([
    podeAts
      ? prisma.candidato.findMany({
          where: { nome: { contains: termoLimpo, mode: "insensitive" } },
          select: { id: true, nome: true, cargoAtual: true },
          take: 6,
          orderBy: { nome: "asc" },
        })
      : Promise.resolve([]),
    podeAts
      ? prisma.vaga.findMany({
          where: {
            cargo: { contains: termoLimpo, mode: "insensitive" },
            ...(podeVerConfidencial(usuario.papel) ? {} : { confidencial: false }),
          },
          select: { id: true, cargo: true, confidencial: true, empresa: { select: { nome: true } } },
          take: 6,
          orderBy: { cargo: "asc" },
        })
      : Promise.resolve([]),
    podeCrm
      ? prisma.empresa.findMany({
          where: { nome: { contains: termoLimpo, mode: "insensitive" } },
          select: { id: true, nome: true },
          take: 6,
          orderBy: { nome: "asc" },
        })
      : Promise.resolve([]),
    podeCrm
      ? prisma.oportunidade.findMany({
          where: {
            OR: [
              { empresa: { nome: { contains: termoLimpo, mode: "insensitive" } } },
              { contato: { nome: { contains: termoLimpo, mode: "insensitive" } } },
            ],
          },
          select: { id: true, vertical: true, empresa: { select: { nome: true } } },
          take: 6,
          orderBy: { criadoEm: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    candidatos,
    vagas: vagas.map((v) => ({ id: v.id, cargo: v.cargo, confidencial: v.confidencial, empresaNome: v.empresa.nome })),
    empresas,
    oportunidades: oportunidades.map((o) => ({ id: o.id, empresaNome: o.empresa.nome, vertical: o.vertical })),
  };
}
