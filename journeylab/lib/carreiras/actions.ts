"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { emailValido } from "@/lib/email";
import { filtroVagas } from "@/lib/crm/consultas";
import { enviarAvisoCandidatura } from "./notificacao";
import { MODALIDADE, slugificar, TIPO_CONTRATACAO } from "./regras";

export type RespostaVaga = { ok?: string; erro?: string; id?: string };

function erroDe(e: unknown): RespostaVaga {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  if (doBanco) return { erro: doBanco[1].trim() };
  return { erro: msg && !/prisma|invocation/i.test(msg) ? msg : "Não foi possível concluir. Tente novamente." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const uuid = z.string().uuid();
const opc = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

const vagaSchema = z.object({
  id: uuid.optional().nullable(),
  titulo: z.string().trim().min(3, "Informe o título da vaga.").max(120),
  descricao: opc(8000),
  requisitos: opc(5000),
  local: opc(120),
  modelo: z.enum(Object.keys(MODALIDADE) as [string, ...string[]]).nullable().optional().or(z.literal("").transform(() => null)),
  tipoContratacao: z.enum(Object.keys(TIPO_CONTRATACAO) as [string, ...string[]]).nullable().optional().or(z.literal("").transform(() => null)),
  equipeId: uuid.nullable().optional().or(z.literal("").transform(() => null)),
  gestorId: uuid.nullable().optional().or(z.literal("").transform(() => null)),
});

/** Vaga visível ao usuário (organização pela RLS + escopo do papel). */
async function vagaPermitida(tx: Tx, ctx: Contexto, id: string, escopo: Parameters<typeof filtroVagas>[1]) {
  const v = await tx.vaga.findFirst({ where: { AND: [{ id: uuid.parse(id) }, filtroVagas(ctx, escopo)] } });
  if (!v) throw new ErroAcesso("Vaga não encontrada.");
  return v;
}

/** Cria ou edita a vaga. O criador (usuário e e-mail) é registrado na criação; o slug não muda depois. */
export async function salvarVagaCarreiras(dados: z.input<typeof vagaSchema>): Promise<RespostaVaga> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", dados?.id ? "editar" : "criar");
    const d = vagaSchema.parse(dados);
    const campos = { titulo: d.titulo, descricao: d.descricao, requisitos: d.requisitos, local: d.local, modelo: d.modelo ?? null, tipoContratacao: d.tipoContratacao ?? null, equipeId: d.equipeId ?? null, gestorId: d.gestorId ?? null };
    const id = await transacao(escopoTx(ctx), async (tx) => {
      if (campos.equipeId && !(await tx.equipe.findUnique({ where: { id: campos.equipeId } }))) throw new ErroAcesso("Equipe inválida.");
      if (campos.gestorId && !(await tx.colaborador.findUnique({ where: { id: campos.gestorId } }))) throw new ErroAcesso("Gestor inválido.");
      if (d.id) {
        await vagaPermitida(tx, ctx, d.id, escopo);
        await tx.vaga.update({ where: { id: d.id }, data: campos });
        await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "carreiras.vaga.editar", entidade: "vaga", entidadeId: d.id });
        return d.id;
      }
      const slug = `${slugificar(d.titulo) || "vaga"}-${randomBytes(3).toString("hex")}`;
      const v = await tx.vaga.create({
        data: { ...campos, tenantId: ctx.org.id, slug, criadoPor: ctx.usuario.nome, criadoPorUsuarioId: ctx.usuario.id, emailNotificacao: ctx.usuario.email, publicada: false },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "carreiras.vaga.criar", entidade: "vaga", entidadeId: v.id });
      return v.id;
    });
    revalidatePath("/pagina-carreiras");
    return { ok: d.id ? "Vaga atualizada." : "Vaga criada como não publicada.", id };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Publica. Exige confirmação do e-mail de notificação do criador (válido). Vagas
 * antigas sem criador registrado precisam primeiro "assumir as notificações".
 */
