"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, getContexto, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { QUESTIONARIO_REFERENCIA } from "./regras";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  if (doBanco) return { erro: doBanco[1].trim() };
  return { erro: msg || "Não foi possível concluir." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const texto = z.string().trim().transform((v) => v || null);

/** NR-1 é restrito: toda gestão exige a ação com escopo "todos" (administração por padrão). */
async function exigirGestao(acao: "criar" | "editar" | "concluir") {
  const r = await exigirPermissaoAcao("nr1", acao);
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite gerenciar o Diagnóstico NR-1.");
  return r;
}

async function cicloEm(tx: Tx, id: string, status: "rascunho" | "encerrado") {
  const c = await tx.cicloNr1.findUnique({ where: { id } });
  if (!c) throw new ErroAcesso("Ciclo não encontrado.");
  if (c.status !== status) {
    throw new ErroAcesso(status === "rascunho" ? "Depois de aberto, o questionário não pode ser alterado." : "Riscos e ações são registrados após o encerramento do ciclo.");
  }
  return c;
}

export async function criarCiclo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx } = await exigirGestao("criar");
    const titulo = z.string().trim().min(3, "Informe o título.").max(120).parse(fd.get("titulo"));
    const referencia = fd.get("modelo") !== "branco";
    id = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.cicloNr1.create({ data: { tenantId: ctx.org.id, titulo, criadoPor: ctx.usuario.nome } });
      if (referencia) {
        let ordemQ = 0;
        for (const [ordem, d] of QUESTIONARIO_REFERENCIA.entries()) {
          const dim = await tx.dimensaoNr1.create({ data: { tenantId: ctx.org.id, cicloId: c.id, nome: d.nome, descricao: d.descricao, ordem } });
          await tx.perguntaNr1.createMany({
            data: d.perguntas.map(([t, invertida]) => ({ tenantId: ctx.org.id, cicloId: c.id, dimensaoId: dim.id, texto: t, invertida, ordem: ordemQ++ })),
          });
        }
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.ciclo.criar", entidade: "ciclo_nr1", entidadeId: c.id });
      return c.id;
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/nr1");
  redirect(`/nr1/${id}`);
}

