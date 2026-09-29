import "server-only";

import { dbTenant } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import type { Prisma } from "@/lib/generated/prisma/client";
import { hoje as hojeCivil } from "@/lib/datas";

/**
 * Pesquisas visíveis na gestão do Pulse:
 *  todos  → todas (inclusive rascunhos)
 *  equipe → abertas/encerradas cujo público inclui uma equipe que eu lidero
 *  próprio→ nenhuma (quem só responde usa "Para responder")
 */
export function filtroPesquisas(escopo: Escopo, minhasEquipes: string[]): Prisma.PesquisaPulseWhereInput {
  if (escopo === "todos") return {};
  if (escopo === "equipe" && minhasEquipes.length) {
    return { status: { not: "rascunho" }, OR: [{ publicoTodos: true }, { equipeIds: { hasSome: minhasEquipes } }] };
  }
  return { id: "00000000-0000-0000-0000-000000000000" };
}

/** Equipes lideradas diretamente pelo usuário (recortes que um gestor pode ver). */
export async function equipesLideradas(ctx: Contexto) {
  if (!ctx.colaboradorId) return [];
  return dbTenant(ctx.org.id, ctx.usuario.id).equipe.findMany({ where: { gestorId: ctx.colaboradorId }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
}

/** Pesquisas abertas que a pessoa pode responder e ainda não respondeu. */
export function filtroParaResponder(colaboradorId: string, equipeId: string | null): Prisma.PesquisaPulseWhereInput {
  const hoje = hojeCivil();
  return {
    status: "aberta",
    OR: [{ encerraEm: null }, { encerraEm: { gte: hoje } }],
    AND: [{ OR: [{ publicoTodos: true }, ...(equipeId ? [{ equipeIds: { has: equipeId } }] : [])] }],
    participacoes: { none: { colaboradorId } },
  };
}

export const STATUS_PESQUISA = {
  rascunho: { nome: "Rascunho", tom: "neutro" },
  aberta: { nome: "Aberta", tom: "info" },
  encerrada: { nome: "Encerrada", tom: "sucesso" },
} as const;

export const TIPO_PERGUNTA = {
  escala: "Escala de 1 a 5",
  enps: "eNPS (0 a 10)",
  sim_nao: "Sim ou não",
  texto: "Comentário livre",
} as const;

export type TipoPergunta = keyof typeof TIPO_PERGUNTA;

/** Modelos iniciais — perguntas editáveis enquanto a pesquisa é rascunho. */
export const MODELOS_PULSE: Record<string, { nome: string; perguntas: { texto: string; tipo: TipoPergunta; obrigatoria: boolean }[] }> = {
  clima: {
    nome: "Clima rápido",
    perguntas: [
      { texto: "Tenho clareza sobre o que se espera do meu trabalho.", tipo: "escala", obrigatoria: true },
      { texto: "Recebo reconhecimento pelo trabalho bem feito.", tipo: "escala", obrigatoria: true },
      { texto: "Minha carga de trabalho é sustentável.", tipo: "escala", obrigatoria: true },
      { texto: "Confio nas decisões da minha liderança.", tipo: "escala", obrigatoria: true },
      { texto: "Qual a probabilidade de você recomendar a empresa como lugar para trabalhar?", tipo: "enps", obrigatoria: true },
      { texto: "Quer comentar algo? (opcional — evite dados que identifiquem você)", tipo: "texto", obrigatoria: false },
    ],
  },
  enps: {
    nome: "eNPS",
    perguntas: [
      { texto: "Qual a probabilidade de você recomendar a empresa como lugar para trabalhar?", tipo: "enps", obrigatoria: true },
      { texto: "O que mais influenciou sua nota? (opcional)", tipo: "texto", obrigatoria: false },
    ],
  },
};

/** eNPS = % promotores (9–10) − % detratores (0–6). */
export function calcularEnps(dist: Record<string, number>) {
  let total = 0,
    prom = 0,
    detr = 0;
  for (const [k, n] of Object.entries(dist)) {
    const v = Number(k);
    total += n;
    if (v >= 9) prom += n;
    else if (v <= 6) detr += n;
  }
  if (!total) return null;
  return { enps: Math.round(((prom - detr) / total) * 100), promotores: prom, neutros: total - prom - detr, detratores: detr, total };
}
