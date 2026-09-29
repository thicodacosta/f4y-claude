import "server-only";

import { transacao } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";

type Resumo = { respondentes: number; minimo: number; liberado: boolean; motivo: "aberta" | "minimo" | "complemento" | null };
type Linha = { pergunta_id: string; respostas: number; media: string | null; distribuicao: Record<string, number> };

const escopo = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });

/**
 * Resultados SEMPRE pelas funções agregadas do banco (rls.sql): a aplicação
 * não tem acesso de leitura às respostas. SQL bruto roda dentro de
 * `transacao()` para que o contexto de organização seja aplicado.
 */
export async function resultadoPulse(ctx: Contexto, pesquisaId: string, equipeId: string | null) {
  return transacao(escopo(ctx), async (tx) => {
    const [resumo] = await tx.$queryRaw<Resumo[]>`select * from public.jl_resumo_pulse(${pesquisaId}::uuid, ${equipeId}::uuid)`;
    if (!resumo?.liberado) return { resumo: resumo ?? null, linhas: [] as Linha[], comentarios: [] as { pergunta_id: string; texto: string }[] };
    const linhas = await tx.$queryRaw<Linha[]>`select * from public.jl_resultado_pulse(${pesquisaId}::uuid, ${equipeId}::uuid)`;
    const comentarios = await tx.$queryRaw<{ pergunta_id: string; texto: string }[]>`select * from public.jl_comentarios_pulse(${pesquisaId}::uuid, ${equipeId}::uuid)`;
    return { resumo, linhas, comentarios };
  });
}

export async function adesaoPulse(ctx: Contexto, pesquisaId: string) {
  const [a] = await transacao(escopo(ctx), (tx) => tx.$queryRaw<{ publico: number; respondentes: number }[]>`select * from public.jl_adesao_pulse(${pesquisaId}::uuid)`);
  return a ?? { publico: 0, respondentes: 0 };
}