export async function salvarCiclo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const id = z.string().uuid().parse(fd.get("cicloId"));
    const titulo = z.string().trim().min(3, "Informe o título.").max(120).parse(fd.get("titulo"));
    const descricao = texto.parse(fd.get("descricao") ?? "");
    const publicoTodos = fd.get("publico") !== "equipes";
    const equipeIds = publicoTodos ? [] : fd.getAll("equipeIds").map((v) => z.string().uuid().parse(v));
    if (!publicoTodos && !equipeIds.length) throw new ErroAcesso("Escolha ao menos uma equipe ou use toda a organização.");
    const fim = String(fd.get("encerraEm") ?? "");
    await transacao(escopoTx(ctx), async (tx) => {
      await cicloEm(tx, id, "rascunho");
      if (equipeIds.length && (await tx.equipe.count({ where: { id: { in: equipeIds } } })) !== equipeIds.length) throw new ErroAcesso("Equipe inválida.");
      await tx.cicloNr1.update({ where: { id }, data: { titulo, descricao, publicoTodos, equipeIds, encerraEm: fim ? new Date(`${fim}T12:00:00`) : null } });
    });
    revalidatePath(`/nr1/${id}`);
    return { ok: "Ciclo salvo." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function adicionarDimensao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const cicloId = z.string().uuid().parse(fd.get("cicloId"));
    const nome = z.string().trim().min(3, "Informe o nome da dimensão.").max(80).parse(fd.get("nome"));
    await transacao(escopoTx(ctx), async (tx) => {
      await cicloEm(tx, cicloId, "rascunho");
      const ordem = await tx.dimensaoNr1.count({ where: { cicloId } });
      await tx.dimensaoNr1.create({ data: { tenantId: ctx.org.id, cicloId, nome, ordem } });
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Dimensão incluída." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function adicionarPerguntaNr1(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const dimensaoId = z.string().uuid().parse(fd.get("dimensaoId"));
    const t = z.string().trim().min(5, "Escreva a pergunta.").max(300).parse(fd.get("texto"));
    const invertida = fd.get("invertida") === "on";
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const d = await tx.dimensaoNr1.findUnique({ where: { id: dimensaoId } });
      if (!d) throw new ErroAcesso("Dimensão não encontrada.");
      await cicloEm(tx, d.cicloId, "rascunho");
      const ordem = await tx.perguntaNr1.count({ where: { cicloId: d.cicloId } });
      if (ordem >= 60) throw new ErroAcesso("Limite de 60 perguntas por ciclo.");
      await tx.perguntaNr1.create({ data: { tenantId: ctx.org.id, cicloId: d.cicloId, dimensaoId, texto: t, invertida, ordem } });
      return d.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Pergunta incluída." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function excluirItemNr1(tipo: "dimensao" | "pergunta", id: string) {
  const { ctx } = await exigirGestao("editar");
  const cicloId = await transacao(escopoTx(ctx), async (tx) => {
    const item = tipo === "dimensao" ? await tx.dimensaoNr1.findUnique({ where: { id } }) : await tx.perguntaNr1.findUnique({ where: { id } });
    if (!item) throw new ErroAcesso("Item não encontrado.");
    await cicloEm(tx, item.cicloId, "rascunho");
    if (tipo === "dimensao") await tx.dimensaoNr1.delete({ where: { id } });
    else await tx.perguntaNr1.delete({ where: { id } });
    return item.cicloId;
  });
  revalidatePath(`/nr1/${cicloId}`);
}

export async function alterarStatusCiclo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const acao = z.enum(["abrir", "encerrar"]).parse(fd.get("acao"));
    const { ctx } = await exigirGestao(acao === "abrir" ? "editar" : "concluir");
    const id = z.string().uuid().parse(fd.get("cicloId"));
    await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.cicloNr1.findUnique({ where: { id }, include: { dimensoes: { include: { _count: { select: { perguntas: true } } } } } });
      if (!c) throw new ErroAcesso("Ciclo não encontrado.");
      if (acao === "abrir") {
        if (c.status !== "rascunho") throw new ErroAcesso("O ciclo já foi aberto.");
        if (!c.dimensoes.length || c.dimensoes.some((d) => d._count.perguntas === 0)) throw new ErroAcesso("Cada dimensão precisa de ao menos uma pergunta.");
        await tx.cicloNr1.update({ where: { id }, data: { status: "aberto", abertoEm: new Date() } });
      } else {
        if (c.status !== "aberto") throw new ErroAcesso("O ciclo não está aberto.");
        await tx.cicloNr1.update({ where: { id }, data: { status: "encerrado", encerradoEm: new Date() } });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: `nr1.ciclo.${acao}`, entidade: "ciclo_nr1", entidadeId: id });
    });
    revalidatePath(`/nr1/${id}`);
    revalidatePath("/nr1");
    return { ok: acao === "abrir" ? "Ciclo aberto para participação." : "Ciclo encerrado. Resultados liberados conforme o mínimo de respondentes." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function responderNr1(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const ctx = await getContexto();
    if (!ctx) throw new ErroAcesso("Sessão expirada.");
    if (!ctx.usuario.aceitouTermos) throw new ErroAcesso("Aceite os termos de uso para continuar.");
    if (ctx.suporte) throw new ErroAcesso("Acesso de suporte é somente leitura.");
    if (!ctx.modulos.has("nr1")) throw new ErroAcesso("O Diagnóstico NR-1 não está ativo para a sua organização.");
    const cicloId = z.string().uuid().parse(fd.get("cicloId"));
    const respostas: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      const m = k.match(/^q_([0-9a-f-]{36})$/);
      if (m && typeof v === "string") respostas[m[1]] = v.slice(0, 2);
    }
    await transacao(escopoTx(ctx), (tx) => tx.$executeRaw`select public.jl_responder_nr1(${cicloId}::uuid, ${JSON.stringify(respostas)}::jsonb)`);
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/inicio");
  redirect("/nr1?respondido=1");
}

