import "server-only";

import { ErroAcesso } from "@/lib/contexto";
import { transacao, type Tx } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { hoje } from "@/lib/datas";
import type { Escopo } from "@/lib/permissoes";
import { calcularProgresso, ehPendente, obrigatoriasConcluidas, prazoCalculado, STATUS_TAREFA, type StatusTarefa } from "./calculo";
import { podeAtualizarTarefa } from "./regras";
import { MODELO_PADRAO } from "./modelo-padrao";

export { MODELO_PADRAO };

/** Quem executa (usuário ou sistema) dentro de uma organização. */
export type Ator = { tenantId: string; usuario: { id: string; nome: string } };

/** Cria o template 30/60/90 como padrão da organização, se ainda não houver padrão. Idempotente. */
export async function garantirModeloPadrao(tx: Tx, ator: Ator) {
  const padrao = await tx.modeloOnboarding.findFirst({ where: { tenantId: ator.tenantId, padrao: true } });
  if (padrao) return padrao;
  const existente = await tx.modeloOnboarding.findUnique({ where: { tenantId_nome: { tenantId: ator.tenantId, nome: MODELO_PADRAO.nome } } });
  if (existente) return tx.modeloOnboarding.update({ where: { id: existente.id }, data: { padrao: true, ativo: true } });
  const m = await tx.modeloOnboarding.create({
    data: { tenantId: ator.tenantId, nome: MODELO_PADRAO.nome, descricao: MODELO_PADRAO.descricao, padrao: true, criadoPor: ator.usuario.nome },
  });
  for (const [ordem, f] of MODELO_PADRAO.fases.entries()) {
    const etapa = await tx.etapaModelo.create({ data: { tenantId: ator.tenantId, modeloId: m.id, titulo: f.titulo, descricao: f.descricao, marcoDias: f.marcoDias, ordem } });
    await tx.tarefaModelo.createMany({
      data: f.tarefas.map((t, i) => ({ tenantId: ator.tenantId, etapaId: etapa.id, titulo: t.titulo, responsavel: t.responsavel, tipo: t.tipo ?? "tarefa", prazoDias: null, ordem: i })),
    });
  }
  return m;
}

/** Template aplicável: o ativo da área (departamento) da pessoa; senão o padrão da organização. */
export async function modeloAplicavel(tx: Tx, ator: Ator, colaboradorId: string) {
  const c = await tx.colaborador.findUnique({ where: { id: colaboradorId }, select: { equipe: { select: { areaId: true } } } });
  const areaId = c?.equipe?.areaId;
  if (areaId) {
    const daArea = await tx.modeloOnboarding.findFirst({ where: { tenantId: ator.tenantId, areaId, ativo: true } });
    if (daArea) return daArea;
  }
  const padrao = await tx.modeloOnboarding.findFirst({ where: { tenantId: ator.tenantId, padrao: true, ativo: true } });
  return padrao ?? garantirModeloPadrao(tx, ator);
}

/**
 * Cria o onboarding de uma pessoa a partir de um template (informado ou o
 * aplicável). Fases e tarefas são copiadas — o template pode mudar depois.
 * Duplicidade: um único onboarding em andamento por pessoa (verificação aqui +
 * índice único parcial no banco, que protege contra envios simultâneos).
 */
