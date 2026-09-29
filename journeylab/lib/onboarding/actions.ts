"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, pode, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto, hoje } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { emailValido, enviarEmail, ErroEmail, esc } from "@/lib/email";
import { enviarArquivo, removerArquivo, TAMANHO_MAXIMO, TIPOS_ANEXO, tipoRealAnexo } from "@/lib/storage";
import { garantirModeloPadrao, iniciarOnboardingPara, mudarStatusTarefa, recalcularOnboarding, recalcularPrazos, type Ator } from "./servico";
import { ehPendente, prazoCalculado, RESPONSAVEL, STATUS_TAREFA, type StatusTarefa } from "./calculo";
import { filtroOnboardings, podeAtualizarTarefa } from "./regras";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Registro duplicado: já existe um template com esse nome/área ou um onboarding ativo para esta pessoa." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const texto = z.string().trim().transform((v) => v || null);
const data = (msg: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, msg).transform((v) => dataDeTexto(v));
const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const ator = (ctx: Contexto): Ator => ({ tenantId: ctx.org.id, usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome } });
const STATUS = ["nao_iniciada", "em_andamento", "bloqueada", "concluida", "dispensada"] as const;

/** Templates exigem Onboarding › Editar com escopo "todos" (RH/Admin). */
async function exigirGestaoModelos() {
  const r = await exigirPermissaoAcao("onboarding", "editar");
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite gerenciar templates de onboarding.");
  return r;
}

async function evento(tx: Tx, ctx: Contexto, onboardingId: string, t: string) {
  await tx.eventoOnboarding.create({ data: { tenantId: ctx.org.id, onboardingId, texto: t, autorNome: ctx.usuario.nome } });
}

/** Onboarding visível pelo escopo de "visualizar" (organização garantida pelo RLS). */
async function onboardingVisivel(tx: Tx, ctx: Contexto, id: string) {
  const escopo = pode(ctx, "onboarding", "visualizar");
  if (!escopo) throw new ErroAcesso("Sem acesso ao Onboarding.");
  const o = await tx.onboarding.findFirst({ where: { AND: [{ id }, filtroOnboardings(ctx, escopo)] } });
  if (!o) throw new ErroAcesso("Onboarding não encontrado.");
  return o;
}

async function tarefaVisivel(tx: Tx, ctx: Contexto, tarefaId: string) {
  const escopo = pode(ctx, "onboarding", "visualizar");
  if (!escopo) throw new ErroAcesso("Sem acesso ao Onboarding.");
  const t = await tx.tarefaOnboarding.findFirst({ where: { id: tarefaId, onboarding: filtroOnboardings(ctx, escopo) }, include: { onboarding: true } });
  if (!t) throw new ErroAcesso("Tarefa não encontrada.");
  return t;
}

const revalidar = (onboardingId: string) => {
  revalidatePath(`/onboarding/${onboardingId}`);
  revalidatePath("/onboarding");
  revalidatePath("/inicio");
};

// ─── Templates ────────────────────────────────────────────────────────────

