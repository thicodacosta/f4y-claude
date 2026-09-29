"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, getContexto, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { MODELOS_PULSE } from "./regras";
import { hoje as hojeCivil } from "@/lib/datas";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  // Erros de regra levantados pelas funções do banco vêm prefixados com "JL: ".
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  if (doBanco) return { erro: doBanco[1].trim() };
  return { erro: msg || "Não foi possível concluir." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });

/** Gestão de pesquisas exige a ação com escopo "todos" (RH/admin por padrão). */
async function exigirGestao(acao: "criar" | "editar" | "concluir") {
  const r = await exigirPermissaoAcao("pulse", acao);
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite gerenciar pesquisas.");
  return r;
}

async function rascunho(tx: Tx, id: string) {
  const p = await tx.pesquisaPulse.findUnique({ where: { id } });
  if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
  if (p.status !== "rascunho") throw new ErroAcesso("Depois de aberta, a pesquisa não pode ser alterada (garante comparabilidade das respostas).");
  return p;
}

async function validarEquipes(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  const n = await tx.equipe.count({ where: { id: { in: ids } } });
  if (n !== ids.length) throw new ErroAcesso("Equipe inválida.");
}

export async function criarPesquisa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx } = await exigirGestao("criar");
    const titulo = z.string().trim().min(3, "Informe o título.").max(120).parse(fd.get("titulo"));
    const modelo = z.enum(["", ...Object.keys(MODELOS_PULSE)] as [string, ...string[]]).parse(fd.get("modelo") ?? "");
    id = await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.create({ data: { tenantId: ctx.org.id, titulo, criadoPor: ctx.usuario.nome } });
      if (modelo) {
        await tx.perguntaPulse.createMany({
          data: MODELOS_PULSE[modelo].perguntas.map((q, ordem) => ({ ...q, ordem, tenantId: ctx.org.id, pesquisaId: p.id })),
        });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pulse.criar", entidade: "pesquisa_pulse", entidadeId: p.id });
      return p.id;
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/pulse");
  redirect(`/pulse/${id}`);
}

