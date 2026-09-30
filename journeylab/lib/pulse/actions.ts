"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto, hoje } from "@/lib/datas";
import { completarJson, ErroIa, iaDisponivel, insightsSchema } from "@/lib/ia";
import { deBanco, perguntasSchema, type PerguntaDef } from "./perguntas";
import { analisarPergunta, resumoParaIa } from "./analise";
import { membrosAudiencia } from "./regras";
import { enviarConvites, type ResultadoEnvio } from "./envio";
import { resultadoPulse } from "./consultas";

export type RespostaAcao = { ok?: string; erro?: string; id?: string; envio?: ResultadoEnvio };

function erroDe(e: unknown): RespostaAcao {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  return { erro: doBanco ? doBanco[1].trim() : msg || "Não foi possível concluir." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });

/** Gestão exige a ação com escopo "todos" (RH/Admin). Gestor só lê. */
async function exigirGestao(acao: "criar" | "editar" | "concluir") {
  const r = await exigirPermissaoAcao("pulse", acao);
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite gerenciar pesquisas (somente leitura).");
  return r;
}

const dataOpc = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable());
const uuids = z.array(z.string().uuid()).max(500);

const pesquisaSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3, "Informe o título da pesquisa.").max(120),
  descricao: z.string().trim().max(1000).transform((v) => v || null),
  anonima: z.boolean(),
  audienciaTipo: z.enum(["todos", "departamentos", "equipes", "colaboradores"]),
  areaIds: uuids,
  equipeIds: uuids,
  colaboradorIds: uuids,
  dataInicio: dataOpc,
  encerraEm: dataOpc,
  linkAberto: z.boolean(),
  modeloId: z.string().uuid().nullable().optional(),
  modeloSlug: z.string().max(60).nullable().optional(),
  perguntas: perguntasSchema,
});

/**
 * Salva a pesquisa do assistente (rascunho) e, se pedido, envia. Perguntas só
 * mudam enquanto a pesquisa é rascunho (garante a comparabilidade das respostas).
 */
export async function salvarPesquisaWizard(payload: string, enviar: boolean): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao(enviar ? "editar" : "criar");
    const d = pesquisaSchema.parse(JSON.parse(payload));
    if (d.linkAberto && !d.anonima) throw new ErroAcesso("Link aberto só é permitido em pesquisas anônimas.");
    if (d.audienciaTipo === "departamentos" && !d.areaIds.length) throw new ErroAcesso("Escolha ao menos um departamento.");
    if (d.audienciaTipo === "equipes" && !d.equipeIds.length) throw new ErroAcesso("Escolha ao menos uma equipe.");
    if (d.audienciaTipo === "colaboradores" && !d.colaboradorIds.length) throw new ErroAcesso("Escolha ao menos uma pessoa.");
    if (d.dataInicio && d.encerraEm && d.encerraEm < d.dataInicio) throw new ErroAcesso("A data de fim deve ser igual ou posterior à de início.");
    const perguntas = [...d.perguntas].sort((a, b) => a.order - b.order).map((p, i) => ({ ...p, order: i }));

    const id = await transacao(escopoTx(ctx), async (tx) => {
      // Referências validadas dentro da organização (RLS devolve só as da empresa).
      if (d.areaIds.length && (await tx.area.count({ where: { id: { in: d.areaIds } } })) !== d.areaIds.length) throw new ErroAcesso("Departamento inválido.");
      if (d.equipeIds.length && (await tx.equipe.count({ where: { id: { in: d.equipeIds } } })) !== d.equipeIds.length) throw new ErroAcesso("Equipe inválida.");
      if (d.colaboradorIds.length && (await tx.colaborador.count({ where: { id: { in: d.colaboradorIds } } })) !== d.colaboradorIds.length) throw new ErroAcesso("Pessoa inválida.");
      const dados = {
        titulo: d.titulo,
        descricao: d.descricao,
        anonima: d.anonima,
        audienciaTipo: d.audienciaTipo,
        areaIds: d.audienciaTipo === "departamentos" ? d.areaIds : [],
        equipeIds: d.audienciaTipo === "equipes" ? d.equipeIds : [],
        colaboradorIds: d.audienciaTipo === "colaboradores" ? d.colaboradorIds : [],
        dataInicio: d.dataInicio ? dataDeTexto(d.dataInicio) : null,
        encerraEm: d.encerraEm ? dataDeTexto(d.encerraEm) : null,
        linkAberto: d.linkAberto,
      };
      let pesquisaId = d.id;
      if (pesquisaId) {
        const atual = await tx.pesquisaPulse.findUnique({ where: { id: pesquisaId } });
        if (!atual) throw new ErroAcesso("Pesquisa não encontrada.");
        if (atual.status !== "rascunho") throw new ErroAcesso("Depois de enviada, a pesquisa não pode ser alterada.");
        await tx.pesquisaPulse.update({ where: { id: pesquisaId }, data: dados });
        await tx.perguntaPulse.deleteMany({ where: { pesquisaId } });
      } else {
        const modeloId = d.modeloId && (await tx.modeloPulse.findUnique({ where: { id: d.modeloId } })) ? d.modeloId : null;
        const p = await tx.pesquisaPulse.create({ data: { ...dados, tenantId: ctx.org.id, criadoPor: ctx.usuario.nome, modeloId, modeloSlug: modeloId ? (d.modeloSlug ?? null) : null } });
        pesquisaId = p.id;
      }
      await tx.perguntaPulse.createMany({ data: perguntas.map((q) => paraBanco(ctx, pesquisaId!, q)) });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: d.id ? "pulse.editar" : "pulse.criar", entidade: "pesquisa_pulse", entidadeId: pesquisaId });
      return pesquisaId!;
    });
    let envio: ResultadoEnvio | undefined;
    if (enviar) envio = await publicar(ctx, id);
    revalidatePath("/pulse");
    return { ok: enviar ? "Pesquisa enviada." : "Rascunho salvo.", id, envio };
  } catch (e) {
    return erroDe(e);
  }
}