export async function salvarModelo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let novoId: string | null = null;
  try {
    const { ctx } = await exigirGestaoModelos();
    const id = String(fd.get("id") ?? "") || null;
    const areaId = String(fd.get("areaId") ?? "") || null;
    const dados = {
      nome: z.string().trim().min(3, "Informe o nome do template.").parse(fd.get("nome")),
      descricao: texto.parse(fd.get("descricao") ?? ""),
      boasVindas: texto.parse(fd.get("boasVindas") ?? ""),
      ativo: fd.get("ativo") === "on" || !id,
      padrao: fd.get("padrao") === "on",
      areaId: areaId ? z.string().uuid().parse(areaId) : null,
    };
    if (dados.padrao && dados.areaId) throw new ErroAcesso("O template padrão vale para toda a organização; deixe a área em branco.");
    if (dados.padrao && !dados.ativo) throw new ErroAcesso("O template padrão precisa estar ativo.");
    await transacao(escopoTx(ctx), async (tx) => {
      if (dados.areaId && !(await tx.area.findUnique({ where: { id: dados.areaId } }))) throw new ErroAcesso("Área inválida.");
      // Um único padrão por organização: ao marcar este, desmarca o anterior.
      if (dados.padrao) await tx.modeloOnboarding.updateMany({ where: { padrao: true, ...(id ? { id: { not: id } } : {}) }, data: { padrao: false } });
      if (id) {
        if (!(await tx.modeloOnboarding.findUnique({ where: { id } }))) throw new ErroAcesso("Template não encontrado.");
        await tx.modeloOnboarding.update({ where: { id }, data: dados });
      } else {
        const m = await tx.modeloOnboarding.create({ data: { ...dados, tenantId: ctx.org.id, criadoPor: ctx.usuario.nome } });
        novoId = m.id;
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: ator(ctx).usuario, acao: id ? "onboarding.modelo.editar" : "onboarding.modelo.criar", entidade: "modelo_onboarding", entidadeId: id ?? novoId });
    });
    revalidatePath("/onboarding/modelos");
  } catch (e) {
    return erroDe(e);
  }
  if (novoId) redirect(`/onboarding/modelos/${novoId}`);
  return { ok: "Template salvo." };
}

/** Cria o template 30/60/90 (padrão) quando a organização ainda não tem um padrão. */
export async function criarModeloPadrao(): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx } = await exigirGestaoModelos();
    id = await transacao(escopoTx(ctx), async (tx) => (await garantirModeloPadrao(tx, ator(ctx))).id);
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/onboarding/modelos");
  redirect(`/onboarding/modelos/${id}`);
}

const faseSchema = z.object({
  titulo: z.string().trim().min(2, "Informe o nome da fase."),
  descricao: texto,
  marcoDias: z.coerce.number({ message: "Informe o marco em dias." }).int().min(1, "O marco é pelo menos o dia 1.").max(730),
});

export async function adicionarEtapa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestaoModelos();
    const modeloId = z.string().uuid().parse(fd.get("modeloId"));
    const d = faseSchema.parse({ titulo: fd.get("titulo"), descricao: fd.get("descricao") ?? "", marcoDias: fd.get("marcoDias") });
    await transacao(escopoTx(ctx), async (tx) => {
      if (!(await tx.modeloOnboarding.findUnique({ where: { id: modeloId } }))) throw new ErroAcesso("Template não encontrado.");
      const ordem = await tx.etapaModelo.count({ where: { modeloId } });
      await tx.etapaModelo.create({ data: { tenantId: ctx.org.id, modeloId, ordem, ...d } });
    });
    revalidatePath(`/onboarding/modelos/${modeloId}`);
    return { ok: "Fase incluída." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function salvarEtapa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestaoModelos();
    const etapaId = z.string().uuid().parse(fd.get("etapaId"));
    const d = faseSchema.parse({ titulo: fd.get("titulo"), descricao: fd.get("descricao") ?? "", marcoDias: fd.get("marcoDias") });
    const modeloId = await transacao(escopoTx(ctx), async (tx) => {
      const e = await tx.etapaModelo.findUnique({ where: { id: etapaId } });
      if (!e) throw new ErroAcesso("Fase não encontrada.");
      await tx.etapaModelo.update({ where: { id: etapaId }, data: d });
      return e.modeloId;
    });
    revalidatePath(`/onboarding/modelos/${modeloId}`);
    return { ok: "Fase atualizada. Vale para os próximos onboardings." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function excluirEtapa(etapaId: string) {
  const { ctx } = await exigirGestaoModelos();
  const modeloId = await transacao(escopoTx(ctx), async (tx) => {
    const e = await tx.etapaModelo.findUnique({ where: { id: etapaId } });
    if (!e) throw new ErroAcesso("Fase não encontrada.");
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
  prazoDias: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ message: "Prazo em dias inválido." }).int().min(-60, "Prazo muito antecipado.").max(730).nullable()),
  materialUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(z.string().url("Link inválido.").refine((u) => u.startsWith("https://"), "Use um link https://").nullable()),
});