export async function iniciarOnboardingPara(
  tx: Tx,
  ator: Ator,
  p: { colaboradorId: string; modeloId?: string | null; inicio: Date; origem: "manual" | "cadastro" | "crm" },
) {
  const colaborador = await tx.colaborador.findUnique({ where: { id: p.colaboradorId } });
  if (!colaborador) throw new ErroAcesso("Colaborador inválido.");
  if (colaborador.status === "desligado") throw new ErroAcesso("Não é possível iniciar onboarding de pessoa desligada.");
  if (await tx.onboarding.findFirst({ where: { colaboradorId: colaborador.id, status: "em_andamento" } })) {
    throw new ErroAcesso(`${colaborador.nome} já tem um onboarding ativo.`);
  }
  const base = p.modeloId ? await tx.modeloOnboarding.findUnique({ where: { id: p.modeloId } }) : await modeloAplicavel(tx, ator, colaborador.id);
  if (!base || !base.ativo) throw new ErroAcesso("Template de onboarding inválido ou inativo.");
  const modelo = await tx.modeloOnboarding.findUniqueOrThrow({
    where: { id: base.id },
    include: { etapas: { orderBy: { ordem: "asc" }, include: { tarefas: { orderBy: { ordem: "asc" } } } } },
  });

  const onboarding = await tx.onboarding.create({
    data: {
      tenantId: ator.tenantId,
      colaboradorId: colaborador.id,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      boasVindas: modelo.boasVindas,
      inicio: p.inicio,
      origem: p.origem,
      criadoPor: ator.usuario.nome,
    },
  });
  let ordem = 0;
  let total = 0;
  for (const e of modelo.etapas) {
    const fase = await tx.faseOnboarding.create({
      data: { tenantId: ator.tenantId, onboardingId: onboarding.id, nome: e.titulo, descricao: e.descricao, marcoDias: e.marcoDias, ordem: e.ordem },
    });
    const tarefas = e.tarefas.map((t) => ({
      tenantId: ator.tenantId,
      onboardingId: onboarding.id,
      faseId: fase.id,
      titulo: t.titulo,
      descricao: t.descricao,
      tipo: t.tipo,
      responsavelTipo: t.responsavel,
      responsavelId: t.responsavel === "gestor" ? colaborador.gestorId : t.responsavel === "colaborador" ? colaborador.id : null,
      obrigatoria: t.obrigatoria,
      prazoDias: t.prazoDias,
      prazo: prazoCalculado(p.inicio, t.prazoDias, e.marcoDias),
      materialUrl: t.materialUrl,
      ordem: ordem++,
    }));
    total += tarefas.length;
    if (tarefas.length) await tx.tarefaOnboarding.createMany({ data: tarefas });
  }
  await tx.eventoOnboarding.create({
    data: {
      tenantId: ator.tenantId,
      onboardingId: onboarding.id,
      texto: `Onboarding criado (${p.origem === "cadastro" ? "automaticamente no cadastro" : p.origem === "crm" ? "na conversão do CRM" : "manualmente"}) com o template “${modelo.nome}” — ${modelo.etapas.length} fases, ${total} tarefas.`,
      autorNome: ator.usuario.nome,
    },
  });
  if (colaborador.status === "ativo" && colaborador.dataAdmissao && colaborador.dataAdmissao > hoje()) {
    await tx.colaborador.update({ where: { id: colaborador.id }, data: { status: "pre_admissao" } });
  }
  await auditar(tx, { tenantId: ator.tenantId, usuario: ator.usuario, acao: "onboarding.iniciar", entidade: "onboarding", entidadeId: onboarding.id, detalhes: { colaboradorId: colaborador.id, modelo: modelo.nome, origem: p.origem } });
  return onboarding.id;
}

/**
 * ÚNICA fonte de verdade de progresso e status. Roda na mesma transação de
 * qualquer mudança de tarefa: recalcula o progresso, conclui automaticamente
 * quando todas as obrigatórias estão concluídas e reabre se uma obrigatória
 * voltar a ficar pendente.
 */
export async function recalcularOnboarding(tx: Tx, onboardingId: string, ator: Ator) {
  const o = await tx.onboarding.findUniqueOrThrow({ where: { id: onboardingId }, include: { tarefas: { select: { status: true, obrigatoria: true } }, colaborador: true } });
  const progresso = calcularProgresso(o.tarefas);
  const pronto = obrigatoriasConcluidas(o.tarefas);
  const obrigatoriaPendente = o.tarefas.some((t) => t.obrigatoria && ehPendente(t.status));
  let status = o.status;
  if (o.status === "em_andamento" && pronto) {
    status = "concluido";
    await tx.onboarding.update({ where: { id: o.id }, data: { progresso, status, concluidoEm: new Date(), concluidoPor: "Automático — tarefas obrigatórias concluídas" } });
    if (o.colaborador.status === "pre_admissao") await tx.colaborador.update({ where: { id: o.colaboradorId }, data: { status: "ativo" } });
    await tx.eventoOnboarding.create({ data: { tenantId: o.tenantId, onboardingId: o.id, texto: "Onboarding concluído: todas as tarefas obrigatórias foram concluídas.", autorNome: ator.usuario.nome } });
  } else if (o.status === "concluido" && obrigatoriaPendente) {
    status = "em_andamento";
    await tx.onboarding.update({ where: { id: o.id }, data: { progresso, status, concluidoEm: null, concluidoPor: null } });
    await tx.eventoOnboarding.create({ data: { tenantId: o.tenantId, onboardingId: o.id, texto: "Onboarding reaberto: uma tarefa obrigatória voltou a ficar pendente.", autorNome: ator.usuario.nome } });
  } else if (progresso !== o.progresso) {
    await tx.onboarding.update({ where: { id: o.id }, data: { progresso } });
  }
  return { progresso, status };
}

/**
 * Mudança de status de tarefa — o mesmo caminho para botão, checkbox e
 * arrastar no Kanban. Valida permissão, exige motivo para bloquear, registra
 * histórico e recalcula o onboarding na mesma transação.
 */
