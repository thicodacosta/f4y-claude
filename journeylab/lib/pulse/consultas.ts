import "server-only";

import { dbTenant, transacao } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import { calcularEnps, type LinhaDistribuicao, type PerguntaDef } from "./perguntas";

export type Resumo = { respondentes: number; minimo: number; liberado: boolean; motivo: "aberta" | "minimo" | "complemento" | null };
export type Comentario = { pergunta_id: string; linha: number | null; texto: string };

const escopo = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });

/**
 * Resultados SEMPRE pelas funções agregadas do banco (rls.sql): a aplicação
 * não lê a tabela de respostas. SQL bruto roda dentro de `transacao()` para o
 * contexto da organização ser aplicado. `areaId` = recorte por departamento.
 */
export async function resultadoPulse(ctx: Contexto, pesquisaId: string, areaId: string | null) {
  return transacao(escopo(ctx), async (tx) => {
    const [resumo] = await tx.$queryRaw<Resumo[]>`select * from public.jl_resumo_pulse(${pesquisaId}::uuid, ${areaId}::uuid)`;
    if (!resumo?.liberado) return { resumo: resumo ?? null, linhas: [] as LinhaDistribuicao[], comentarios: [] as Comentario[] };
    const linhas = await tx.$queryRaw<LinhaDistribuicao[]>`select * from public.jl_distribuicao_pulse(${pesquisaId}::uuid, ${areaId}::uuid)`;
    const comentarios = await tx.$queryRaw<Comentario[]>`select * from public.jl_comentarios_pulse(${pesquisaId}::uuid, ${areaId}::uuid)`;
    return { resumo, linhas, comentarios };
  });
}

export async function adesaoPulse(ctx: Contexto, pesquisaId: string) {
  const [a] = await transacao(escopo(ctx), (tx) => tx.$queryRaw<{ publico: number; respondentes: number }[]>`select * from public.jl_adesao_pulse(${pesquisaId}::uuid)`);
  return a ?? { publico: 0, respondentes: 0 };
}

export async function adesaoDiaria(ctx: Contexto, pesquisaId: string) {
  return transacao(escopo(ctx), (tx) => tx.$queryRaw<{ dia: Date; n: number }[]>`select * from public.jl_adesao_diaria_pulse(${pesquisaId}::uuid)`);
}

/** Só em pesquisa identificada (a função devolve vazio nas anônimas). */
export async function participantes(ctx: Contexto, pesquisaId: string) {
  return transacao(escopo(ctx), (tx) => tx.$queryRaw<{ colaborador_id: string; respondido_em: Date }[]>`select * from public.jl_participantes_pulse(${pesquisaId}::uuid)`);
}

/** Dados do assistente: templates (globais + da empresa), departamentos, equipes e pessoas ativas. */
export async function dadosAssistente(ctx: Contexto) {
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const [modelos, departamentos, equipes, pessoas] = await Promise.all([
    db.modeloPulse.findMany({ where: { ativo: true }, orderBy: [{ tenantId: { sort: "asc", nulls: "first" } }, { criadoEm: "asc" }] }),
    db.area.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true, cargo: true }, orderBy: { nome: "asc" } }),
  ]);
  return {
    modelos: modelos.map((m) => ({ id: m.id, nome: m.nome, slug: m.slug, descricao: m.descricao, icone: m.icone, cor: m.cor, perguntas: m.perguntas as PerguntaDef[], daEmpresa: !!m.tenantId })),
    departamentos,
    equipes,
    pessoas,
  };
}

/** eNPS (organização inteira) de uma pesquisa com pergunta NPS, se os resultados estiverem liberados. */
export async function enpsDaPesquisa(ctx: Contexto, pesquisaId: string, perguntaIds: string[]) {
  if (!perguntaIds.length) return null;
  const r = await resultadoPulse(ctx, pesquisaId, null);
  if (!r.resumo?.liberado) return null;
  const contagens = new Map<number, number>();
  for (const l of r.linhas) if (perguntaIds.includes(l.pergunta_id) && l.valor !== null) contagens.set(Number(l.valor), (contagens.get(Number(l.valor)) ?? 0) + Number(l.n));
  return calcularEnps(contagens);
}