export async function adicionarTarefaModelo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestaoModelos();
    const etapaId = z.string().uuid().parse(fd.get("etapaId"));
    const d = tarefaSchema.parse({
      titulo: fd.get("titulo"),
      descricao: fd.get("descricao") ?? "",
      tipo: fd.get("tipo"),
      responsavel: fd.get("responsavel"),
      prazoDias: fd.get("prazoDias") ?? "",
      materialUrl: fd.get("materialUrl") ?? "",
    });
    const obrigatoria = fd.get("obrigatoria") === "on";
    const modeloId = await transacao(escopoTx(ctx), async (tx) => {
      const e = await tx.etapaModelo.findUnique({ where: { id: etapaId } });
      if (!e) throw new ErroAcesso("Fase não encontrada.");
      const ordem = await tx.tarefaModelo.count({ where: { etapaId } });
      await tx.tarefaModelo.create({ data: { ...d, obrigatoria, tenantId: ctx.org.id, etapaId, ordem } });
      return e.modeloId;
    });
    revalidatePath(`/onboarding/modelos/${modeloId}`);
    return { ok: "Tarefa incluída." };
  } catch (e) {
    return erroDe(e);
  }
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

/** Criação manual (RH/Admin). Template vazio = template aplicável à pessoa. */
export async function iniciarOnboarding(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "criar");
    if (escopo !== "todos") throw new ErroAcesso("Seu papel não permite criar onboardings.");
    const colaboradorId = z.string().uuid("Selecione a pessoa.").parse(fd.get("colaboradorId"));
    const modeloTxt = String(fd.get("modeloId") ?? "");
    const modeloId = modeloTxt ? z.string().uuid().parse(modeloTxt) : null;
    const inicio = data("Informe a data de início.").parse(fd.get("inicio"));
    id = await transacao(escopoTx(ctx), (tx) => iniciarOnboardingPara(tx, ator(ctx), { colaboradorId, modeloId, inicio, origem: "manual" }));
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/onboarding");
  redirect(`/onboarding/${id}`);
}

/** Mudança de status por formulário (botões rápidos). */
export async function atualizarTarefa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const r = await moverTarefa(String(fd.get("tarefaId") ?? ""), String(fd.get("status") ?? ""), String(fd.get("motivo") ?? ""));
  return r.erro ? { erro: r.erro } : { ok: r.ok };
}

export type ResultadoMover = { ok?: string; erro?: string; progresso?: number; status?: string };

/**
 * Mudança de status chamada pelo Kanban (arrastar) e pelos botões — mesma
 * validação, mesma transação, mesmo recálculo (lib/onboarding/servico.ts).
 */
export async function moverTarefa(tarefaId: string, status: string, motivoTxt?: string): Promise<ResultadoMover> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
    const id = z.string().uuid("Tarefa inválida.").parse(tarefaId);
    const novo = z.enum(STATUS, { message: "Status inválido." }).parse(status) as StatusTarefa;
    const motivo = (motivoTxt ?? "").trim().slice(0, 500) || null;
    const r = await transacao(escopoTx(ctx), async (tx) => {
      const t = await tarefaVisivel(tx, ctx, id);
      const res = await mudarStatusTarefa(tx, ator(ctx), escopo, t, novo, motivo);
      return { ...res, onboardingId: t.onboardingId };
    });
    revalidar(r.onboardingId);
    return { ok: `Tarefa: ${STATUS_TAREFA[novo].nome.toLowerCase()}.`, progresso: r.progresso, status: r.status };
  } catch (e) {
    return { erro: erroDe(e).erro };
  }
}