function paraBanco(ctx: Contexto, pesquisaId: string, q: PerguntaDef) {
  const { id: chave, type, text, required, order, ...config } = q;
  return { tenantId: ctx.org.id, pesquisaId, texto: text, tipo: type, obrigatoria: required, ordem: order, config: { ...config, chave } };
}

/**
 * Publica: status "Ativa", congela o total do público, cria os convites e envia
 * os e-mails (fora da transação; falhas por pessoa voltam para a tela).
 */
async function publicar(ctx: Contexto, id: string): Promise<ResultadoEnvio> {
  const convites = await transacao(escopoTx(ctx), async (tx: Tx) => {
    const p = await tx.pesquisaPulse.findUnique({ where: { id }, include: { _count: { select: { perguntas: true } } } });
    if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
    if (p.status !== "rascunho") throw new ErroAcesso("A pesquisa já foi enviada.");
    if (!p._count.perguntas) throw new ErroAcesso("Inclua ao menos uma pergunta antes de enviar.");
    const inicio = p.dataInicio ?? hoje();
    if (p.encerraEm && p.encerraEm < hoje()) throw new ErroAcesso("A data de fim já passou.");
    const membros = await membrosAudiencia(tx, p);
    if (!membros.length && !p.linkAberto) throw new ErroAcesso("A audiência não tem nenhuma pessoa ativa.");
    await tx.pesquisaPulse.update({ where: { id }, data: { status: "aberta", abertaEm: new Date(), dataInicio: inicio, publicoTotal: membros.length } });
    if (membros.length) await tx.convitePulse.createMany({ data: membros.map((m) => ({ tenantId: ctx.org.id, pesquisaId: id, colaboradorId: m.id })), skipDuplicates: true });
    await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pulse.enviar", entidade: "pesquisa_pulse", entidadeId: id, detalhes: { publico: membros.length } });
    return (await tx.convitePulse.findMany({ where: { pesquisaId: id }, select: { id: true } })).map((c) => c.id);
  });
  const envio = await enviarConvites(escopoTx(ctx), convites, false);
  revalidatePath(`/pulse/${id}`);
  return envio;
}

export async function enviarPesquisa(id: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("editar");
    const envio = await publicar(ctx, z.string().uuid().parse(id));
    revalidatePath("/pulse");
    return { ok: "Pesquisa enviada.", id, envio };
  } catch (e) {
    return erroDe(e);
  }
}

export async function encerrarPesquisa(id: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("concluir");
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id } });
      if (!p || p.status !== "aberta") throw new ErroAcesso("A pesquisa não está ativa.");
      await tx.pesquisaPulse.update({ where: { id }, data: { status: "encerrada", encerradaEm: new Date() } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pulse.encerrar", entidade: "pesquisa_pulse", entidadeId: id });
    });
    // Insights automáticos ao encerrar (se houver IA e resultados liberados) — sem bloquear a resposta.
    if (iaDisponivel()) after(() => gerarInsightsInterno(ctx, id).catch(() => undefined));
    revalidatePath(`/pulse/${id}`);
    revalidatePath("/pulse");
    return { ok: "Pesquisa encerrada. Resultados liberados conforme o mínimo de respondentes." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function duplicarPesquisa(id: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("criar");
    const novo = await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
      if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
      const c = await tx.pesquisaPulse.create({
        data: {
          tenantId: ctx.org.id,
          titulo: `${p.titulo} (cópia)`,
          descricao: p.descricao,
          anonima: p.anonima,
          audienciaTipo: p.audienciaTipo,
          areaIds: p.areaIds,
          equipeIds: p.equipeIds,
          colaboradorIds: p.colaboradorIds,
          linkAberto: p.linkAberto,
          modeloId: p.modeloId,
          modeloSlug: p.modeloSlug,
          criadoPor: ctx.usuario.nome,
        },
      });
      await tx.perguntaPulse.createMany({ data: p.perguntas.map((q) => ({ tenantId: ctx.org.id, pesquisaId: c.id, texto: q.texto, tipo: q.tipo, config: q.config ?? {}, obrigatoria: q.obrigatoria, ordem: q.ordem })) });
      return c.id;
    });
    revalidatePath("/pulse");
    return { ok: "Pesquisa duplicada como rascunho.", id: novo };
  } catch (e) {
    return erroDe(e);
  }
}

