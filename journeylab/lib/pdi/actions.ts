"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, pode, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { escopoCobre } from "@/lib/escopo";
import type { Acao } from "@/lib/permissoes";
import { PDI_ABERTO } from "./regras";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Esta pessoa já tem um PDI em rascunho ou ativo." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const texto = z.string().trim().transform((v) => v || null);
const data = (msg: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, msg).transform((v) => new Date(`${v}T12:00:00`));
const dataOpcional = z
  .string()
  .trim()
  .transform((v) => (v ? new Date(`${v}T12:00:00`) : null));
const urlOpcional = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.string().url("Link inválido.").refine((u) => u.startsWith("https://"), "Use um link https://").nullable());
const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });

async function registro(tx: Tx, ctx: Contexto, pdiId: string, tipo: "comentario" | "revisao" | "evento", t: string) {
  await tx.registroPdi.create({ data: { tenantId: ctx.org.id, pdiId, tipo, texto: t, autorNome: ctx.usuario.nome } });
}

/** Carrega o PDI e confere se o escopo da ação cobre a pessoa dona do plano. */
async function pdiPermitido(tx: Tx, ctx: Contexto, pdiId: string, acao: Acao, escopo: ReturnType<typeof pode>) {
  const p = await tx.pdi.findUnique({ where: { id: pdiId }, include: { colaborador: true } });
  if (!p) throw new ErroAcesso("PDI não encontrado.");
  if (!escopoCobre(ctx, escopo, p.colaborador)) {
    throw new ErroAcesso(acao === "visualizar" ? "PDI não encontrado." : "Você não tem permissão para alterar este PDI.");
  }
  return p;
}

function exigirAberto(p: { status: string }) {
  if (!(PDI_ABERTO as readonly string[]).includes(p.status)) throw new ErroAcesso("O PDI está encerrado. Reabra-o para alterar.");
}

export async function criarPdi(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "criar");
    const colaboradorId = z.string().uuid("Selecione a pessoa.").parse(fd.get("colaboradorId"));
    const titulo = z.string().trim().min(3, "Informe o título do plano.").max(120).parse(fd.get("titulo"));
    const inicio = data("Informe o início.").parse(fd.get("inicio"));
    const fim = data("Informe o fim.").parse(fd.get("fim"));
    if (fim <= inicio) throw new ErroAcesso("O fim deve ser depois do início.");
    id = await transacao(escopoTx(ctx), async (tx) => {
      const pessoa = await tx.colaborador.findUnique({ where: { id: colaboradorId } });
      if (!pessoa || !escopoCobre(ctx, escopo, pessoa)) throw new ErroAcesso("Você não pode criar PDI para esta pessoa.");
      if (pessoa.status !== "ativo") throw new ErroAcesso("PDI é para pessoas ativas (conclua o onboarding antes).");
      const p = await tx.pdi.create({ data: { tenantId: ctx.org.id, colaboradorId, titulo, inicio, fim, criadoPor: ctx.usuario.nome } });
      await registro(tx, ctx, p.id, "evento", "PDI criado em rascunho.");
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pdi.criar", entidade: "pdi", entidadeId: p.id });
      return p.id;
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/pdi");
  redirect(`/pdi/${id}`);
}

export async function editarPdi(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "editar");
    const id = z.string().uuid().parse(fd.get("pdiId"));
    const titulo = z.string().trim().min(3, "Informe o título do plano.").max(120).parse(fd.get("titulo"));
    const inicio = data("Informe o início.").parse(fd.get("inicio"));
    const fim = data("Informe o fim.").parse(fd.get("fim"));
    if (fim <= inicio) throw new ErroAcesso("O fim deve ser depois do início.");
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await pdiPermitido(tx, ctx, id, "editar", escopo);
      exigirAberto(p);
      await tx.pdi.update({ where: { id }, data: { titulo, inicio, fim } });
    });
    revalidatePath(`/pdi/${id}`);
    return { ok: "PDI atualizado." };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Ciclo de vida: rascunho → ativo → concluído; arquivar a qualquer momento;
 * reabrir concluído/arquivado. Exige "concluir" (gestor/RH/admin conforme papel).
 */
