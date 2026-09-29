"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, pode, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { iniciarOnboardingPara } from "./servico";
import { filtroOnboardings, podeConcluirTarefa } from "./regras";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Já existe um registro com esse nome (ou um onboarding em andamento para esta pessoa)." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const texto = z.string().trim().transform((v) => v || null);
const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });

/** Modelos: exigem Onboarding › Editar com escopo "todos". */
async function exigirGestaoModelos() {
  const r = await exigirPermissaoAcao("onboarding", "editar");
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite gerenciar modelos de onboarding.");
  return r;
}

async function evento(tx: Tx, ctx: Contexto, onboardingId: string, t: string) {
  await tx.eventoOnboarding.create({ data: { tenantId: ctx.org.id, onboardingId, texto: t, autorNome: ctx.usuario.nome } });
}

// ─── Modelos ──────────────────────────────────────────────────────────────

export async function salvarModelo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let novoId: string | null = null;
  try {
    const { ctx } = await exigirGestaoModelos();
    const id = String(fd.get("id") ?? "") || null;
    const dados = {
      nome: z.string().trim().min(3, "Informe o nome do modelo.").parse(fd.get("nome")),
      descricao: texto.parse(fd.get("descricao") ?? ""),
      boasVindas: texto.parse(fd.get("boasVindas") ?? ""),
      ativo: fd.get("ativo") === "on" || !id,
    };
    await transacao(escopoTx(ctx), async (tx) => {
      if (id) {
        if (!(await tx.modeloOnboarding.findUnique({ where: { id } }))) throw new ErroAcesso("Modelo não encontrado.");
        await tx.modeloOnboarding.update({ where: { id }, data: dados });
      } else {
        const m = await tx.modeloOnboarding.create({ data: { ...dados, tenantId: ctx.org.id, criadoPor: ctx.usuario.nome } });
        novoId = m.id;
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: id ? "onboarding.modelo.editar" : "onboarding.modelo.criar", entidade: "modelo_onboarding", entidadeId: id ?? novoId });
    });
    revalidatePath("/onboarding/modelos");
  } catch (e) {
    return erroDe(e);
  }
  if (novoId) redirect(`/onboarding/modelos/${novoId}`);
  return { ok: "Modelo salvo." };
}

export async function adicionarEtapa(modeloId: string, fd: FormData) {
  const { ctx } = await exigirGestaoModelos();
  const titulo = z.string().trim().min(2, "Informe o título da etapa.").parse(fd.get("titulo"));
  await transacao(escopoTx(ctx), async (tx) => {
    if (!(await tx.modeloOnboarding.findUnique({ where: { id: modeloId } }))) throw new ErroAcesso("Modelo não encontrado.");
    const ordem = await tx.etapaModelo.count({ where: { modeloId } });
    await tx.etapaModelo.create({ data: { tenantId: ctx.org.id, modeloId, titulo, ordem } });
  });
  revalidatePath(`/onboarding/modelos/${modeloId}`);
}

export async function excluirEtapa(etapaId: string) {
  const { ctx } = await exigirGestaoModelos();
  const modeloId = await transacao(escopoTx(ctx), async (tx) => {
    const e = await tx.etapaModelo.findUnique({ where: { id: etapaId } });
    if (!e) throw new ErroAcesso("Etapa não encontrada.");
    await tx.etapaModelo.delete({ where: { id: etapaId } });
    return e.modeloId;
  });
  revalidatePath(`/onboarding/modelos/${modeloId}`);
}

const tarefaSchema = z.object({
  titulo: z.string().trim().min(2, "Informe o título da tarefa."),
  descricao: texto,
  tipo: z.enum(["tarefa", "documento", "material"]),
  responsavel: z.enum(["rh", "gestor", "colaborador"]),
  prazoDias: z.coerce.number().int().min(-60, "Prazo muito antecipado.").max(365),
  materialUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().url("Link inválido.").refine((u) => u.startsWith("https://"), "Use um link https://").nullable()),
});

export async function adicionarTarefaModelo(etapaId: string, fd: FormData) {
  const { ctx } = await exigirGestaoModelos();
  const d = tarefaSchema.parse(Object.fromEntries(fd));
  const modeloId = await transacao(escopoTx(ctx), async (tx) => {
    const e = await tx.etapaModelo.findUnique({ where: { id: etapaId } });
    if (!e) throw new ErroAcesso("Etapa não encontrada.");
    const ordem = await tx.tarefaModelo.count({ where: { etapaId } });
    await tx.tarefaModelo.create({ data: { ...d, tenantId: ctx.org.id, etapaId, ordem } });
    return e.modeloId;
  });
  revalidatePath(`/onboarding/modelos/${modeloId}`);
}

export async function excluirTarefaModelo(tarefaId: string) {
  const { ctx } = await exigirGestaoModelos();
  const modeloId = await transacao(escopoTx(ctx), async (tx) => {
    const t = await tx.tarefaModelo.findUnique({ where: { id: tarefaId }, include: { etapa: true } });
    if (!t) throw new ErroAcesso("Tarefa não encontrada.");
    await tx.tarefaModelo.delete({ where: { id: tarefaId } });
    return t.etapa.modeloId;
  });
  revalidatePath(`/onboarding/modelos/${modeloId}`);
}

// ─── Onboardings ──────────────────────────────────────────────────────────

export async function iniciarOnboarding(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "criar");
    if (escopo !== "todos") throw new ErroAcesso("Seu papel não permite iniciar onboardings.");
    const colaboradorId = z.string().uuid("Selecione a pessoa.").parse(fd.get("colaboradorId"));
    const modeloId = z.string().uuid("Selecione o modelo.").parse(fd.get("modeloId"));
    const inicio = z.string().trim().min(10, "Informe a data de início.").parse(fd.get("inicio"));
    id = await transacao(escopoTx(ctx), (tx) => iniciarOnboardingPara(tx, ctx, { colaboradorId, modeloId, inicio: new Date(`${inicio}T12:00:00`) }));
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/onboarding");
  redirect(`/onboarding/${id}`);
}

