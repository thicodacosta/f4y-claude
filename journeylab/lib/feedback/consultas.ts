import "server-only";

import { dbTenant } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import { hoje } from "@/lib/datas";
import { cadencia, type Cadencia, type PeriodicidadeFeedback, type SemaforoCor } from "./avaliacao";
import { filtroPessoasFeedback } from "./regras";

export type LinhaCadencia = {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  gestor: string | null;
  ultimo: { id: string; data: Date; semaforo: SemaforoCor; periodicidade: PeriodicidadeFeedback } | null;
  proximo1a1: { id: string; dataHora: Date } | null;
  cadencia: Cadencia;
};

/**
 * Cadência de feedback das pessoas que o usuário pode ver (RH: ativas da
 * empresa; gestor: subordinados diretos). Uma única fonte para a página do
 * módulo e para o painel — o mesmo alerta não é calculado de dois jeitos.
 */
export async function carregarCadencia(ctx: Contexto, escopo: Escopo): Promise<LinhaCadencia[]> {
  const h = hoje();
  const pessoas = await dbTenant(ctx.org.id, ctx.usuario.id).colaborador.findMany({
    where: filtroPessoasFeedback(ctx, escopo),
    select: {
      id: true,
      nome: true,
      cargo: true,
      dataAdmissao: true,
      equipe: { select: { area: { select: { nome: true } }, nome: true } },
      gestor: { select: { nome: true } },
      avaliacoesRecebidas: { orderBy: [{ data: "desc" }, { criadoEm: "desc" }], take: 1, select: { id: true, data: true, semaforo: true, periodicidade: true } },
      reunioesComoColaborador: { where: { status: "agendada", dataHora: { gte: new Date() } }, orderBy: { dataHora: "asc" }, take: 1, select: { id: true, dataHora: true } },
    },
    orderBy: { nome: "asc" },
  });
  return pessoas.map((p) => {
    const ultimo = p.avaliacoesRecebidas[0] ?? null;
    return {
      id: p.id,
      nome: p.nome,
      cargo: p.cargo,
      departamento: p.equipe?.area?.nome ?? p.equipe?.nome ?? null,
      gestor: p.gestor?.nome ?? null,
      ultimo,
      proximo1a1: p.reunioesComoColaborador[0] ?? null,
      cadencia: cadencia(ultimo, p.dataAdmissao, h),
    };
  });
}

const ORDEM = { atrasado: 0, proximo: 1, em_dia: 2, manual: 3, sem_referencia: 4 } as const;
export const ordenarPorCadencia = (a: LinhaCadencia, b: LinhaCadencia) =>
  ORDEM[a.cadencia.estado] - ORDEM[b.cadencia.estado] || (a.cadencia.dias ?? 999) - (b.cadencia.dias ?? 999);