export async function alterarStatusPdi(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "concluir");
    const id = z.string().uuid().parse(fd.get("pdiId"));
    const acao = z.enum(["ativar", "concluir", "arquivar", "reabrir"]).parse(fd.get("acao"));
    const msg = await transacao(escopoTx(ctx), async (tx) => {
      const p = await pdiPermitido(tx, ctx, id, "concluir", escopo);
      if (acao === "ativar") {
        if (p.status !== "rascunho") throw new ErroAcesso("Só um rascunho pode ser ativado.");
        const acoes = await tx.acaoPdi.count({ where: { pdiId: id, status: { not: "cancelada" } } });
        if (!acoes) throw new ErroAcesso("Inclua ao menos um objetivo com uma ação antes de ativar.");
        await tx.pdi.update({ where: { id }, data: { status: "ativo" } });
      } else if (acao === "concluir") {
        if (p.status !== "ativo") throw new ErroAcesso("Só um PDI ativo pode ser concluído.");
        await tx.pdi.update({ where: { id }, data: { status: "concluido", concluidoEm: new Date() } });
      } else if (acao === "arquivar") {
        if (p.status === "arquivado") throw new ErroAcesso("O PDI já está arquivado.");
        await tx.pdi.update({ where: { id }, data: { status: "arquivado" } });
      } else {
        if ((PDI_ABERTO as readonly string[]).includes(p.status)) throw new ErroAcesso("O PDI já está aberto.");
        await tx.pdi.update({ where: { id }, data: { status: "ativo", concluidoEm: null } });
      }
      const t = { ativar: "PDI ativado.", concluir: "PDI concluído.", arquivar: "PDI arquivado.", reabrir: "PDI reaberto." }[acao];
      await registro(tx, ctx, id, "evento", t);
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: `pdi.${acao}`, entidade: "pdi", entidadeId: id });
      return t;
    });
    revalidatePath(`/pdi/${id}`);
    revalidatePath("/pdi");
    return { ok: msg };
  } catch (e) {
    return erroDe(e);
  }
}

