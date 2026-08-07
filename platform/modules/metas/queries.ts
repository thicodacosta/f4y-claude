import "server-only";

import { prisma } from "@/lib/prisma";
import { requireUsuario, requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";

function inicioDoMes(ano: number, mes: number) {
  return new Date(ano, mes - 1, 1);
}

function fimDoMes(ano: number, mes: number) {
  return new Date(ano, mes, 1);
}

async function valorAtualComercial(usuarioId: string, ano: number, mes: number) {
  const agg = await prisma.oportunidade.aggregate({
    where: {
      responsavelId: usuarioId,
      etapa: { isGanho: true },
      fechadoEm: { gte: inicioDoMes(ano, mes), lt: fimDoMes(ano, mes) },
    },
    _sum: { valorEstimado: true },
  });
  return Number(agg._sum.valorEstimado ?? 0);
}

async function valorAtualRecrutamento(usuarioId: string, ano: number, mes: number) {
  return prisma.vaga.count({
    where: {
      recrutadorId: usuarioId,
      status: "fechada",
      fechadoEm: { gte: inicioDoMes(ano, mes), lt: fimDoMes(ano, mes) },
    },
  });
}

async function valorAtual(tipo: string, usuarioId: string, ano: number, mes: number) {
  return tipo === "comercial"
    ? valorAtualComercial(usuarioId, ano, mes)
    : valorAtualRecrutamento(usuarioId, ano, mes);
}

/** Progresso é sempre calculado on-the-fly contra o desempenho real do mês
 * (nunca armazenado) — ver comentário no schema, mesmo princípio de
 * "nunca guardar um derivado que pode ficar desatualizado" já usado em
 * ContratoAlocacao.renovacaoLembreteEm. */
export async function getMinhasMetas(ano?: number, mes?: number) {
  const usuario = await requireUsuario();
  const hoje = new Date();
  const anoAlvo = ano ?? hoje.getFullYear();
  const mesAlvo = mes ?? hoje.getMonth() + 1;

  const metas = await prisma.meta.findMany({
    where: { usuarioId: usuario.id, ano: anoAlvo, mes: mesAlvo },
  });

  return Promise.all(
    metas.map(async (m) => {
      const atual = await valorAtual(m.tipo, usuario.id, anoAlvo, mesAlvo);
      const alvo = Number(m.valorAlvo);
      return {
        id: m.id,
        tipo: m.tipo,
        ano: m.ano,
        mes: m.mes,
        valorAlvo: alvo,
        valorAtual: atual,
        percentual: alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0,
      };
    }),
  );
}

/** Leaderboard — só admin/diretoria vê o progresso de todo mundo (RLS só
 * deixa cada usuário ler a própria meta direto; esta agregação roda via
 * Prisma, que ignora RLS, então a barreira de "só admin/diretoria" é
 * inteiramente desta função — ver lib/roles.ts). */
export async function getMetasEquipe(ano?: number, mes?: number) {
  await requirePapel(PAPEIS_GESTAO);
  const hoje = new Date();
  const anoAlvo = ano ?? hoje.getFullYear();
  const mesAlvo = mes ?? hoje.getMonth() + 1;

  const metas = await prisma.meta.findMany({
    where: { ano: anoAlvo, mes: mesAlvo },
    include: { usuario: { select: { nome: true } } },
  });

  const linhas = await Promise.all(
    metas.map(async (m) => {
      const atual = await valorAtual(m.tipo, m.usuarioId, anoAlvo, mesAlvo);
      const alvo = Number(m.valorAlvo);
      return {
        id: m.id,
        usuarioId: m.usuarioId,
        usuarioNome: m.usuario.nome,
        tipo: m.tipo,
        valorAlvo: alvo,
        valorAtual: atual,
        percentual: alvo > 0 ? Math.round((atual / alvo) * 100) : 0,
      };
    }),
  );

  return linhas.sort((a, b) => b.percentual - a.percentual);
}

export async function getUsuariosParaMetas() {
  await requirePapel(PAPEIS_GESTAO);

  return prisma.usuario.findMany({
    where: { papel: { in: ["consultor_comercial", "recrutador", "consultor_executive_search", "admin", "diretoria"] } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, papel: true },
  });
}
