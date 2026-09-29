import "server-only";

import type { Contexto } from "@/lib/contexto";
import { ErroAcesso } from "@/lib/contexto";
import type { Tx } from "@/lib/db";
import { auditar } from "@/lib/auditoria";

const DIA = 86_400_000;

/**
 * Inicia o onboarding de um colaborador a partir de um modelo — usado pelo
 * módulo Onboarding e pela conversão de candidato no CRM (mesma regra).
 * Tarefas são copiadas do modelo (o modelo pode mudar depois sem afetar
 * onboardings em andamento). Responsáveis: gestor → gestor direto do
 * colaborador; colaborador → a própria pessoa; RH → qualquer pessoa com
 * permissão de concluir no módulo.
 */
export async function iniciarOnboardingPara(tx: Tx, ctx: Contexto, p: { colaboradorId: string; modeloId: string; inicio: Date }) {
  const colaborador = await tx.colaborador.findUnique({ where: { id: p.colaboradorId } });
  if (!colaborador) throw new ErroAcesso("Colaborador inválido.");
  if (colaborador.status === "desligado") throw new ErroAcesso("Não é possível iniciar onboarding de pessoa desligada.");
  const modelo = await tx.modeloOnboarding.findUnique({
    where: { id: p.modeloId },
    include: { etapas: { orderBy: { ordem: "asc" }, include: { tarefas: { orderBy: { ordem: "asc" } } } } },
  });
  if (!modelo || !modelo.ativo) throw new ErroAcesso("Modelo de onboarding inválido ou inativo.");
  if (await tx.onboarding.findFirst({ where: { colaboradorId: colaborador.id, status: "em_andamento" } })) {
    throw new ErroAcesso(`${colaborador.nome} já tem um onboarding em andamento.`);
  }

  const onboarding = await tx.onboarding.create({
    data: {
      tenantId: ctx.org.id,
      colaboradorId: colaborador.id,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      boasVindas: modelo.boasVindas,
      inicio: p.inicio,
      criadoPor: ctx.usuario.nome,
    },
  });
  let ordem = 0;
  const tarefas = modelo.etapas.flatMap((e) =>
    e.tarefas.map((t) => ({
      tenantId: ctx.org.id,
      onboardingId: onboarding.id,
      etapa: e.titulo,
      titulo: t.titulo,
      descricao: t.descricao,
      tipo: t.tipo,
      responsavelTipo: t.responsavel,
      responsavelId: t.responsavel === "gestor" ? colaborador.gestorId : t.responsavel === "colaborador" ? colaborador.id : null,
      prazo: new Date(p.inicio.getTime() + t.prazoDias * DIA),
      materialUrl: t.materialUrl,
      ordem: ordem++,
    })),
  );
  if (tarefas.length) await tx.tarefaOnboarding.createMany({ data: tarefas });
  await tx.eventoOnboarding.create({
    data: { tenantId: ctx.org.id, onboardingId: onboarding.id, texto: `Onboarding iniciado com o modelo “${modelo.nome}” (${tarefas.length} tarefas).`, autorNome: ctx.usuario.nome },
  });
  if (colaborador.status === "ativo" && colaborador.dataAdmissao && colaborador.dataAdmissao > new Date()) {
    await tx.colaborador.update({ where: { id: colaborador.id }, data: { status: "pre_admissao" } });
  }
  await auditar(tx, {
    tenantId: ctx.org.id,
    usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome },
    acao: "onboarding.iniciar",
    entidade: "onboarding",
    entidadeId: onboarding.id,
    detalhes: { colaboradorId: colaborador.id, modelo: modelo.nome },
  });
  return onboarding.id;
}