/** Carrega a tarefa garantindo organização (RLS) e visibilidade do onboarding pelo escopo. */
async function tarefaVisivel(tx: Tx, ctx: Contexto, tarefaId: string) {
  const escopoVer = pode(ctx, "onboarding", "visualizar");
  if (!escopoVer) throw new ErroAcesso("Sem acesso ao onboarding.");
  const t = await tx.tarefaOnboarding.findFirst({
    where: { id: tarefaId, onboarding: filtroOnboardings(ctx, escopoVer) },
    include: { onboarding: true },
  });
  if (!t) throw new ErroAcesso("Tarefa não encontrada.");
  return t;
}

export async function alterarTarefa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
    const tarefaId = z.string().uuid().parse(fd.get("tarefaId"));
    const acao = z.enum(["concluir", "dispensar", "reabrir"]).parse(fd.get("acao"));
    const observacao = texto.parse(fd.get("observacao") ?? "");
    const onboardingId = await transacao(escopoTx(ctx), async (tx) => {
      const t = await tarefaVisivel(tx, ctx, tarefaId);
      if (t.onboarding.status !== "em_andamento") throw new ErroAcesso("Este onboarding não está em andamento.");
      if (!podeConcluirTarefa(ctx, escopo, t)) throw new ErroAcesso("Esta tarefa é de outro responsável.");
      // Dispensar e reabrir são decisões de gestão do processo: só escopo "todos".
      if (acao !== "concluir" && escopo !== "todos") throw new ErroAcesso("Somente o RH pode dispensar ou reabrir tarefas.");
      if (acao === "dispensar" && !observacao) throw new ErroAcesso("Informe o motivo para dispensar a tarefa.");
      await tx.tarefaOnboarding.update({
        where: { id: tarefaId },
        data:
          acao === "reabrir"
            ? { status: "pendente", concluidaEm: null, concluidaPor: null }
            : { status: acao === "concluir" ? "concluida" : "dispensada", concluidaEm: new Date(), concluidaPor: ctx.usuario.nome, observacao: observacao ?? t.observacao },
      });
      await evento(tx, ctx, t.onboardingId, `Tarefa “${t.titulo}” ${acao === "concluir" ? "concluída" : acao === "reabrir" ? "reaberta" : "dispensada"}${observacao ? `: ${observacao}` : ""}.`);
      return t.onboardingId;
    });
    revalidatePath(`/onboarding/${onboardingId}`);
    revalidatePath("/inicio");
    return { ok: acao === "concluir" ? "Tarefa concluída." : acao === "dispensar" ? "Tarefa dispensada." : "Tarefa reaberta." };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Conclui o onboarding: exige todas as tarefas concluídas ou dispensadas.
 * A pessoa passa a "ativo" — disponível para Feedback 1:1, Pulse e PDI
 * (quando contratados), sem novo cadastro.
 */
export async function concluirOnboarding(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
    if (escopo !== "todos") throw new ErroAcesso("Somente o RH pode concluir o onboarding.");
    const id = z.string().uuid().parse(fd.get("onboardingId"));
    await transacao(escopoTx(ctx), async (tx) => {
      const o = await tx.onboarding.findUnique({ where: { id }, include: { tarefas: true, colaborador: true } });
      if (!o) throw new ErroAcesso("Onboarding não encontrado.");
      if (o.status !== "em_andamento") throw new ErroAcesso("Este onboarding já foi encerrado.");
      const pendentes = o.tarefas.filter((t) => t.status === "pendente");
      if (pendentes.length) throw new ErroAcesso(`Ainda há ${pendentes.length} tarefa(s) pendente(s). Conclua ou dispense antes de encerrar.`);
      await tx.onboarding.update({ where: { id }, data: { status: "concluido", concluidoEm: new Date(), concluidoPor: ctx.usuario.nome } });
      if (o.colaborador.status === "pre_admissao") {
        await tx.colaborador.update({ where: { id: o.colaboradorId }, data: { status: "ativo" } });
      }
      await evento(tx, ctx, id, "Onboarding concluído. A pessoa está disponível para acompanhamento nos demais módulos.");
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "onboarding.concluir", entidade: "onboarding", entidadeId: id });
    });
    revalidatePath(`/onboarding/${id}`);
    revalidatePath("/onboarding");
    return { ok: "Onboarding concluído." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function cancelarOnboarding(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "editar");
    if (escopo !== "todos") throw new ErroAcesso("Somente o RH pode cancelar o onboarding.");
    const id = z.string().uuid().parse(fd.get("onboardingId"));
    const motivo = z.string().trim().min(5, "Informe o motivo do cancelamento.").parse(fd.get("motivo"));
    await transacao(escopoTx(ctx), async (tx) => {
      const o = await tx.onboarding.findUnique({ where: { id } });
      if (!o || o.status !== "em_andamento") throw new ErroAcesso("Onboarding não está em andamento.");
      await tx.onboarding.update({ where: { id }, data: { status: "cancelado", concluidoEm: new Date(), concluidoPor: ctx.usuario.nome } });
      await evento(tx, ctx, id, `Onboarding cancelado: ${motivo}`);
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "onboarding.cancelar", entidade: "onboarding", entidadeId: id, detalhes: { motivo } });
    });
    revalidatePath(`/onboarding/${id}`);
    return { ok: "Onboarding cancelado. O histórico foi preservado." };
  } catch (e) {
    return erroDe(e);
  }
}