export async function mudarStatusTarefa(
  tx: Tx,
  ator: Ator,
  escopoConcluir: Escopo | null,
  tarefa: { id: string; titulo: string; status: StatusTarefa; responsavelTipo: string; onboardingId: string; iniciadaEm: Date | null; onboarding: { status: string } },
  novo: StatusTarefa,
  motivo: string | null,
) {
  if (tarefa.onboarding.status === "cancelado") throw new ErroAcesso("Onboarding cancelado não aceita alterações.");
  if (!podeAtualizarTarefa(escopoConcluir, tarefa)) throw new ErroAcesso(tarefa.responsavelTipo === "rh" ? "Tarefas de RH são atualizadas pelo RH." : "Você não pode atualizar esta tarefa.");
  if (novo === "dispensada" || tarefa.status === "dispensada") {
    if (escopoConcluir !== "todos") throw new ErroAcesso("Somente o RH dispensa ou restaura tarefas.");
    if (novo === "dispensada" && !motivo) throw new ErroAcesso("Informe o motivo para dispensar a tarefa.");
  }
  if (novo === "bloqueada" && !motivo) throw new ErroAcesso("Informe o motivo do bloqueio.");
  if (novo === tarefa.status) return recalcularOnboarding(tx, tarefa.onboardingId, ator);

  const agora = new Date();
  await tx.tarefaOnboarding.update({
    where: { id: tarefa.id },
    data: {
      status: novo,
      bloqueioMotivo: novo === "bloqueada" ? motivo : null,
      iniciadaEm: novo === "nao_iniciada" ? null : (tarefa.iniciadaEm ?? (novo === "em_andamento" || novo === "bloqueada" ? agora : null)),
      concluidaEm: novo === "concluida" || novo === "dispensada" ? agora : null,
      concluidaPor: novo === "concluida" || novo === "dispensada" ? ator.usuario.nome : null,
      ...(novo === "dispensada" ? { observacao: motivo } : {}),
    },
  });
  await tx.eventoOnboarding.create({
    data: {
      tenantId: ator.tenantId,
      onboardingId: tarefa.onboardingId,
      texto: `Tarefa “${tarefa.titulo}”: ${STATUS_TAREFA[tarefa.status].nome.toLowerCase()} → ${STATUS_TAREFA[novo].nome.toLowerCase()}${motivo ? ` (${motivo})` : ""}.`,
      autorNome: ator.usuario.nome,
    },
  });
  return recalcularOnboarding(tx, tarefa.onboardingId, ator);
}

/** Nova data de início: recalcula os prazos das tarefas sem prazo específico. */
export async function recalcularPrazos(tx: Tx, onboardingId: string, inicio: Date) {
  const tarefas = await tx.tarefaOnboarding.findMany({ where: { onboardingId, prazoFixo: false }, include: { fase: { select: { marcoDias: true } } } });
  for (const t of tarefas) {
    await tx.tarefaOnboarding.update({ where: { id: t.id }, data: { prazo: prazoCalculado(inicio, t.prazoDias, t.fase.marcoDias) } });
  }
}

export type ResultadoAutomatico =
  | { situacao: "criado"; onboardingId: string; mensagem: string }
  | { situacao: "existente" | "sem_data" | "nao_aplicavel"; mensagem: string }
  | { situacao: "erro"; mensagem: string };

/**
 * Criação automática ao cadastrar (ou converter) uma pessoa numa organização
 * com Onboarding ativo. Transação própria: se falhar, o cadastro já está salvo
 * e o motivo volta para ser exibido. Idempotente — reenvios não duplicam
 * (checagem + índice único de onboarding ativo por pessoa).
 */
export async function criarOnboardingAutomatico(ator: Ator, colaboradorId: string, origem: "cadastro" | "crm", modeloId?: string | null): Promise<ResultadoAutomatico> {
  try {
    return await transacao({ escopo: "tenant", tenantId: ator.tenantId, usuarioId: ator.usuario.id }, async (tx) => {
      const c = await tx.colaborador.findUnique({ where: { id: colaboradorId } });
      if (!c || c.status === "desligado") return { situacao: "nao_aplicavel" as const, mensagem: "Pessoa desligada não recebe onboarding." };
      if (await tx.onboarding.findFirst({ where: { colaboradorId, status: "em_andamento" } })) {
        return { situacao: "existente" as const, mensagem: "A pessoa já tem um onboarding ativo." };
      }
      if (!c.dataAdmissao) return { situacao: "sem_data" as const, mensagem: "Onboarding não criado: informe a data de admissão para criá-lo automaticamente." };
      const id = await iniciarOnboardingPara(tx, ator, { colaboradorId, modeloId, inicio: c.dataAdmissao, origem });
      return { situacao: "criado" as const, onboardingId: id, mensagem: "Onboarding criado automaticamente." };
    });
  } catch (e) {
    const codigo = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (codigo === "P2002") return { situacao: "existente", mensagem: "A pessoa já tem um onboarding ativo." };
    return { situacao: "erro", mensagem: `O cadastro foi salvo, mas o onboarding não pôde ser criado: ${e instanceof Error ? e.message : "erro inesperado"}. Crie-o manualmente em Onboarding.` };
  }
}
