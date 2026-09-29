import "server-only";

import { dbTenant } from "@/lib/db";
import type { Contexto } from "@/lib/contexto";
import type { Escopo } from "@/lib/permissoes";
import { hoje, somarDias } from "@/lib/datas";
import { PENDENTES, sinais, type Sinais } from "./calculo";
import { filtroOnboardings } from "./regras";

export type AlertaOnboarding = {
  tarefaId: string;
  titulo: string;
  responsavelTipo: "rh" | "gestor" | "colaborador";
  prazo: Date;
  onboardingId: string;
  colaborador: string;
  sinais: Sinais;
};

/**
 * Tarefas pendentes que pedem atenção nos onboardings visíveis ao papel:
 * atrasadas, vencendo hoje, vencendo em até 3 dias e bloqueadas. Só
 * onboardings já iniciados (não iniciados ainda não geram alerta).
 */
export async function buscarAlertas(ctx: Contexto, escopo: Escopo, limite = 200): Promise<AlertaOnboarding[]> {
  const h = hoje();
  const tarefas = await dbTenant(ctx.org.id, ctx.usuario.id).tarefaOnboarding.findMany({
    where: {
      status: { in: [...PENDENTES] },
      onboarding: { AND: [filtroOnboardings(ctx, escopo), { status: "em_andamento", inicio: { lte: h } }] },
      OR: [{ status: "bloqueada" }, { prazo: { lte: somarDias(h, 3) } }],
    },
    include: { onboarding: { select: { id: true, colaborador: { select: { nome: true } } } } },
    orderBy: { prazo: "asc" },
    take: limite,
  });
  return tarefas.map((t) => ({
    tarefaId: t.id,
    titulo: t.titulo,
    responsavelTipo: t.responsavelTipo,
    prazo: t.prazo,
    onboardingId: t.onboarding.id,
    colaborador: t.onboarding.colaborador.nome,
    sinais: sinais(t, h),
  }));
}

export function contarAlertas(alertas: AlertaOnboarding[]) {
  return {
    atrasadas: alertas.filter((a) => a.sinais.atrasada).length,
    hoje: alertas.filter((a) => a.sinais.venceHoje).length,
    proximas: alertas.filter((a) => a.sinais.proxima).length,
    bloqueadas: alertas.filter((a) => a.sinais.bloqueada).length,
  };
}
