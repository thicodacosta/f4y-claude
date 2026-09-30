import "server-only";

import { transacao } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import { scoreGeral } from "./calculo";

export type ResumoNr1 = { respondentes: number | null; minimo: number; liberado: boolean; motivo: string | null };
export type FatorLinha = { dimensao_id: string; respondentes: number; score: number | null; media: string | null };

const escopo = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });

/**
 * Resultado agregado de um recorte (organização = areaId null). Tudo passa pelas
 * funções do banco, que conferem permissão, encerramento, mínimo e complemento —
 * a mesma regra vale para tela, relatório, CSV e IA.
 */
export async function resultadoNr1(ctx: Contexto, cicloId: string, areaId: string | null) {
  return transacao(escopo(ctx), async (tx) => {
    const [resumo] = await tx.$queryRaw<ResumoNr1[]>`select * from public.jl_resumo_nr1(${cicloId}::uuid, ${areaId}::uuid)`;
    if (!resumo?.liberado) return { resumo: resumo ?? null, fatores: [] as FatorLinha[], geral: null as number | null };
    const fatores = await tx.$queryRaw<FatorLinha[]>`select * from public.jl_fatores_nr1(${cicloId}::uuid, ${areaId}::uuid)`;
    return { resumo, fatores, geral: scoreGeral(fatores.map((f) => f.score)) };
  });
}

export async function adesaoNr1(ctx: Contexto, cicloId: string) {
  const [a] = await transacao(escopo(ctx), (tx) =>
    tx.$queryRaw<{ elegiveis: number; convites: number; enviados: number; falhas: number; respostas: number }[]>`select * from public.jl_adesao_nr1(${cicloId}::uuid)`,
  );
  return a ?? null;
}

/** Áreas lideradas pelo usuário (recortes permitidos a gestores). */
export async function areasLideradas(ctx: Contexto) {
  const [r] = await transacao(escopo(ctx), (tx) => tx.$queryRaw<{ areas: string[] }[]>`select public.jl_areas_lideradas() as areas`);
  return r?.areas ?? [];
}