/** Prazo específico e pessoa designada (RH, ou gestor nas tarefas que pode atualizar). */
export async function editarTarefa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
    const id = z.string().uuid().parse(fd.get("tarefaId"));
    const prazoTxt = String(fd.get("prazo") ?? "").trim();
    const designadoTxt = String(fd.get("responsavelId") ?? "");
    const onboardingId = await transacao(escopoTx(ctx), async (tx) => {
      const t = await tarefaVisivel(tx, ctx, id);
      if (!podeAtualizarTarefa(escopo, t)) throw new ErroAcesso("Você não pode alterar esta tarefa.");
      if (t.onboarding.status === "cancelado") throw new ErroAcesso("Onboarding cancelado não aceita alterações.");
      const fase = await tx.faseOnboarding.findUniqueOrThrow({ where: { id: t.faseId } });
      const prazo = prazoTxt ? dataDeTexto(prazoTxt) : prazoCalculado(t.onboarding.inicio, t.prazoDias, fase.marcoDias);
      let responsavelId = t.responsavelId;
      if (designadoTxt !== "") {
        responsavelId = designadoTxt === "nenhum" ? null : z.string().uuid().parse(designadoTxt);
        if (responsavelId && !(await tx.colaborador.findUnique({ where: { id: responsavelId } }))) throw new ErroAcesso("Pessoa designada inválida.");
      }
      await tx.tarefaOnboarding.update({ where: { id }, data: { prazo, prazoFixo: !!prazoTxt, responsavelId } });
      await evento(tx, ctx, t.onboardingId, `Tarefa “${t.titulo}”: prazo ${prazoTxt ? `específico em ${formatarData(prazo)}` : `calculado (${formatarData(prazo)})`}.`);
      return t.onboardingId;
    });
    revalidar(onboardingId);
    return { ok: "Tarefa atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Nova data de início (RH): recalcula os prazos das tarefas sem prazo específico. */
export async function alterarInicio(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "editar");
    if (escopo !== "todos") throw new ErroAcesso("Somente o RH altera a data de início.");
    const id = z.string().uuid().parse(fd.get("onboardingId"));
    const inicio = data("Informe a data de início.").parse(fd.get("inicio"));
    await transacao(escopoTx(ctx), async (tx) => {
      const o = await onboardingVisivel(tx, ctx, id);
      if (o.status === "cancelado") throw new ErroAcesso("Onboarding cancelado.");
      await tx.onboarding.update({ where: { id }, data: { inicio } });
      await recalcularPrazos(tx, id, inicio);
      await evento(tx, ctx, id, `Data de início alterada para ${formatarData(inicio)}; prazos recalculados.`);
    });
    revalidar(id);
    return { ok: "Data de início atualizada e prazos recalculados." };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Conclusão manual (RH): usada quando não há tarefas obrigatórias (a conclusão
 * automática cobre os demais casos). Exige nenhuma obrigatória pendente.
 */
export async function concluirOnboarding(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
    if (escopo !== "todos") throw new ErroAcesso("Somente o RH conclui o onboarding manualmente.");
    const id = z.string().uuid().parse(fd.get("onboardingId"));
    await transacao(escopoTx(ctx), async (tx) => {
      await onboardingVisivel(tx, ctx, id);
      const o = await tx.onboarding.findUniqueOrThrow({ where: { id }, include: { tarefas: true, colaborador: true } });
      if (o.status !== "em_andamento") throw new ErroAcesso("Este onboarding já foi encerrado.");
      const pendentes = o.tarefas.filter((t) => t.obrigatoria && ehPendente(t.status));
      if (pendentes.length) throw new ErroAcesso(`Ainda há ${pendentes.length} tarefa(s) obrigatória(s) pendente(s). Conclua ou dispense antes de encerrar.`);
      await tx.onboarding.update({ where: { id }, data: { status: "concluido", concluidoEm: new Date(), concluidoPor: ctx.usuario.nome } });
      if (o.colaborador.status === "pre_admissao") await tx.colaborador.update({ where: { id: o.colaboradorId }, data: { status: "ativo" } });
      await evento(tx, ctx, id, "Onboarding concluído manualmente.");
      await auditar(tx, { tenantId: ctx.org.id, usuario: ator(ctx).usuario, acao: "onboarding.concluir", entidade: "onboarding", entidadeId: id });
    });
    revalidar(id);
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
      const o = await onboardingVisivel(tx, ctx, id);
      if (o.status !== "em_andamento") throw new ErroAcesso("Onboarding não está em andamento.");
      await tx.onboarding.update({ where: { id }, data: { status: "cancelado", concluidoEm: new Date(), concluidoPor: ctx.usuario.nome } });
      await evento(tx, ctx, id, `Onboarding cancelado: ${motivo}`);
      await auditar(tx, { tenantId: ctx.org.id, usuario: ator(ctx).usuario, acao: "onboarding.cancelar", entidade: "onboarding", entidadeId: id, detalhes: { motivo } });
    });
    revalidar(id);
    return { ok: "Onboarding cancelado. O histórico foi preservado." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Recalcula progresso/status sob demanda (mesma função usada nas mudanças de tarefa). */
export async function reprocessarOnboarding(onboardingId: string) {
  const { ctx } = await exigirPermissaoAcao("onboarding", "concluir");
  await transacao(escopoTx(ctx), async (tx) => {
    await onboardingVisivel(tx, ctx, onboardingId);
    await recalcularOnboarding(tx, onboardingId, ator(ctx));
  });
  revalidar(onboardingId);
}

// ─── Lembrete ao gestor ───────────────────────────────────────────────────

const INTERVALO_LEMBRETE_MS = 60 * 60 * 1000;

/**
 * Envia ao GESTOR DIRETO do colaborador (destinatário resolvido no servidor —
 * nunca informado pelo navegador) um resumo com progresso e tarefas pendentes.
 * E-mail: o da conta do gestor na plataforma ou, na falta, o do cadastro.
 */
export async function enviarLembreteGestor(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirPermissaoAcao("onboarding", "concluir");
    const id = z.string().uuid().parse(fd.get("onboardingId"));
    const { o, gestor } = await transacao(escopoTx(ctx), async (tx) => {
      await onboardingVisivel(tx, ctx, id);
      const o = await tx.onboarding.findUniqueOrThrow({
        where: { id },
        include: {
          colaborador: {
            select: { nome: true, cargo: true, gestor: { select: { nome: true, email: true, associacao: { select: { status: true, usuario: { select: { email: true } } } } } } },
          },
          tarefas: { where: { status: { in: ["nao_iniciada", "em_andamento", "bloqueada"] } }, orderBy: { prazo: "asc" } },
        },
      });
      if (o.status !== "em_andamento") throw new ErroAcesso("O onboarding não está em andamento.");
      const g = o.colaborador.gestor;
      if (!g) throw new ErroAcesso("Este colaborador não tem gestor definido no cadastro.");
      const email = g.associacao?.status === "ativa" ? g.associacao.usuario.email : g.email;
      if (!email) throw new ErroAcesso(`${g.nome} não tem e-mail cadastrado.`);
      if (!emailValido(email)) throw new ErroAcesso(`O e-mail cadastrado de ${g.nome} é inválido.`);
      if (o.lembreteEm && Date.now() - o.lembreteEm.getTime() < INTERVALO_LEMBRETE_MS) throw new ErroAcesso("Um lembrete já foi enviado na última hora.");
      return { o, gestor: { nome: g.nome, email } };
    });

    const h = hoje();
    const itens = o.tarefas.map((t) => ({ t, atrasada: t.prazo < h }));
    const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/onboarding/${o.id}`;
    const primeiro = gestor.nome.split(" ")[0];
    const cargo = o.colaborador.cargo ? ` (${o.colaborador.cargo})` : "";
    const assunto = `Onboarding de ${o.colaborador.nome}: ${o.progresso}% concluído`;
    const textoEmail = [
      `Olá, ${primeiro}.`,
      "",
      `O onboarding de ${o.colaborador.nome}${cargo} está ${o.progresso}% concluído.`,
      itens.length ? `Tarefas pendentes (${itens.length}):` : "Não há tarefas pendentes.",
      ...itens.map(({ t, atrasada }) => `• ${t.titulo} — ${RESPONSAVEL[t.responsavelTipo]} — prazo ${formatarData(t.prazo)}${atrasada ? " (atrasada)" : ""}${t.status === "bloqueada" ? " — bloqueada" : ""}`),
      "",
      `Acompanhe no JourneyLab: ${link}`,
      `Enviado por ${ctx.usuario.nome} (${ctx.org.nome}).`,
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;color:#0B1F3A;max-width:560px">
      <p>Olá, ${esc(primeiro)}.</p>
      <p>O onboarding de <strong>${esc(o.colaborador.nome)}</strong>${esc(cargo)} está <strong>${o.progresso}% concluído</strong>.</p>
      ${
        itens.length
          ? `<p>Tarefas pendentes (${itens.length}):</p><ul>${itens
              .map(
                ({ t, atrasada }) =>
                  `<li>${esc(t.titulo)} — ${RESPONSAVEL[t.responsavelTipo]} — prazo ${formatarData(t.prazo)}${atrasada ? ' <strong style="color:#D93A3F">(atrasada)</strong>' : ""}${t.status === "bloqueada" ? ' <strong style="color:#D93A3F">bloqueada</strong>' : ""}</li>`,
              )
              .join("")}</ul>`
          : "<p>Não há tarefas pendentes.</p>"
      }
      <p><a href="${esc(link)}" style="color:#0B7A70">Abrir o onboarding no JourneyLab</a></p>
      <p style="color:#526173;font-size:12px">Enviado por ${esc(ctx.usuario.nome)} (${esc(ctx.org.nome)}).</p></div>`;
    await enviarEmail({ para: gestor.email, assunto, texto: textoEmail, html });

    await transacao(escopoTx(ctx), async (tx) => {
      await tx.onboarding.update({ where: { id }, data: { lembreteEm: new Date() } });
      await evento(tx, ctx, id, `Lembrete enviado por e-mail a ${gestor.nome}.`);
      await auditar(tx, { tenantId: ctx.org.id, usuario: ator(ctx).usuario, acao: "onboarding.lembrete", entidade: "onboarding", entidadeId: id });
    });
    revalidar(id);
    return { ok: `Lembrete enviado a ${gestor.nome}.` };
  } catch (e) {
    if (e instanceof ErroEmail) return { erro: e.message };
    return erroDe(e);
  }
}