export async function excluirRascunho(id: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("editar");
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id } });
      if (!p || p.status !== "rascunho") throw new ErroAcesso("Só rascunhos podem ser excluídos.");
      await tx.pesquisaPulse.delete({ where: { id } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pulse.excluir_rascunho", entidade: "pesquisa_pulse", entidadeId: id });
    });
    revalidatePath("/pulse");
    return { ok: "Rascunho excluído." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Lembrete manual para quem ainda não respondeu. */
export async function enviarLembretes(id: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("editar");
    const ids = await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id } });
      if (!p || p.status !== "aberta") throw new ErroAcesso("A pesquisa não está ativa.");
      if (p.encerraEm && p.encerraEm < hoje()) throw new ErroAcesso("O prazo da pesquisa já terminou.");
      // Participações só são legíveis pela própria pessoa (RLS); a função do banco responde por convite.
      const pendentes = await tx.$queryRaw<{ id: string }[]>`
        select c.id from convites_pulse c
         where c.pesquisa_id = ${id}::uuid
           and not public.jl_convite_respondido(c.id)`;
      return pendentes.map((r) => r.id);
    });
    const envio = await enviarConvites(escopoTx(ctx), ids, true);
    revalidatePath(`/pulse/${id}`);
    return { ok: `Lembretes: ${envio.enviados} enviado(s).`, envio };
  } catch (e) {
    return erroDe(e);
  }
}

async function gerarInsightsInterno(ctx: Contexto, id: string) {
  const p = await transacao(escopoTx(ctx), (tx) => tx.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } }));
  if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
  const r = await resultadoPulse(ctx, id, null);
  if (!r.resumo?.liberado) throw new ErroAcesso("Os resultados ainda não estão liberados (encerramento e mínimo de respondentes).");
  const analise = p.perguntas.map((q) => analisarPergunta(deBanco(q), q.id, r.linhas, r.comentarios));
  const insights = await completarJson({
    sistema:
      "Você é um analista sênior de People Analytics. Analise os resultados agregados desta pesquisa de pulso e retorne JSON com: { resumo_executivo, pontos_fortes[], pontos_atencao[], riscos[], plano_acao[{ acao, prioridade, prazo_sugerido, responsavel_sugerido }] }. Seja direto, use dados numéricos das respostas, escreva em português brasileiro. Não invente fatos, não faça diagnósticos psicológicos nem conclusões sobre pessoas específicas; os dados são agregados e anônimos. Responda somente com o JSON.",
    usuario: JSON.stringify({ pesquisa: p.titulo, respondentes: r.resumo.respondentes, resultados: resumoParaIa(analise) }),
    schema: insightsSchema,
  });
  await transacao(escopoTx(ctx), async (tx) => {
    await tx.pesquisaPulse.update({ where: { id }, data: { aiInsights: insights, aiInsightsEm: new Date() } });
    await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "pulse.insights_ia", entidade: "pesquisa_pulse", entidadeId: id });
  });
  return insights;
}

/** Insights de IA sob demanda: só dados agregados (sem comentários livres nem identificação). */
export async function gerarInsights(id: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("editar");
    await gerarInsightsInterno(ctx, z.string().uuid().parse(id));
    revalidatePath(`/pulse/${id}`);
    return { ok: "Insights gerados. Revise antes de compartilhar — são sugestões." };
  } catch (e) {
    if (e instanceof ErroIa) return { erro: e.message };
    return erroDe(e);
  }
}

export async function salvarComoModelo(id: string, nome: string): Promise<RespostaAcao> {
  try {
    const { ctx } = await exigirGestao("criar");
    const titulo = z.string().trim().min(3, "Informe o nome do template.").max(80).parse(nome);
    await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.pesquisaPulse.findUnique({ where: { id }, include: { perguntas: { orderBy: { ordem: "asc" } } } });
      if (!p) throw new ErroAcesso("Pesquisa não encontrada.");
      const slug = `${titulo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-${Date.now().toString(36)}`;
      await tx.modeloPulse.create({
        data: { tenantId: ctx.org.id, nome: titulo, slug, descricao: p.descricao, icone: "ClipboardList", cor: "#526173", perguntas: p.perguntas.map((q) => deBanco(q)) },
      });
    });
    revalidatePath("/pulse");
    return { ok: "Template da empresa criado." };
  } catch (e) {
    return erroDe(e);
  }
}