// ─── Riscos e plano de ação (após o encerramento) ─────────────────────────

export async function registrarRisco(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const cicloId = z.string().uuid().parse(fd.get("cicloId"));
    const dimensaoId = String(fd.get("dimensaoId") ?? "") || null;
    const titulo = z.string().trim().min(3, "Descreva o fator de risco.").max(200).parse(fd.get("titulo"));
    const descricao = texto.parse(fd.get("descricao") ?? "");
    const prioridade = z.enum(["baixa", "media", "alta"]).parse(fd.get("prioridade"));
    await transacao(escopoTx(ctx), async (tx) => {
      await cicloEm(tx, cicloId, "encerrado");
      if (dimensaoId && !(await tx.dimensaoNr1.findFirst({ where: { id: z.string().uuid().parse(dimensaoId), cicloId } }))) throw new ErroAcesso("Dimensão inválida.");
      const r = await tx.riscoNr1.create({ data: { tenantId: ctx.org.id, cicloId, dimensaoId, titulo, descricao, prioridade, criadoPor: ctx.usuario.nome } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.risco.registrar", entidade: "risco_nr1", entidadeId: r.id });
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Fator de risco registrado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarRisco(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const id = z.string().uuid().parse(fd.get("riscoId"));
    const status = z.enum(["identificado", "em_tratamento", "monitorado", "encerrado"]).parse(fd.get("status"));
    const prioridade = z.enum(["baixa", "media", "alta"]).parse(fd.get("prioridade"));
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const r = await tx.riscoNr1.findUnique({ where: { id } });
      if (!r) throw new ErroAcesso("Risco não encontrado.");
      await tx.riscoNr1.update({ where: { id }, data: { status, prioridade } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.risco.alterar", entidade: "risco_nr1", entidadeId: id, detalhes: { status, prioridade } });
      return r.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Risco atualizado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function adicionarAcaoNr1(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const riscoId = z.string().uuid().parse(fd.get("riscoId"));
    const titulo = z.string().trim().min(3, "Descreva a medida.").max(300).parse(fd.get("titulo"));
    const responsavelNome = z.string().trim().min(2, "Informe o responsável.").max(120).parse(fd.get("responsavelNome"));
    const prazoTxt = String(fd.get("prazo") ?? "");
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const r = await tx.riscoNr1.findUnique({ where: { id: riscoId } });
      if (!r) throw new ErroAcesso("Risco não encontrado.");
      await tx.acaoNr1.create({
        data: { tenantId: ctx.org.id, riscoId, titulo, responsavelNome, prazo: prazoTxt ? new Date(`${prazoTxt}T12:00:00`) : null, criadoPor: ctx.usuario.nome },
      });
      if (r.status === "identificado") await tx.riscoNr1.update({ where: { id: riscoId }, data: { status: "em_tratamento" } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.acao.criar", entidade: "risco_nr1", entidadeId: riscoId });
      return r.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Medida incluída no plano de ação." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarAcaoNr1(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const id = z.string().uuid().parse(fd.get("acaoId"));
    const status = z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).parse(fd.get("status"));
    const evidencia = texto.parse(fd.get("evidencia") ?? "");
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const a = await tx.acaoNr1.findUnique({ where: { id }, include: { risco: true } });
      if (!a) throw new ErroAcesso("Medida não encontrada.");
      const ev = evidencia ?? a.evidencia;
      if (status === "concluida" && !ev) throw new ErroAcesso("Para concluir, registre a evidência do que foi feito.");
      await tx.acaoNr1.update({ where: { id }, data: { status, evidencia: ev, concluidaEm: status === "concluida" ? (a.concluidaEm ?? new Date()) : null } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.acao.alterar", entidade: "acao_nr1", entidadeId: id, detalhes: { status } });
      return a.risco.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Medida atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}
