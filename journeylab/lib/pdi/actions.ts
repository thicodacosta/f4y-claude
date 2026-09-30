"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, pode, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto } from "@/lib/datas";
import type { Acao } from "@/lib/permissoes";
import { CHAVES_FOCO, nomeFoco } from "./focos";
import { STATUS_ACAO } from "./calculo";
import { cobrePdi } from "./regras";

export type RespostaPdi = { ok?: string; erro?: string; id?: string };

function erroDe(e: unknown): RespostaPdi {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  if (/row-level security/i.test(msg)) return { erro: "Você não tem permissão para esta operação neste PDI." };
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  if (doBanco) return { erro: doBanco[1].trim() };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") return { erro: "Há focos repetidos neste PDI." };
  return { erro: msg && !/prisma|invocation/i.test(msg) ? msg : "Não foi possível concluir. Tente novamente." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const uuid = z.string().uuid();
const dataTxt = (msg: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

const acaoSchema = z.object({
  id: uuid.optional().nullable(),
  descricao: z.string().trim().min(3, "Descreva cada ação (mínimo 3 caracteres).").max(300),
  tipo: z.enum(["treinamento", "mentoria", "leitura", "projeto_pratico"], { message: "Escolha o tipo da ação." }),
  responsavel: z.enum(["colaborador", "gestor", "ambos"], { message: "Escolha o responsável pela ação." }),
  inicio: dataTxt("Início da ação inválido.").optional().nullable().or(z.literal("")),
  prazo: dataTxt("Informe o prazo de cada ação."),
  investimento: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v, c) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
        c.addIssue({ code: "custom", message: "Investimento estimado inválido." });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  impacto: opcional(500),
  mentor: opcional(120),
});

const focoSchema = z
  .object({
    id: uuid.optional().nullable(),
    chave: z.enum(CHAVES_FOCO, { message: "Foco inválido." }),
    nomePersonalizado: opcional(80),
    descricao: opcional(1000),
    importancia: opcional(1000),
    objetivo: opcional(1000),
    acoes: z.array(acaoSchema).max(30, "No máximo 30 ações por foco."),
  })
  .superRefine((f, c) => {
    if (f.chave === "outro" && (f.nomePersonalizado ?? "").length < 2) c.addIssue({ code: "custom", message: "Dê um nome ao foco “Outro”." });
  });

const pdiSchema = z
  .object({
    id: uuid.optional().nullable(),
    colaboradorId: uuid.or(z.literal("")).refine((v) => !!v, "Selecione o colaborador."),
    titulo: z.string().trim().min(3, "Informe o título do plano.").max(120),
    descricao: opcional(2000),
    inicio: dataTxt("Informe a data de início."),
    fim: dataTxt("Informe a data prevista de término."),
    origem: z.enum(["manual", "feedback", "onboarding"]).default("manual"),
    origemId: uuid.optional().nullable(),
    focos: z.array(focoSchema).min(1, "Escolha ao menos um foco de desenvolvimento.").max(10, "No máximo 10 focos."),
  })
  .superRefine((d, c) => {
    if (d.fim < d.inicio) c.addIssue({ code: "custom", message: "O término previsto deve ser igual ou posterior ao início." });
    const chaves = d.focos.filter((f) => f.chave !== "outro").map((f) => f.chave);
    if (new Set(chaves).size !== chaves.length) c.addIssue({ code: "custom", message: "Há focos repetidos no plano." });
    for (const f of d.focos)
      for (const a of f.acoes) if (a.inicio && a.inicio > a.prazo) c.addIssue({ code: "custom", message: `O prazo da ação “${a.descricao}” é anterior ao início.` });
  });

/** Pessoa e escopo conferidos no servidor (o banco repete a regra em jl_acesso_pdi). */
async function pessoaPermitida(tx: Tx, ctx: Contexto, colaboradorId: string, acao: Acao) {
  const pessoa = await tx.colaborador.findUnique({ where: { id: colaboradorId } });
  if (!pessoa || !cobrePdi(ctx, pode(ctx, "pdi", acao), pessoa)) throw new ErroAcesso("Você não pode gerir PDI desta pessoa.");
  return pessoa;
}

async function registro(tx: Tx, ctx: Contexto, pdiId: string, tipo: "comentario" | "revisao" | "evento", texto: string) {
  await tx.registroPdi.create({ data: { tenantId: ctx.org.id, pdiId, tipo, texto, autorNome: ctx.usuario.nome } });
}

/**
 * Cria ou edita o PDI completo (fluxo guiado). Na edição, focos e ações são
 * atualizados pelo id; os que saíram do formulário são removidos. Status e
 * progresso das ações existentes são preservados (mudam no detalhe).
 */
export async function salvarPdi(payload: string): Promise<RespostaPdi> {
  try {
    let bruto: { id?: unknown };
    try {
      bruto = JSON.parse(payload);
    } catch {
      throw new ErroAcesso("Dados do formulário inválidos.");
    }
    // Sessão, módulo e permissão antes de qualquer validação de conteúdo.
    const { ctx } = await exigirPermissaoAcao("pdi", bruto?.id ? "editar" : "criar");
    const d = pdiSchema.parse(bruto);
    const id = await transacao(escopoTx(ctx), async (tx) => {
      let pdiId = d.id ?? null;
      const cabecalho = { titulo: d.titulo, descricao: d.descricao, inicio: dataDeTexto(d.inicio), fim: dataDeTexto(d.fim) };
      if (pdiId) {
        const atual = await tx.pdi.findUnique({ where: { id: pdiId }, include: { focos: { include: { acoes: { select: { id: true } } } } } });
        if (!atual) throw new ErroAcesso("PDI não encontrado.");
        await pessoaPermitida(tx, ctx, atual.colaboradorId, "editar");
        if (atual.colaboradorId !== d.colaboradorId) throw new ErroAcesso("O colaborador de um PDI não pode ser trocado.");
        await tx.pdi.update({ where: { id: pdiId }, data: cabecalho });
        const focosMantidos = new Set(d.focos.map((f) => f.id).filter(Boolean));
        const acoesMantidas = new Set(d.focos.flatMap((f) => f.acoes.map((a) => a.id)).filter(Boolean));
        const idsFocos = new Set(atual.focos.map((f) => f.id));
        const idsAcoes = new Set(atual.focos.flatMap((f) => f.acoes.map((a) => a.id)));
        for (const f of d.focos) if (f.id && !idsFocos.has(f.id)) throw new ErroAcesso("Foco não pertence a este PDI.");
        for (const f of d.focos) for (const a of f.acoes) if (a.id && !idsAcoes.has(a.id)) throw new ErroAcesso("Ação não pertence a este PDI.");
        await tx.acaoPdi.deleteMany({ where: { pdiId, id: { notIn: [...acoesMantidas] as string[] } } });
        await tx.focoPdi.deleteMany({ where: { pdiId, id: { notIn: [...focosMantidos] as string[] } } });
      } else {
        const pessoa = await pessoaPermitida(tx, ctx, d.colaboradorId, "criar");
        if (pessoa.status !== "ativo") throw new ErroAcesso("PDI é para colaboradores ativos.");
        const p = await tx.pdi.create({ data: { ...cabecalho, tenantId: ctx.org.id, colaboradorId: d.colaboradorId, criadoPor: ctx.usuario.nome } });
        pdiId = p.id;
      }
      for (const [i, f] of d.focos.entries()) {
        const dadosFoco = { focoChave: f.chave, nomePersonalizado: f.chave === "outro" ? f.nomePersonalizado : null, descricao: f.descricao, importancia: f.importancia, objetivo: f.objetivo, ordem: i };
        const focoId = f.id
          ? (await tx.focoPdi.update({ where: { id: f.id }, data: dadosFoco })).id
          : (await tx.focoPdi.create({ data: { ...dadosFoco, tenantId: ctx.org.id, pdiId: pdiId! } })).id;
        for (const [j, a] of f.acoes.entries()) {
          const dadosAcao = {
            focoId,
            descricao: a.descricao,
            tipo: a.tipo,
            responsavel: a.responsavel,
            inicio: a.inicio ? dataDeTexto(a.inicio) : null,
            prazo: dataDeTexto(a.prazo),
            investimento: a.investimento,
            impacto: a.impacto,
            mentor: a.mentor,
            ordem: j,
          };
          if (a.id) await tx.acaoPdi.update({ where: { id: a.id }, data: dadosAcao });
          else await tx.acaoPdi.create({ data: { ...dadosAcao, tenantId: ctx.org.id, pdiId: pdiId!, criadoPor: ctx.usuario.nome } });
        }
      }
      const origem = d.origem === "feedback" ? " a partir de um feedback 1:1" : d.origem === "onboarding" ? " a partir do onboarding" : "";
      await registro(tx, ctx, pdiId!, "evento", d.id ? "Plano editado." : `PDI criado${origem} com ${d.focos.length} foco(s): ${d.focos.map((f) => nomeFoco(f.chave, f.nomePersonalizado)).join(", ")}.`);
      await auditar(tx, {
        tenantId: ctx.org.id,
        usuario: quem(ctx),
        acao: d.id ? "pdi.editar" : "pdi.criar",
        entidade: "pdi",
        entidadeId: pdiId!,
        detalhes: { focos: d.focos.length, acoes: d.focos.reduce((n, f) => n + f.acoes.length, 0), origem: d.origem, origemId: d.origemId ?? null },
      });
      return pdiId!;
    });
    revalidatePath("/pdi");
    revalidatePath(`/pdi/${id}`);
    return { ok: d.id ? "PDI atualizado." : "PDI criado.", id };
  } catch (e) {
    return erroDe(e);
  }
}

/** Excluir: RH/Admin (editar com escopo "todos"); o banco exige o mesmo. */
export async function excluirPdi(id: string): Promise<RespostaPdi> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "editar");
    if (escopo !== "todos") throw new ErroAcesso("Somente RH e administradores excluem PDIs.");
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pdi.findUnique({ where: { id: uuid.parse(id) }, include: { colaborador: { select: { nome: true } } } });
      if (!p) throw new ErroAcesso("PDI não encontrado.");
      await tx.pdi.delete({ where: { id } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pdi.excluir", entidade: "pdi", entidadeId: id, detalhes: { titulo: p.titulo, colaborador: p.colaborador.nome } });
    });
    revalidatePath("/pdi");
    return { ok: "PDI excluído." };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Atualiza status/progresso de uma ação. Progresso 100 conclui; 0 volta para
 * "não iniciada"; entre 1 e 99 fica "em andamento". Concluir = 100%.
 */
export async function atualizarAcao(acaoId: string, status: string, progresso: number | null): Promise<RespostaPdi> {
  try {
    const { ctx } = await exigirPermissaoAcao("pdi", "editar");
    let st = z.enum(["nao_iniciada", "em_andamento", "concluida"]).parse(status);
    let pr = progresso === null || progresso === undefined ? null : z.number().int("Progresso inválido.").min(0).max(100, "Progresso entre 0 e 100.").parse(progresso);
    if (pr === 100) st = "concluida";
    else if (pr === 0) st = "nao_iniciada";
    else if (pr !== null && st !== "em_andamento") st = "em_andamento";
    if (st !== "em_andamento") pr = null;
    const pdiId = await transacao(escopoTx(ctx), async (tx) => {
      const a = await tx.acaoPdi.findUnique({ where: { id: uuid.parse(acaoId) }, include: { pdi: { select: { colaboradorId: true } } } });
      if (!a) throw new ErroAcesso("Ação não encontrada.");
      await pessoaPermitida(tx, ctx, a.pdi.colaboradorId, "editar");
      await tx.acaoPdi.update({ where: { id: a.id }, data: { status: st, progresso: pr } });
      if (st !== a.status) await registro(tx, ctx, a.pdiId, "evento", `Ação “${a.descricao}”: ${STATUS_ACAO[st].nome.toLowerCase()}.`);
      if (st === "concluida" && a.compromissoOrigemId) {
        await tx.compromisso.updateMany({
          where: { id: a.compromissoOrigemId, status: "aberto" },
          data: { status: "concluido", concluidoEm: new Date(), concluidoPor: `${ctx.usuario.nome} (via PDI)` },
        });
      }
      return a.pdiId;
    });
    revalidatePath(`/pdi/${pdiId}`);
    revalidatePath("/pdi");
    revalidatePath("/inicio");
    return { ok: st === "concluida" ? "Ação concluída (100%)." : "Ação atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Comentário de RH/gestor numa ação — ou fala do colaborador registrada por quem acompanha. */
export async function comentarAcao(acaoId: string, tipo: string, texto: string): Promise<RespostaPdi> {
  try {
    const { ctx } = await exigirPermissaoAcao("pdi", "editar");
    const t = z.enum(["comentario", "fala_colaborador"]).parse(tipo);
    const conteudo = z.string().trim().min(2, "Escreva o comentário.").max(2000).parse(texto);
    const pdiId = await transacao(escopoTx(ctx), async (tx) => {
      const a = await tx.acaoPdi.findUnique({ where: { id: uuid.parse(acaoId) }, include: { pdi: { select: { colaboradorId: true } } } });
      if (!a) throw new ErroAcesso("Ação não encontrada.");
      await pessoaPermitida(tx, ctx, a.pdi.colaboradorId, "editar");
      await tx.comentarioAcaoPdi.create({ data: { tenantId: ctx.org.id, pdiId: a.pdiId, acaoId: a.id, tipo: t, texto: conteudo, autorUsuarioId: ctx.usuario.id, autorNome: ctx.usuario.nome } });
      return a.pdiId;
    });
    revalidatePath(`/pdi/${pdiId}`);
    return { ok: t === "fala_colaborador" ? "Fala do colaborador registrada." : "Comentário registrado." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Revisão do plano (histórico). */
export async function registrarRevisao(pdiId: string, texto: string): Promise<RespostaPdi> {
  try {
    const { ctx } = await exigirPermissaoAcao("pdi", "editar");
    const conteudo = z.string().trim().min(2, "Escreva a revisão.").max(5000).parse(texto);
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pdi.findUnique({ where: { id: uuid.parse(pdiId) } });
      if (!p) throw new ErroAcesso("PDI não encontrado.");
      await pessoaPermitida(tx, ctx, p.colaboradorId, "editar");
      await registro(tx, ctx, pdiId, "revisao", conteudo);
    });
    revalidatePath(`/pdi/${pdiId}`);
    return { ok: "Revisão registrada." };
  } catch (e) {
    return erroDe(e);
  }
}
