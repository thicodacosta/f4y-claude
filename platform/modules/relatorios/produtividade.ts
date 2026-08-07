import "server-only";

import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_GESTAO } from "@/lib/roles";

function inicioDoMes(ano: number, mes: number) {
  return new Date(ano, mes - 1, 1);
}
function fimDoMes(ano: number, mes: number) {
  return new Date(ano, mes, 1);
}

function periodoAtual(ano?: number, mes?: number) {
  const hoje = new Date();
  return { ano: ano ?? hoje.getFullYear(), mes: mes ?? hoje.getMonth() + 1 };
}

/** Painel de produtividade (Fase 10) — métricas do mês por pessoa,
 * complementando os rankings "Top consultores/recrutadores" do Dashboard
 * (que só olham valor/volume) com atividade registrada, um sinal de
 * esforço além do resultado fechado. */
export async function getProdutividadeConsultores(ano?: number, mes?: number) {
  await requirePapel(PAPEIS_GESTAO);
  const { ano: anoAlvo, mes: mesAlvo } = periodoAtual(ano, mes);
  const desde = inicioDoMes(anoAlvo, mesAlvo);
  const ate = fimDoMes(anoAlvo, mesAlvo);

  const consultores = await prisma.usuario.findMany({
    where: { papel: { in: ["consultor_comercial", "admin", "diretoria"] } },
    select: { id: true, nome: true },
  });

  return Promise.all(
    consultores.map(async (u) => {
      const [ganhas, atividades, emAberto] = await Promise.all([
        prisma.oportunidade.aggregate({
          where: { responsavelId: u.id, etapa: { isGanho: true }, fechadoEm: { gte: desde, lt: ate } },
          _count: true,
          _sum: { valorEstimado: true },
        }),
        prisma.atividade.count({ where: { autorId: u.id, criadoEm: { gte: desde, lt: ate } } }),
        prisma.oportunidade.count({ where: { responsavelId: u.id, etapa: { isGanho: false, isPerdido: false } } }),
      ]);

      return {
        usuarioId: u.id,
        usuarioNome: u.nome,
        oportunidadesGanhas: ganhas._count,
        valorGanho: Number(ganhas._sum.valorEstimado ?? 0),
        oportunidadesEmAberto: emAberto,
        atividadesRegistradas: atividades,
      };
    }),
  );
}

export async function getProdutividadeRecrutadores(ano?: number, mes?: number) {
  await requirePapel(PAPEIS_GESTAO);
  const { ano: anoAlvo, mes: mesAlvo } = periodoAtual(ano, mes);
  const desde = inicioDoMes(anoAlvo, mesAlvo);
  const ate = fimDoMes(anoAlvo, mesAlvo);

  const recrutadores = await prisma.usuario.findMany({
    where: { papel: { in: ["recrutador", "consultor_executive_search", "admin", "diretoria"] } },
    select: { id: true, nome: true },
  });

  return Promise.all(
    recrutadores.map(async (u) => {
      const [fechadas, atividades, vagasAbertas] = await Promise.all([
        prisma.vaga.count({ where: { recrutadorId: u.id, status: "fechada", fechadoEm: { gte: desde, lt: ate } } }),
        prisma.atividade.count({ where: { autorId: u.id, criadoEm: { gte: desde, lt: ate } } }),
        prisma.vaga.count({ where: { recrutadorId: u.id, status: "aberta" } }),
      ]);

      return {
        usuarioId: u.id,
        usuarioNome: u.nome,
        vagasFechadas: fechadas,
        vagasEmAberto: vagasAbertas,
        atividadesRegistradas: atividades,
      };
    }),
  );
}

/** Heatmap dia x pessoa — só atividades registradas manualmente (nota,
 * email, whatsapp, ligação, reunião) contam como "esforço"; mudança de
 * etapa e automação são efeitos colaterais de outras ações, não trabalho
 * em si, então ficam de fora pra não inflar o heatmap artificialmente. */
export async function getHeatmapAtividade(ano?: number, mes?: number) {
  await requirePapel(PAPEIS_GESTAO);
  const { ano: anoAlvo, mes: mesAlvo } = periodoAtual(ano, mes);
  const desde = inicioDoMes(anoAlvo, mesAlvo);
  const ate = fimDoMes(anoAlvo, mesAlvo);

  const atividades = await prisma.atividade.findMany({
    where: {
      criadoEm: { gte: desde, lt: ate },
      tipo: { in: ["nota", "email", "whatsapp", "ligacao", "reuniao"] },
      autorId: { not: null },
    },
    include: { autor: { select: { nome: true } } },
  });

  const porChave = new Map<string, { usuarioId: string; usuarioNome: string; dia: string; total: number }>();
  for (const a of atividades) {
    if (!a.autorId || !a.autor) continue;
    const dia = a.criadoEm.toISOString().slice(0, 10);
    const chave = `${a.autorId}:${dia}`;
    const atual = porChave.get(chave);
    if (atual) {
      atual.total += 1;
    } else {
      porChave.set(chave, { usuarioId: a.autorId, usuarioNome: a.autor.nome, dia, total: 1 });
    }
  }

  return Array.from(porChave.values());
}
