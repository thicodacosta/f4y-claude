"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto, hojeTexto, instanteNoFuso, textoDeData } from "@/lib/datas";
import { formatarDataHora } from "@/lib/formato";
import { calcularMedias, DURACOES, HORARIOS, TODOS_CRITERIOS, type Notas } from "./avaliacao";
import { filtroAvaliacoes, filtroPessoasFeedback, podeEditarAvaliacao } from "./regras";
import type { EstadoForm } from "@/lib/auth/actions";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Já existe um 1:1 ativo para esta pessoa neste mesmo horário." };
  }
  const msg = e instanceof Error ? e.message : "";
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  return { erro: doBanco ? doBanco[1].trim() : msg || "Não foi possível concluir." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const dataTexto = (msg: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, msg);

function lerNotas(fd: FormData): Notas {
  const notas: Notas = {};
  for (const c of TODOS_CRITERIOS) {
    const v = Number(fd.get(`n_${c.campo}`));
    if (Number.isInteger(v) && v >= 1 && v <= 5) notas[c.campo] = v;
  }
  return notas;
}

// ─── Feedback avaliado ────────────────────────────────────────────────────

/**
 * Cria ou edita um feedback. A pessoa precisa estar no escopo (RH: qualquer
 * ativa da empresa; gestor: subordinados diretos). O gestor registrado é o do
 * cadastro (nunca informado pelo navegador). As 16 notas são obrigatórias;
 * médias e semáforo são calculados pelo banco.
 */
export async function salvarAvaliacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let destino: string;
  try {
    const idTxt = String(fd.get("id") ?? "");
    const id = idTxt ? z.string().uuid().parse(idTxt) : null;
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", id ? "editar" : "criar");
    const data = dataTexto("Informe a data do feedback.").parse(fd.get("data"));
    if (data > hojeTexto()) throw new ErroAcesso("A data do feedback não pode estar no futuro.");
    const periodicidade = z.enum(["mensal", "bimestral", "trimestral", "manual"], { message: "Escolha a periodicidade." }).parse(fd.get("periodicidade"));
    const observacoes = z.string().trim().max(5000, "Observações muito longas.").transform((v) => v || null).parse(fd.get("observacoes") ?? "");
    const notas = lerNotas(fd);
    const calc = calcularMedias(notas);
    if (!calc.completo) throw new ErroAcesso(`Preencha todas as notas: falta${calc.faltando > 1 ? "m" : ""} ${calc.faltando} critério(s).`);
    const campos = Object.fromEntries(TODOS_CRITERIOS.map((c) => [c.campo, notas[c.campo]!])) as Record<string, number>;

    destino = await transacao(escopoTx(ctx), async (tx) => {
      if (id) {
        const atual = await tx.avaliacaoFeedback.findFirst({ where: { AND: [{ id }, filtroAvaliacoes(ctx, escopo)] }, include: { colaborador: true } });
        if (!atual || !podeEditarAvaliacao(ctx, escopo, atual.colaborador)) throw new ErroAcesso("Feedback não encontrado.");
        await tx.avaliacaoFeedback.update({ where: { id }, data: { ...campos, data: dataDeTexto(data), periodicidade, observacoes } });
        await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.avaliacao.editar", entidade: "avaliacao_feedback", entidadeId: id });
        return `/feedback/avaliacoes/${id}?salvo=1`;
      }
      const colaboradorId = z.string().uuid("Selecione o colaborador.").parse(fd.get("colaboradorId"));
      const pessoa = await tx.colaborador.findFirst({ where: { AND: [{ id: colaboradorId }, filtroPessoasFeedback(ctx, escopo)] } });
      if (!pessoa) throw new ErroAcesso("Você não pode registrar feedback para esta pessoa.");
      const a = await tx.avaliacaoFeedback.create({
        data: {
          ...campos,
          tenantId: ctx.org.id,
          colaboradorId,
          gestorId: pessoa.gestorId,
          data: dataDeTexto(data),
          periodicidade,
          observacoes,
          autorId: ctx.usuario.id,
          autorNome: ctx.usuario.nome,
        } as never,
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.avaliacao.criar", entidade: "avaliacao_feedback", entidadeId: a.id, detalhes: { colaboradorId } });
      return `/feedback/avaliacoes/${a.id}?salvo=1`;
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/feedback");
  revalidatePath("/inicio");
  redirect(destino);
}

export async function excluirAvaliacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "editar");
    const id = z.string().uuid().parse(fd.get("id"));
    if (fd.get("confirmo") !== "on") throw new ErroAcesso("Confirme a exclusão marcando a caixa.");
    await transacao(escopoTx(ctx), async (tx) => {
      const a = await tx.avaliacaoFeedback.findFirst({ where: { AND: [{ id }, filtroAvaliacoes(ctx, escopo)] }, include: { colaborador: true } });
      if (!a || !podeEditarAvaliacao(ctx, escopo, a.colaborador)) throw new ErroAcesso("Feedback não encontrado.");
      await tx.avaliacaoFeedback.delete({ where: { id } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.avaliacao.excluir", entidade: "avaliacao_feedback", entidadeId: id, detalhes: { colaboradorId: a.colaboradorId, data: textoDeData(a.data) } });
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/feedback");
  revalidatePath("/inicio");
  redirect("/feedback?excluido=1");
}

// ─── Agendamento de 1:1 ───────────────────────────────────────────────────

/** Soma meses a uma data civil mantendo o dia (limitado ao último dia do mês). */
function somarMeses(data: string, meses: number) {
  const [a, m, d] = data.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Agenda um 1:1 (e, com recorrência, as próximas 3 ocorrências) numa única
 * transação: tudo ou nada. Data no passado é recusada; horários de 08h às 18h
 * em intervalos de 30 min; duplicidade de horário para a mesma pessoa é
 * recusada (checagem + índice único no banco).
 */
export async function agendarUmAUm(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let primeiro: string;
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "criar");
    const colaboradorId = z.string().uuid("Selecione o colaborador.").parse(fd.get("colaboradorId"));
    const data = dataTexto("Informe a data.").parse(fd.get("data"));
    const horario = z.enum(HORARIOS as [string, ...string[]], { message: "Escolha um horário entre 08h e 18h." }).parse(fd.get("horario"));
    const duracaoMin = z.coerce.number().refine((n) => (DURACOES as readonly number[]).includes(n), "Duração inválida.").parse(fd.get("duracao"));
    const recorrencia = z.enum(["nenhuma", "mensal", "trimestral"]).parse(fd.get("recorrencia") ?? "nenhuma");
    const observacoes = z.string().trim().max(2000).transform((v) => v || null).parse(fd.get("observacoes") ?? "");
    const avaliacaoTxt = String(fd.get("avaliacaoId") ?? "");
    const avaliacaoId = avaliacaoTxt ? z.string().uuid().parse(avaliacaoTxt) : null;
    const modeloTxt = String(fd.get("modeloId") ?? "");

    if (data < hojeTexto()) throw new ErroAcesso("A data do 1:1 não pode estar no passado.");
    const inicio = instanteNoFuso(`${data}T${horario}`);
    if (inicio.getTime() < Date.now()) throw new ErroAcesso("Esse horário de hoje já passou. Escolha um horário futuro.");
    const datas = recorrencia === "nenhuma" ? [data] : [0, 1, 2, 3].map((i) => somarMeses(data, i * (recorrencia === "mensal" ? 1 : 3)));
    const instantes = datas.map((d) => instanteNoFuso(`${d}T${horario}`));

    primeiro = await transacao(escopoTx(ctx), async (tx) => {
      const pessoa = await tx.colaborador.findFirst({ where: { AND: [{ id: colaboradorId }, filtroPessoasFeedback(ctx, escopo)] } });
      if (!pessoa) throw new ErroAcesso("Você não pode agendar 1:1 com esta pessoa.");
      if (!pessoa.gestorId) throw new ErroAcesso("Defina o gestor desta pessoa no cadastro antes de agendar.");
      if (avaliacaoId && !(await tx.avaliacaoFeedback.findFirst({ where: { id: avaliacaoId, colaboradorId } }))) throw new ErroAcesso("Feedback de origem inválido.");
      const conflitos = await tx.reuniao.findMany({ where: { colaboradorId, status: { not: "cancelada" }, dataHora: { in: instantes } }, select: { dataHora: true } });
      if (conflitos.length) throw new ErroAcesso(`Já existe 1:1 ativo em ${conflitos.map((c) => formatarDataHora(c.dataHora.toISOString())).join(", ")}.`);
      let pauta: string[] = [];
      let modeloNome: string | null = null;
      if (modeloTxt) {
        const m = await tx.modeloPauta.findUnique({ where: { id: z.string().uuid().parse(modeloTxt) } });
        if (!m || !m.ativo) throw new ErroAcesso("Modelo de pauta não encontrado.");
        pauta = m.itens;
        modeloNome = m.nome;
      }
      const serieId = instantes.length > 1 ? randomUUID() : null;
      const ids: string[] = [];
      for (const dataHora of instantes) {
        const r = await tx.reuniao.create({
          data: { tenantId: ctx.org.id, gestorId: pessoa.gestorId, colaboradorId, dataHora, duracaoMin, observacoes, serieId, avaliacaoId, pauta, modeloNome, criadoPorId: ctx.usuario.id, criadoPor: ctx.usuario.nome },
        });
        ids.push(r.id);
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.reuniao.agendar", entidade: "reuniao", entidadeId: ids[0], detalhes: { ocorrencias: ids.length, recorrencia } });
      return ids[0];
    });
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/feedback");
  revalidatePath("/feedback/agenda");
  revalidatePath("/inicio");
  redirect(`/feedback/${primeiro}?agendado=1`);
}

/** Cancela esta ocorrência e as PRÓXIMAS da mesma série (ação explícita, com confirmação). As anteriores ficam intactas. */
export async function cancelarSerie(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("feedback", "editar");
    const id = z.string().uuid().parse(fd.get("reuniaoId"));
    const motivo = z.string().trim().min(3, "Informe o motivo do cancelamento.").parse(fd.get("motivo"));
    if (fd.get("confirmo") !== "on") throw new ErroAcesso("Confirme o cancelamento das próximas ocorrências.");
    const n = await transacao(escopoTx(ctx), async (tx) => {
      const r = await tx.reuniao.findUnique({ where: { id }, include: { colaborador: true } });
      if (!r || !r.serieId) throw new ErroAcesso("Esta reunião não faz parte de uma série.");
      const permitido = escopo === "todos" || (escopo === "equipe" && (r.gestorId === ctx.colaboradorId || r.colaborador.gestorId === ctx.colaboradorId));
      if (!permitido) throw new ErroAcesso("Você não pode alterar esta série.");
      const res = await tx.reuniao.updateMany({ where: { serieId: r.serieId, status: "agendada", dataHora: { gte: r.dataHora } }, data: { status: "cancelada", canceladaMotivo: motivo } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "feedback.reuniao.cancelar_serie", entidade: "reuniao", entidadeId: id, detalhes: { canceladas: res.count, motivo } });
      return res.count;
    });
    revalidatePath(`/feedback/${id}`);
    revalidatePath("/feedback/agenda");
    return { ok: `${n} ocorrência(s) cancelada(s): esta e as próximas da série.` };
  } catch (e) {
    return erroDe(e);
  }
}
