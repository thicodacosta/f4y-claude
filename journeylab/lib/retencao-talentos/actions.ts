"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto } from "@/lib/datas";
import { CHAVES_MOTIVO, type Motivo } from "@/lib/offboarding/motivos";
import type { Escopo } from "@/lib/permissoes";

export type RespostaRetencao = { ok?: string; erro?: string; id?: string };

function erroDe(e: unknown): RespostaRetencao {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  return { erro: msg && !/prisma|invocation/i.test(msg) ? msg : "Não foi possível concluir. Tente novamente." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const uuidOpc = z
  .string()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .pipe(z.string().uuid().nullable());

const acaoSchema = z
  .object({
    id: uuidOpc,
    titulo: z.string().trim().min(3, "Descreva a ação em poucas palavras.").max(160),
    descricao: z
      .string()
      .trim()
      .max(3000)
      .optional()
      .nullable()
      .transform((v) => v || null),
    categoria: z.enum(CHAVES_MOTIVO as [Motivo, ...Motivo[]], { message: "Escolha o fator de saída tratado." }),
    alcance: z.enum(["individual", "equipe", "organizacao"]),
    colaboradorId: uuidOpc,
    equipeId: uuidOpc,
    responsavelId: uuidOpc,
    prazo: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? dataDeTexto(v) : null)),
    origem: z.enum(["manual", "risco", "offboarding", "analytics"]).default("manual"),
  })
  .superRefine((d, c) => {
    if (d.alcance === "individual" && !d.colaboradorId) c.addIssue({ code: "custom", message: "Escolha a pessoa da ação individual.", path: ["colaboradorId"] });
    if (d.alcance === "equipe" && !d.equipeId) c.addIssue({ code: "custom", message: "Escolha a equipe.", path: ["equipeId"] });
  });

/**
 * Gestor (escopo "equipe"): só ações individuais de liderados diretos ou da equipe
 * que lidera. RH/Admin ("todos"): qualquer alcance.
 */
async function conferirAlcance(tx: Tx, ctx: Contexto, escopo: Escopo, d: { alcance: string; colaboradorId: string | null; equipeId: string | null }) {
  const eu = ctx.colaboradorId;
  if (d.colaboradorId) {
    const c = await tx.colaborador.findUnique({ where: { id: d.colaboradorId }, select: { gestorId: true, status: true } });
    if (!c) throw new ErroAcesso("Pessoa não encontrada.");
    if (escopo !== "todos" && (!eu || c.gestorId !== eu)) throw new ErroAcesso("Você só pode criar ações para seus liderados diretos.");
  }
  if (d.equipeId) {
    const e = await tx.equipe.findUnique({ where: { id: d.equipeId }, select: { gestorId: true } });
    if (!e) throw new ErroAcesso("Equipe não encontrada.");
    if (escopo !== "todos" && (!eu || e.gestorId !== eu)) throw new ErroAcesso("Você só pode criar ações para a equipe que lidera.");
  }
  if (d.alcance === "organizacao" && escopo !== "todos") throw new ErroAcesso("Ações para a organização inteira são de RH/Admin.");
}

/** Ação existente visível no escopo (gestor: ligada a liderado/equipe que lidera ou sob sua responsabilidade). */
async function acaoVisivel(tx: Tx, ctx: Contexto, escopo: Escopo, id: string) {
  const a = await tx.acaoRetencao.findUnique({ where: { id }, include: { colaborador: { select: { gestorId: true } }, equipe: { select: { gestorId: true } } } });
  if (!a) throw new ErroAcesso("Ação não encontrada.");
  if (escopo === "todos") return a;
  const eu = ctx.colaboradorId;
  const ok = !!eu && (a.colaborador?.gestorId === eu || a.equipe?.gestorId === eu || a.responsavelId === eu);
  if (!ok) throw new ErroAcesso("Ação não encontrada.");
  return a;
}

export async function salvarAcaoRetencao(dados: z.input<typeof acaoSchema>): Promise<RespostaRetencao> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("retencao", dados?.id ? "editar" : "criar");
    const d = acaoSchema.parse(dados);
    const alvo = {
      colaboradorId: d.alcance === "individual" ? d.colaboradorId : null,
      equipeId: d.alcance === "equipe" ? d.equipeId : null,
    };
    const id = await transacao(escopoTx(ctx), async (tx) => {
      await conferirAlcance(tx, ctx, escopo, { alcance: d.alcance, ...alvo });
      if (d.responsavelId && !(await tx.colaborador.findUnique({ where: { id: d.responsavelId } }))) throw new ErroAcesso("Responsável inválido.");
      const campos = { titulo: d.titulo, descricao: d.descricao, categoria: d.categoria, alcance: d.alcance, ...alvo, responsavelId: d.responsavelId, prazo: d.prazo };
      if (d.id) {
        await acaoVisivel(tx, ctx, escopo, d.id);
        await tx.acaoRetencao.update({ where: { id: d.id }, data: campos });
        await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "retencao.acao.editar", entidade: "acao_retencao", entidadeId: d.id });
        return d.id;
      }
      const a = await tx.acaoRetencao.create({
        data: { ...campos, tenantId: ctx.org.id, origem: d.origem, criadoPor: ctx.usuario.nome, criadoPorId: ctx.usuario.id },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "retencao.acao.criar", entidade: "acao_retencao", entidadeId: a.id, detalhes: { alcance: d.alcance, categoria: d.categoria } });
      return a.id;
    });
    revalidatePath("/retencao", "layout");
    return { ok: d.id ? "Ação atualizada." : "Ação de retenção criada.", id };
  } catch (e) {
    return erroDe(e);
  }
}

const STATUS = ["planejada", "em_andamento", "concluida", "cancelada"] as const;

export async function alterarStatusAcaoRetencao(id: string, status: (typeof STATUS)[number], resultado?: string): Promise<RespostaRetencao> {
  try {
    const s = z.enum(STATUS).parse(status);
    const { ctx, escopo } = await exigirPermissaoAcao("retencao", s === "concluida" ? "concluir" : "editar");
    const res = z.string().trim().max(2000).optional().parse(resultado) || null;
    if (s === "concluida" && !res) throw new ErroAcesso("Registre o resultado observado ao concluir a ação.");
    await transacao(escopoTx(ctx), async (tx) => {
      const a = await acaoVisivel(tx, ctx, escopo, z.string().uuid().parse(id));
      await tx.acaoRetencao.update({ where: { id: a.id }, data: { status: s, concluidaEm: s === "concluida" ? new Date() : null, ...(res ? { resultado: res } : {}) } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "retencao.acao.status", entidade: "acao_retencao", entidadeId: a.id, detalhes: { de: a.status, para: s } });
    });
    revalidatePath("/retencao", "layout");
    return { ok: s === "concluida" ? "Ação concluída." : "Situação atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}
