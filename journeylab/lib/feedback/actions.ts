"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, pode, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { escopoCobre } from "@/lib/escopo";
import { instanteNoFuso } from "@/lib/datas";
import { filtroReunioes, participa, podeConcluirCompromisso, podeEditarReuniao } from "./regras";
import { PDI_ABERTO } from "@/lib/pdi/regras";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Já existe um registro com esses dados." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const texto = z.string().trim().transform((v) => v || null);
const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const linhas = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);

/** Reunião visível pelo escopo de "visualizar" (organização garantida pelo RLS). */
async function reuniaoVisivel(tx: Tx, ctx: Contexto, id: string) {
  const escopo = pode(ctx, "feedback", "visualizar");
  if (!escopo) throw new ErroAcesso("Sem acesso ao Feedback 1:1.");
  const r = await tx.reuniao.findFirst({ where: { AND: [{ id }, filtroReunioes(ctx, escopo)] } });
  if (!r) throw new ErroAcesso("Reunião não encontrada.");
  return r;
}

// ─── Modelos de pauta (administrar) ───────────────────────────────────────

export async function salvarModeloPauta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "administrar");
    if (escopo !== "todos") throw new ErroAcesso("Seu papel não permite gerenciar modelos de pauta.");
    const id = String(fd.get("id") ?? "") || null;
    const nome = z.string().trim().min(3, "Informe o nome do modelo.").parse(fd.get("nome"));
    const itens = linhas(fd.get("itens"));
    if (!itens.length) throw new ErroAcesso("Inclua ao menos um tópico (um por linha).");
    const ativo = id ? fd.get("ativo") === "on" : true;
    await transacao(escopoTx(ctx), async (tx) => {
      if (id) {
        if (!(await tx.modeloPauta.findUnique({ where: { id } }))) throw new ErroAcesso("Modelo não encontrado.");
        await tx.modeloPauta.update({ where: { id }, data: { nome, itens, ativo } });
      } else {
        await tx.modeloPauta.create({ data: { tenantId: ctx.org.id, nome, itens, criadoPor: ctx.usuario.nome } });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: id ? "feedback.pauta.editar" : "feedback.pauta.criar", entidade: "modelo_pauta", entidadeId: id, detalhes: { nome } });
    });
    revalidatePath("/feedback/modelos");
    return { ok: "Modelo de pauta salvo." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Reuniões ─────────────────────────────────────────────────────────────

/**
 * Agenda um 1:1. Escopo "equipe": só com liderados diretos, e o gestor é o
 * próprio usuário. Escopo "todos": com qualquer pessoa ativa que tenha gestor.
 */
export async function agendarReuniao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "criar");
    const colaboradorId = z.string().uuid("Selecione a pessoa.").parse(fd.get("colaboradorId"));
    const quando = z.string().trim().min(16, "Informe data e hora.").parse(fd.get("dataHora"));
    const dataHora = instanteNoFuso(quando.slice(0, 16));
    const modeloId = String(fd.get("modeloId") ?? "") || null;
    const pautaLivre = linhas(fd.get("pauta"));
    id = await transacao(escopoTx(ctx), async (tx) => {
      const pessoa = await tx.colaborador.findUnique({ where: { id: colaboradorId } });
      if (!pessoa) throw new ErroAcesso("Pessoa não encontrada.");
      if (pessoa.status !== "ativo") throw new ErroAcesso("1:1 é para pessoas ativas (conclua o onboarding antes).");
      if (!pessoa.gestorId) throw new ErroAcesso("Defina o gestor desta pessoa no cadastro antes de agendar.");
      if (escopo !== "todos" && pessoa.gestorId !== ctx.colaboradorId) throw new ErroAcesso("Você só agenda 1:1 com seus liderados diretos.");
      let pauta = pautaLivre;
      let modeloNome: string | null = null;
      if (modeloId) {
        const m = await tx.modeloPauta.findUnique({ where: { id: z.string().uuid().parse(modeloId) } });
        if (!m || !m.ativo) throw new ErroAcesso("Modelo de pauta não encontrado.");
        pauta = [...m.itens, ...pautaLivre];
        modeloNome = m.nome;
      }
      const r = await tx.reuniao.create({
        data: { tenantId: ctx.org.id, gestorId: pessoa.gestorId, colaboradorId, dataHora, pauta, modeloNome, criadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.reuniao.agendar", entidade: "reuniao", entidadeId: r.id });
      return r.id;
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/feedback");
  redirect(`/feedback/${id}`);
}

export async function alterarReuniao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "editar");
    const id = z.string().uuid().parse(fd.get("reuniaoId"));
    const acao = z.enum(["realizada", "cancelar", "reagendar", "reabrir", "pauta"]).parse(fd.get("acao"));
    const msg = await transacao(escopoTx(ctx), async (tx) => {
      const r = await reuniaoVisivel(tx, ctx, id);
      if (!podeEditarReuniao(ctx, escopo, r)) throw new ErroAcesso("Somente o gestor da reunião pode alterá-la.");
      if (acao === "realizada") {
        if (r.status !== "agendada") throw new ErroAcesso("A reunião não está agendada.");
        await tx.reuniao.update({ where: { id }, data: { status: "realizada", realizadaEm: new Date() } });
      } else if (acao === "cancelar") {
        if (r.status !== "agendada") throw new ErroAcesso("A reunião não está agendada.");
        const motivo = z.string().trim().min(3, "Informe o motivo do cancelamento.").parse(fd.get("motivo"));
        await tx.reuniao.update({ where: { id }, data: { status: "cancelada", canceladaMotivo: motivo } });
      } else if (acao === "reagendar") {
        if (r.status !== "agendada") throw new ErroAcesso("A reunião não está agendada.");
        const d = instanteNoFuso(z.string().trim().min(16, "Informe data e hora.").parse(fd.get("dataHora")).slice(0, 16));
        await tx.reuniao.update({ where: { id }, data: { dataHora: d } });
      } else if (acao === "reabrir") {
        if (r.status === "agendada") throw new ErroAcesso("A reunião já está agendada.");
        await tx.reuniao.update({ where: { id }, data: { status: "agendada", realizadaEm: null, canceladaMotivo: null } });
      } else {
        await tx.reuniao.update({ where: { id }, data: { pauta: linhas(fd.get("pauta")) } });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: `feedback.reuniao.${acao}`, entidade: "reuniao", entidadeId: id });
      return { realizada: "Reunião marcada como realizada.", cancelar: "Reunião cancelada.", reagendar: "Reunião reagendada.", reabrir: "Reunião reaberta.", pauta: "Pauta atualizada." }[acao];
    });
    revalidatePath(`/feedback/${id}`);
    revalidatePath("/feedback");
    return { ok: msg };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Anotações (só participantes — reforçado pela policy do banco) ────────

export async function salvarAnotacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirPermissaoAcao("feedback", "visualizar");
    if (ctx.suporte) throw new ErroAcesso("Acesso de suporte é somente leitura.");
    const reuniaoId = z.string().uuid().parse(fd.get("reuniaoId"));
    const anotacaoId = String(fd.get("anotacaoId") ?? "") || null;
    const visibilidade = z.enum(["compartilhada", "privada"], { message: "Escolha a visibilidade." }).parse(fd.get("visibilidade"));
    const conteudo = z.string().trim().min(2, "Escreva a anotação.").max(10_000, "Anotação muito longa.").parse(fd.get("texto"));
    await transacao(escopoTx(ctx), async (tx) => {
      const r = await reuniaoVisivel(tx, ctx, reuniaoId);
      if (!participa(ctx, r)) throw new ErroAcesso("Somente os participantes do 1:1 fazem anotações.");
      if (anotacaoId) {
        const a = await tx.anotacaoReuniao.findFirst({ where: { id: z.string().uuid().parse(anotacaoId), reuniaoId, autorUsuarioId: ctx.usuario.id } });
        if (!a) throw new ErroAcesso("Anotação não encontrada.");
        await tx.anotacaoReuniao.update({ where: { id: a.id }, data: { texto: conteudo, visibilidade } });
      } else {
        await tx.anotacaoReuniao.create({
          data: { tenantId: ctx.org.id, reuniaoId, autorUsuarioId: ctx.usuario.id, autorNome: ctx.usuario.nome, visibilidade, texto: conteudo },
        });
      }
      // Auditoria registra o fato, nunca o conteúdo.
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: anotacaoId ? "feedback.anotacao.editar" : "feedback.anotacao.criar", entidade: "reuniao", entidadeId: reuniaoId, detalhes: { visibilidade } });
    });
    revalidatePath(`/feedback/${reuniaoId}`);
    return { ok: "Anotação salva." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function excluirAnotacao(anotacaoId: string) {
  const { ctx } = await exigirPermissaoAcao("feedback", "visualizar");
  if (ctx.suporte) throw new ErroAcesso("Acesso de suporte é somente leitura.");
  const reuniaoId = await transacao(escopoTx(ctx), async (tx) => {
    const a = await tx.anotacaoReuniao.findFirst({ where: { id: anotacaoId, autorUsuarioId: ctx.usuario.id } });
    if (!a) throw new ErroAcesso("Anotação não encontrada.");
    await tx.anotacaoReuniao.delete({ where: { id: a.id } });
    await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.anotacao.excluir", entidade: "reuniao", entidadeId: a.reuniaoId });
    return a.reuniaoId;
  });
  revalidatePath(`/feedback/${reuniaoId}`);
}

// ─── Compromissos ─────────────────────────────────────────────────────────

export async function adicionarCompromisso(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "editar");
    const reuniaoId = z.string().uuid().parse(fd.get("reuniaoId"));
    const descricao = z.string().trim().min(3, "Descreva o compromisso.").max(500).parse(fd.get("descricao"));
    const responsavelId = z.string().uuid("Escolha o responsável.").parse(fd.get("responsavelId"));
    const prazoTxt = String(fd.get("prazo") ?? "");
    await transacao(escopoTx(ctx), async (tx) => {
      const r = await reuniaoVisivel(tx, ctx, reuniaoId);
      if (!podeEditarReuniao(ctx, escopo, r)) throw new ErroAcesso("Somente o gestor da reunião registra compromissos.");
      if (r.status === "cancelada") throw new ErroAcesso("Reunião cancelada.");
      if (![r.gestorId, r.colaboradorId].includes(responsavelId)) throw new ErroAcesso("O responsável deve ser um dos participantes.");
      const c = await tx.compromisso.create({
        data: { tenantId: ctx.org.id, reuniaoId, responsavelId, descricao, prazo: prazoTxt ? new Date(`${prazoTxt}T12:00:00`) : null, criadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.compromisso.criar", entidade: "compromisso", entidadeId: c.id });
    });
    revalidatePath(`/feedback/${reuniaoId}`);
    return { ok: "Compromisso registrado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarCompromisso(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const acao = z.enum(["concluir", "cancelar", "reabrir"]).parse(fd.get("acao"));
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", acao === "concluir" ? "concluir" : "editar");
    const id = z.string().uuid().parse(fd.get("compromissoId"));
    const reuniaoId = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.compromisso.findUnique({ where: { id } });
      if (!c) throw new ErroAcesso("Compromisso não encontrado.");
      const r = await reuniaoVisivel(tx, ctx, c.reuniaoId);
      if (acao === "concluir") {
        if (!podeConcluirCompromisso(ctx, escopo, c, r)) throw new ErroAcesso("Este compromisso é de outra pessoa.");
        if (c.status !== "aberto") throw new ErroAcesso("O compromisso não está aberto.");
        await tx.compromisso.update({ where: { id }, data: { status: "concluido", concluidoEm: new Date(), concluidoPor: ctx.usuario.nome } });
      } else {
        if (!podeEditarReuniao(ctx, escopo, r)) throw new ErroAcesso("Somente o gestor da reunião altera compromissos.");
        await tx.compromisso.update({
          where: { id },
          data: acao === "cancelar" ? { status: "cancelado" } : { status: "aberto", concluidoEm: null, concluidoPor: null },
        });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: `feedback.compromisso.${acao}`, entidade: "compromisso", entidadeId: id });
      return c.reuniaoId;
    });
    revalidatePath(`/feedback/${reuniaoId}`);
    revalidatePath("/feedback/compromissos");
    revalidatePath("/inicio");
    return { ok: acao === "concluir" ? "Compromisso concluído." : acao === "cancelar" ? "Compromisso cancelado." : "Compromisso reaberto." };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Integração Feedback → PDI: transforma o compromisso em ação do PDI aberto
 * do responsável. Exige PDI contratado e permissão de editar o PDI da pessoa.
 */
export async function levarAoPdi(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirPermissaoAcao("feedback", "editar");
    const escopoPdi = pode(ctx, "pdi", "editar");
    if (!ctx.modulos.has("pdi") || !escopoPdi) throw new ErroAcesso("O PDI não está disponível para você.");
    const id = z.string().uuid().parse(fd.get("compromissoId"));
    const objetivoSel = z.string().min(1, "Escolha o objetivo.").parse(fd.get("objetivoId"));
    const reuniaoId = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.compromisso.findUnique({ where: { id }, include: { responsavel: true, acaoPdi: true } });
      if (!c) throw new ErroAcesso("Compromisso não encontrado.");
      const r = await reuniaoVisivel(tx, ctx, c.reuniaoId);
      if (!podeEditarReuniao(ctx, pode(ctx, "feedback", "editar"), r)) throw new ErroAcesso("Somente o gestor da reunião leva compromissos ao PDI.");
      if (c.acaoPdi) throw new ErroAcesso("Este compromisso já está no PDI.");
      if (!escopoCobre(ctx, escopoPdi, c.responsavel)) throw new ErroAcesso("Você não pode editar o PDI desta pessoa.");
      const pdi = await tx.pdi.findFirst({ where: { colaboradorId: c.responsavelId, status: { in: [...PDI_ABERTO] } } });
      if (!pdi) throw new ErroAcesso("A pessoa não tem PDI em rascunho ou ativo. Crie o PDI primeiro.");
      let objetivoId = objetivoSel;
      if (objetivoSel === "novo") {
        const ordem = await tx.objetivoPdi.count({ where: { pdiId: pdi.id } });
        const o = await tx.objetivoPdi.create({ data: { tenantId: ctx.org.id, pdiId: pdi.id, titulo: "Compromissos de 1:1", ordem } });
        objetivoId = o.id;
      } else if (!(await tx.objetivoPdi.findFirst({ where: { id: z.string().uuid().parse(objetivoSel), pdiId: pdi.id } }))) {
        throw new ErroAcesso("Objetivo não encontrado neste PDI.");
      }
      await tx.acaoPdi.create({
        data: { tenantId: ctx.org.id, pdiId: pdi.id, objetivoId, titulo: c.descricao, prazo: c.prazo, compromissoOrigemId: c.id, criadoPor: ctx.usuario.nome },
      });
      await tx.registroPdi.create({ data: { tenantId: ctx.org.id, pdiId: pdi.id, tipo: "evento", texto: `Ação criada a partir de compromisso de 1:1: “${c.descricao}”.`, autorNome: ctx.usuario.nome } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.compromisso.levar_pdi", entidade: "compromisso", entidadeId: id, detalhes: { pdiId: pdi.id } });
      return c.reuniaoId;
    });
    revalidatePath(`/feedback/${reuniaoId}`);
    return { ok: "Compromisso incluído no PDI." };
  } catch (e) {
    return erroDe(e);
  }
}