export async function adicionarObjetivo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "editar");
    const pdiId = z.string().uuid().parse(fd.get("pdiId"));
    const titulo = z.string().trim().min(3, "Informe o objetivo.").max(200).parse(fd.get("titulo"));
    const competencia = texto.parse(fd.get("competencia") ?? "");
    const descricao = texto.parse(fd.get("descricao") ?? "");
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await pdiPermitido(tx, ctx, pdiId, "editar", escopo);
      exigirAberto(p);
      const ordem = await tx.objetivoPdi.count({ where: { pdiId } });
      await tx.objetivoPdi.create({ data: { tenantId: ctx.org.id, pdiId, titulo, competencia, descricao, ordem } });
      await registro(tx, ctx, pdiId, "evento", `Objetivo incluído: “${titulo}”.`);
    });
    revalidatePath(`/pdi/${pdiId}`);
    return { ok: "Objetivo incluído." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarObjetivo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "editar");
    const id = z.string().uuid().parse(fd.get("objetivoId"));
    const status = z.enum(["em_andamento", "concluido", "cancelado"]).parse(fd.get("status"));
    const pdiId = await transacao(escopoTx(ctx), async (tx) => {
      const o = await tx.objetivoPdi.findUnique({ where: { id } });
      if (!o) throw new ErroAcesso("Objetivo não encontrado.");
      const p = await pdiPermitido(tx, ctx, o.pdiId, "editar", escopo);
      exigirAberto(p);
      await tx.objetivoPdi.update({ where: { id }, data: { status } });
      await registro(tx, ctx, o.pdiId, "evento", `Objetivo “${o.titulo}” marcado como ${status === "concluido" ? "concluído" : status === "cancelado" ? "cancelado" : "em andamento"}.`);
      return o.pdiId;
    });
    revalidatePath(`/pdi/${pdiId}`);
    return { ok: "Objetivo atualizado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function adicionarAcao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "editar");
    const objetivoId = z.string().uuid().parse(fd.get("objetivoId"));
    const titulo = z.string().trim().min(3, "Descreva a ação.").max(300).parse(fd.get("titulo"));
    const tipo = z.enum(["pratica", "curso", "mentoria", "leitura", "projeto", "outro"]).parse(fd.get("tipo"));
    const prazo = dataOpcional.parse(fd.get("prazo") ?? "");
    const pdiId = await transacao(escopoTx(ctx), async (tx) => {
      const o = await tx.objetivoPdi.findUnique({ where: { id: objetivoId } });
      if (!o) throw new ErroAcesso("Objetivo não encontrado.");
      const p = await pdiPermitido(tx, ctx, o.pdiId, "editar", escopo);
      exigirAberto(p);
      await tx.acaoPdi.create({ data: { tenantId: ctx.org.id, pdiId: o.pdiId, objetivoId, titulo, tipo, prazo, criadoPor: ctx.usuario.nome } });
      return o.pdiId;
    });
    revalidatePath(`/pdi/${pdiId}`);
    return { ok: "Ação incluída." };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Progresso de uma ação. Concluir exige evidência (texto ou link). Se a ação
 * veio de um compromisso de 1:1, o compromisso é concluído junto.
 */
export async function alterarAcao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", "editar");
    const id = z.string().uuid().parse(fd.get("acaoId"));
    const status = z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).parse(fd.get("status"));
    const evidencia = texto.parse(fd.get("evidencia") ?? "");
    const evidenciaUrl = urlOpcional.parse(fd.get("evidenciaUrl") ?? "");
    const pdiId = await transacao(escopoTx(ctx), async (tx) => {
      const a = await tx.acaoPdi.findUnique({ where: { id } });
      if (!a) throw new ErroAcesso("Ação não encontrada.");
      const p = await pdiPermitido(tx, ctx, a.pdiId, "editar", escopo);
      exigirAberto(p);
      const ev = evidencia ?? a.evidencia;
      const evUrl = evidenciaUrl ?? a.evidenciaUrl;
      if (status === "concluida" && !ev && !evUrl) throw new ErroAcesso("Para concluir, registre uma evidência (descrição ou link).");
      await tx.acaoPdi.update({
        where: { id },
        data: { status, evidencia: ev, evidenciaUrl: evUrl, concluidaEm: status === "concluida" ? (a.concluidaEm ?? new Date()) : null },
      });
      if (status !== a.status) await registro(tx, ctx, a.pdiId, "evento", `Ação “${a.titulo}”: ${status.replace("_", " ")}.`);
      if (status === "concluida" && a.compromissoOrigemId) {
        await tx.compromisso.updateMany({
          where: { id: a.compromissoOrigemId, status: "aberto" },
          data: { status: "concluido", concluidoEm: new Date(), concluidoPor: `${ctx.usuario.nome} (via PDI)` },
        });
      }
      return a.pdiId;
    });
    revalidatePath(`/pdi/${pdiId}`);
    revalidatePath("/inicio");
    return { ok: "Ação atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Comentário (quem vê o PDI) ou revisão formal (quem edita com escopo de equipe/todos). */
export async function registrarNoPdi(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const tipo = z.enum(["comentario", "revisao"]).parse(fd.get("tipo"));
    const { ctx, escopo } = await exigirPermissaoAcao("pdi", tipo === "revisao" ? "editar" : "visualizar");
    if (ctx.suporte) throw new ErroAcesso("Acesso de suporte é somente leitura.");
    if (tipo === "revisao" && escopo === "proprio") throw new ErroAcesso("Revisões são registradas pelo gestor ou pelo RH.");
    const pdiId = z.string().uuid().parse(fd.get("pdiId"));
    const conteudo = z.string().trim().min(2, "Escreva o texto.").max(5000).parse(fd.get("texto"));
    await transacao(escopoTx(ctx), async (tx) => {
      await pdiPermitido(tx, ctx, pdiId, tipo === "revisao" ? "editar" : "visualizar", escopo);
      await registro(tx, ctx, pdiId, tipo, conteudo);
    });
    revalidatePath(`/pdi/${pdiId}`);
    return { ok: tipo === "revisao" ? "Revisão registrada." : "Comentário registrado." };
  } catch (e) {
    return erroDe(e);
  }
}