export async function publicarVaga(id: string, emailConfirmado: string): Promise<RespostaVaga> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    await transacao(escopoTx(ctx), async (tx) => {
      const v = await vagaPermitida(tx, ctx, id, escopo);
      if (v.status === "fechada" || v.status === "cancelada") throw new ErroAcesso("Vaga encerrada não pode ser publicada. Reabra-a antes.");
      if (!v.emailNotificacao || !emailValido(v.emailNotificacao) || !v.criadoPorUsuarioId)
        throw new ErroAcesso("A vaga não tem um e-mail válido do criador para receber as candidaturas. Configure o responsável pelas notificações antes de publicar.");
      if (emailConfirmado.trim().toLowerCase() !== v.emailNotificacao.toLowerCase()) throw new ErroAcesso("Confirme o e-mail de notificação exibido antes de publicar.");
      await tx.vaga.update({ where: { id: v.id }, data: { publicada: true, publicadaEm: v.publicadaEm ?? new Date(), emailConfirmadoEm: new Date(), status: "aberta" } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "carreiras.vaga.publicar", entidade: "vaga", entidadeId: v.id, detalhes: { emailNotificacao: v.emailNotificacao } });
    });
    revalidatePath("/pagina-carreiras");
    revalidatePath(`/pagina-carreiras/vagas/${id}`);
    return { ok: "Vaga publicada na Página de Carreiras." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Vaga antiga (ou de criador que saiu): o usuário atual passa a receber os avisos, com o próprio e-mail. */
export async function assumirNotificacoes(id: string): Promise<RespostaVaga> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    if (!emailValido(ctx.usuario.email)) throw new ErroAcesso("Sua conta não tem um e-mail válido.");
    await transacao(escopoTx(ctx), async (tx) => {
      const v = await vagaPermitida(tx, ctx, id, escopo);
      await tx.vaga.update({ where: { id: v.id }, data: { criadoPorUsuarioId: ctx.usuario.id, emailNotificacao: ctx.usuario.email, emailConfirmadoEm: null, publicada: false } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "carreiras.vaga.assumir_notificacoes", entidade: "vaga", entidadeId: v.id, detalhes: { antes: v.emailNotificacao } });
    });
    revalidatePath(`/pagina-carreiras/vagas/${id}`);
    return { ok: "Você passou a receber os avisos desta vaga. Confira o e-mail e publique novamente." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function despublicarVaga(id: string): Promise<RespostaVaga> {
  return alterar(id, "carreiras.vaga.despublicar", { publicada: false }, "Vaga retirada da Página de Carreiras. Ela não recebe novas candidaturas.");
}

export async function encerrarVaga(id: string): Promise<RespostaVaga> {
  return alterar(id, "carreiras.vaga.encerrar", { publicada: false, status: "fechada", fechadaEm: new Date() }, "Vaga encerrada. Candidaturas e histórico foram mantidos.");
}

export async function reabrirVaga(id: string): Promise<RespostaVaga> {
  return alterar(id, "carreiras.vaga.reabrir", { status: "aberta", fechadaEm: null }, "Vaga reaberta (ainda não publicada).");
}

async function alterar(id: string, acao: string, data: { publicada?: boolean; status?: "aberta" | "fechada"; fechadaEm?: Date | null }, ok: string): Promise<RespostaVaga> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    await transacao(escopoTx(ctx), async (tx) => {
      const v = await vagaPermitida(tx, ctx, id, escopo);
      await tx.vaga.update({ where: { id: v.id }, data });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao, entidade: "vaga", entidadeId: v.id });
    });
    revalidatePath("/pagina-carreiras");
    revalidatePath(`/pagina-carreiras/vagas/${id}`);
    return { ok };
  } catch (e) {
    return erroDe(e);
  }
}

/** Reenvia o aviso de uma candidatura ao criador da vaga (sem duplicar a candidatura). */
export async function reenviarAviso(candidaturaId: string): Promise<RespostaVaga> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const vagaId = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.candidatura.findFirst({ where: { id: uuid.parse(candidaturaId), vaga: filtroVagas(ctx, escopo) }, select: { id: true, vagaId: true, origem: true } });
      if (!c) throw new ErroAcesso("Candidatura não encontrada.");
      if (c.origem !== "carreiras") throw new ErroAcesso("Só candidaturas da Página de Carreiras geram aviso por e-mail.");
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "carreiras.aviso.reenviar", entidade: "candidatura", entidadeId: c.id });
      return c.vagaId;
    });
    const r = await enviarAvisoCandidatura(candidaturaId);
    revalidatePath(`/pagina-carreiras/vagas/${vagaId}`);
    return r.ok ? { ok: "Aviso reenviado ao criador da vaga." } : { erro: `O aviso não foi enviado: ${r.erro}` };
  } catch (e) {
    return erroDe(e);
  }
}