export async function salvarPesquisa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const id = z.string().uuid().parse(fd.get("pesquisaId"));
    const titulo = z.string().trim().min(3, "Informe o título.").max(120).parse(fd.get("titulo"));
    const descricao = z.string().trim().max(1000).transform((v) => v || null).parse(fd.get("descricao") ?? "");
    const publicoTodos = fd.get("publico") !== "equipes";
    const equipeIds = publicoTodos ? [] : fd.getAll("equipeIds").map((v) => z.string().uuid().parse(v));
    if (!publicoTodos && !equipeIds.length) throw new ErroAcesso("Escolha ao menos uma equipe ou use toda a organização.");
    const fim = String(fd.get("encerraEm") ?? "");
    const encerraEm = fim ? new Date(`${fim}T12:00:00`) : null;
    await transacao(escopoTx(ctx), async (tx) => {
      await rascunho(tx, id);
      await validarEquipes(tx, equipeIds);
      await tx.pesquisaPulse.update({ where: { id }, data: { titulo, descricao, publicoTodos, equipeIds, encerraEm } });
    });
    revalidatePath(`/pulse/${id}`);
    return { ok: "Pesquisa salva." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function adicionarPergunta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirGestao("editar");
    const pesquisaId = z.string().uuid().parse(fd.get("pesquisaId"));
    const texto = z.string().trim().min(5, "Escreva a pergunta.").max(300).parse(fd.get("texto"));
    const tipo = z.enum(["escala", "enps", "sim_nao", "texto"]).parse(fd.get("tipo"));
    const obrigatoria = tipo === "texto" ? false : fd.get("obrigatoria") === "on";
    await transacao(escopoTx(ctx), async (tx) => {
      await rascunho(tx, pesquisaId);
      const ordem = await tx.perguntaPulse.count({ where: { pesquisaId } });
      if (ordem >= 20) throw new ErroAcesso("Pulse é uma pesquisa curta: no máximo 20 perguntas.");
      await tx.perguntaPulse.create({ data: { tenantId: ctx.org.id, pesquisaId, texto, tipo, obrigatoria, ordem } });
    });
    revalidatePath(`/pulse/${pesquisaId}`);
    return { ok: "Pergunta incluída." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function excluirPergunta(perguntaId: string) {
  const { ctx } = await exigirGestao("editar");
  const pesquisaId = await transacao(escopoTx(ctx), async (tx) => {
    const q = await tx.perguntaPulse.findUnique({ where: { id: perguntaId } });
    if (!q) throw new ErroAcesso("Pergunta não encontrada.");
    await rascunho(tx, q.pesquisaId);
    await tx.perguntaPulse.delete({ where: { id: perguntaId } });
    return q.pesquisaId;
  });
  revalidatePath(`/pulse/${pesquisaId}`);
}

export async function alterarStatusPesquisa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const acao = z.enum(["abrir", "encerrar"]).parse(fd.get("acao"));
    const { ctx } = await exigirGestao(acao === "abrir" ? "editar" : "concluir");
    const id = z.string().uuid().parse(fd.get("pesquisaId"));
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id }, include: { _count: { select: { perguntas: true } } } });
      if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
      if (acao === "abrir") {
        if (p.status !== "rascunho") throw new ErroAcesso("A pesquisa já foi aberta.");
        if (!p._count.perguntas) throw new ErroAcesso("Inclua ao menos uma pergunta antes de abrir.");
        const hoje = hojeCivil();
        if (p.encerraEm && p.encerraEm < hoje) throw new ErroAcesso("A data de encerramento já passou.");
        await tx.pesquisaPulse.update({ where: { id }, data: { status: "aberta", abertaEm: new Date() } });
      } else {
        if (p.status !== "aberta") throw new ErroAcesso("A pesquisa não está aberta.");
        await tx.pesquisaPulse.update({ where: { id }, data: { status: "encerrada", encerradaEm: new Date() } });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: `pulse.${acao}`, entidade: "pesquisa_pulse", entidadeId: id });
    });
    revalidatePath(`/pulse/${id}`);
    revalidatePath("/pulse");
    return { ok: acao === "abrir" ? "Pesquisa aberta para respostas." : "Pesquisa encerrada. Resultados liberados conforme o mínimo de respondentes." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Nova rodada: copia título, público e perguntas para um novo rascunho. */
export async function duplicarPesquisa(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let novo: string;
  try {
    const { ctx } = await exigirGestao("criar");
    const id = z.string().uuid().parse(fd.get("pesquisaId"));
    novo = await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
      if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
      const c = await tx.pesquisaPulse.create({
        data: { tenantId: ctx.org.id, titulo: `${p.titulo} (nova rodada)`, descricao: p.descricao, publicoTodos: p.publicoTodos, equipeIds: p.equipeIds, criadoPor: ctx.usuario.nome },
      });
      await tx.perguntaPulse.createMany({
        data: p.perguntas.map((q) => ({ tenantId: ctx.org.id, pesquisaId: c.id, texto: q.texto, tipo: q.tipo, obrigatoria: q.obrigatoria, ordem: q.ordem })),
      });
      return c.id;
    });
  } catch (e) {
    return erroDe(e);
  }
  redirect(`/pulse/${novo}`);
}

/**
 * Resposta anônima: toda a validação e a gravação acontecem na função do
 * banco `jl_responder_pulse` — a aplicação nunca toca a tabela de respostas.
 */
export async function responderPulse(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const ctx = await getContexto();
    if (!ctx) throw new ErroAcesso("Sessão expirada.");
    if (!ctx.usuario.aceitouTermos) throw new ErroAcesso("Aceite os termos de uso para continuar.");
    if (ctx.suporte) throw new ErroAcesso("Acesso de suporte é somente leitura.");
    if (!ctx.modulos.has("pulse")) throw new ErroAcesso("O Pulse não está ativo para a sua organização.");
    const pesquisaId = z.string().uuid().parse(fd.get("pesquisaId"));
    const respostas: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      const m = k.match(/^q_([0-9a-f-]{36})$/);
      if (m && typeof v === "string") respostas[m[1]] = v.slice(0, 1000);
    }
    await transacao(escopoTx(ctx), (tx) => tx.$executeRaw`select public.jl_responder_pulse(${pesquisaId}::uuid, ${JSON.stringify(respostas)}::jsonb)`);
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/inicio");
  revalidatePath("/pulse");
  redirect("/pulse?respondido=1");
}
