import "server-only";

import { transacao } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";

type Resumo = { respondentes: number; minimo: number; liberado: boolean; motivo: "aberta" | "minimo" | "complemento" | null };
export type LinhaNr1 = { dimensao_id: string; pergunta_id: string; indice: string; media: string; respostas: number };

const escopo = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });

/** Resultados só pelas funções agregadas do banco (a aplicação não lê respostas). */
export async function resultadoNr1(ctx: Contexto, cicloId: string, equipeId: string | null) {
  return transacao(escopo(ctx), async (tx) => {
    const [resumo] = await tx.$queryRaw<Resumo[]>`select * from public.jl_resumo_nr1(${cicloId}::uuid, ${equipeId}::uuid)`;
    if (!resumo?.liberado) return { resumo: resumo ?? null, linhas: [] as LinhaNr1[] };
    const linhas = await tx.$queryRaw<LinhaNr1[]>`select * from public.jl_resultado_nr1(${cicloId}::uuid, ${equipeId}::uuid)`;
    return { resumo, linhas };
  });
}

export async function adesaoNr1(ctx: Contexto, cicloId: string) {
  const [a] = await transacao(escopo(ctx), (tx) => tx.$queryRaw<{ publico: number; respondentes: number }[]>`select * from public.jl_adesao_nr1(${cicloId}::uuid)`);
  return a ?? { publico: 0, respondentes: 0 };
}

/** Índice por dimensão = média dos índices das perguntas (todas obrigatórias, mesmo nº de respostas). */
export function indicesPorDimensao(linhas: LinhaNr1[]) {
  const mapa = new Map<string, number[]>();
  for (const l of linhas) mapa.set(l.dimensao_id, [...(mapa.get(l.dimensao_id) ?? []), Number(l.indice)]);
  return new Map([...mapa].map(([d, v]) => [d, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10]));
}
