import "server-only";

import type { Contexto } from "@/lib/contexto";
import { dbTenant } from "@/lib/db";
import { pode } from "@/lib/contexto";
import { areasLideradas, resultadoNr1, type ResumoNr1 } from "./consultas";
import { filtroCiclos } from "./regras";

export type FatorRel = { id: string; nome: string; severidade: number; score: number | null; respondentes: number };
export type Recorte = { id: string | null; nome: string; resumo: ResumoNr1 | null; geral: number | null; fatores: FatorRel[] };

/**
 * Dados de resultados de um diagnóstico — FONTE ÚNICA para tela, relatório (PDF),
 * CSV e IA. Os valores vêm das funções do banco, que aplicam permissão por área,
 * encerramento, mínimo, complemento e público pequeno; recortes ocultos chegam
 * sem números.
 */
export async function carregarRelatorioNr1(ctx: Contexto, cicloId: string) {
  const escopo = pode(ctx, "nr1", "visualizar");
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const c = await db.cicloNr1.findFirst({
    where: { AND: [{ id: cicloId }, filtroCiclos(escopo)] },
    include: {
      dimensoes: { orderBy: { ordem: "asc" }, include: { perguntas: { orderBy: { ordem: "asc" }, select: { id: true, texto: true, reversa: true, chave: true } } } },
      riscos: { orderBy: { criadoEm: "asc" }, include: { dimensao: { select: { nome: true } }, acoes: { orderBy: { criadoEm: "asc" } } } },
    },
  });
  if (!c) return null;

  const montar = (id: string | null, nome: string, r: Awaited<ReturnType<typeof resultadoNr1>>): Recorte => ({
    id,
    nome,
    resumo: r.resumo,
    geral: r.geral,
    fatores: c.dimensoes.map((d) => {
      const f = r.fatores.find((x) => x.dimensao_id === d.id);
      return { id: d.id, nome: d.nome, severidade: d.severidade, score: f?.score ?? null, respondentes: f?.respondentes ?? 0 };
    }),
  });

  const organizacao = escopo === "todos" ? montar(null, "Toda a organização", await resultadoNr1(ctx, c.id, null)) : null;
  // Recortes por departamento: RH vê os departamentos da audiência; gestor, só as áreas que lidera.
  const lideradas = escopo === "equipe" ? await areasLideradas(ctx) : [];
  const areas = c.coletarDepartamento
    ? await db.area.findMany({
        where: escopo === "todos" ? (c.audienciaTipo === "departamentos" ? { id: { in: c.areaIds } } : {}) : { id: { in: lideradas } },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      })
    : [];
  const departamentos = c.status === "encerrado" ? await Promise.all(areas.map(async (a) => montar(a.id, a.nome, await resultadoNr1(ctx, c.id, a.id)))) : [];

  // Evolução: diagnósticos encerrados com a mesma metodologia (só organização, só quem vê o todo).
  const comparaveis =
    escopo === "todos" && c.metodologiaVersao !== "legado"
      ? await db.cicloNr1.findMany({ where: { status: "encerrado", metodologiaVersao: c.metodologiaVersao }, select: { id: true, titulo: true, encerradoEm: true, faixas: true }, orderBy: { encerradoEm: "asc" }, take: 12 })
      : [];
  const evolucao = (await Promise.all(comparaveis.map(async (x) => ({ ...x, geral: (await resultadoNr1(ctx, x.id, null)).geral })))).filter((x): x is typeof x & { geral: number } => x.geral !== null);

  return { ciclo: c, escopo, organizacao, departamentos, evolucao };
}