// ─── Anexos de tarefas ────────────────────────────────────────────────────

export async function enviarAnexoTarefa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
    const tarefaId = z.string().uuid().parse(fd.get("tarefaId"));
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo." };
    if (arquivo.size > TAMANHO_MAXIMO) return { erro: "Arquivo acima de 10 MB." };
    const real = await tipoRealAnexo(arquivo);
    if (!real || !TIPOS_ANEXO[real]) return { erro: "Formato não aceito. Envie PDF, DOC, DOCX, PNG ou JPG." };
    const onboardingId = await transacao(escopoTx(ctx), async (tx) => {
      const t = await tarefaVisivel(tx, ctx, tarefaId);
      if (!podeAtualizarTarefa(escopo, t)) throw new ErroAcesso("Você não pode anexar arquivos nesta tarefa.");
      const caminho = await enviarArquivo(ctx.org.id, `onboarding/${t.onboardingId}`, arquivo);
      await tx.anexoTarefaOnboarding.create({ data: { tenantId: ctx.org.id, tarefaId, nomeArquivo: arquivo.name.slice(0, 200), caminho, tamanho: arquivo.size, mime: real, enviadoPor: ctx.usuario.nome } });
      await evento(tx, ctx, t.onboardingId, `Anexo incluído em “${t.titulo}”: ${arquivo.name}.`);
      return t.onboardingId;
    });
    revalidar(onboardingId);
    return { ok: "Anexo enviado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function removerAnexoTarefa(anexoId: string) {
  const { ctx, escopo } = await exigirPermissaoAcao("onboarding", "concluir");
  const r = await transacao(escopoTx(ctx), async (tx) => {
    const a = await tx.anexoTarefaOnboarding.findUnique({ where: { id: anexoId } });
    if (!a) throw new ErroAcesso("Anexo não encontrado.");
    const t = await tarefaVisivel(tx, ctx, a.tarefaId);
    if (!podeAtualizarTarefa(escopo, t)) throw new ErroAcesso("Você não pode remover este anexo.");
    await tx.anexoTarefaOnboarding.delete({ where: { id: anexoId } });
    await evento(tx, ctx, t.onboardingId, `Anexo removido de “${t.titulo}”: ${a.nomeArquivo}.`);
    return { caminho: a.caminho, onboardingId: t.onboardingId };
  });
  await removerArquivo(r.caminho).catch(() => undefined);
  revalidar(r.onboardingId);
}
