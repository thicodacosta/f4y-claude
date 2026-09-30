"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { dataDeTexto, hoje } from "@/lib/datas";
import { completarJson, ErroIa, iaDisponivel } from "@/lib/ia";
import { ESCALA_NR1, FATORES_NR1, itensDoTipo, METODOLOGIA_VERSAO, SEM_RESPOSTA } from "./questionario";
import { faixaDe, LIMITACOES } from "./calculo";
import { resultadoNr1 } from "./consultas";
import { enviarConvitesNr1, type ResultadoEnvioNr1 } from "./envio";

export type RespostaNr1 = { ok?: string; erro?: string; id?: string; envio?: ResultadoEnvioNr1 };

function erroDe(e: unknown): RespostaNr1 {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e instanceof ErroIa) return { erro: e.message };
  const msg = e instanceof Error ? e.message : "";
  const doBanco = msg.match(/JL: ([^\n"]+)/);
  if (doBanco) return { erro: doBanco[1].trim() };
  return { erro: msg && !/prisma|invocation/i.test(msg) ? msg : "Não foi possível concluir. Tente novamente." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const uuid = z.string().uuid();

/** Gestão do NR-1 exige a ação com escopo "todos" (RH/Admin). Gestores, se autorizados, só leem agregados. */
async function exigirGestao(acao: "criar" | "editar" | "concluir") {
  const r = await exigirPermissaoAcao("nr1", acao);
  if (r.escopo !== "todos") throw new ErroAcesso("Seu papel não permite administrar o Diagnóstico NR-1.");
  return r;
}

async function ciclo(tx: Tx, id: string) {
  const c = await tx.cicloNr1.findUnique({ where: { id: uuid.parse(id) } });
  if (!c) throw new ErroAcesso("Diagnóstico não encontrado.");
  return c;
}

const dataOpc = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable());
const CHAVES_ITENS = FATORES_NR1.flatMap((f) => f.itens.map((i) => i.chave));

const diagnosticoSchema = z
  .object({
    id: uuid.optional().nullable(),
    titulo: z.string().trim().min(3, "Informe o título.").max(120),
    descricao: z.string().trim().max(1500).transform((v) => v || null),
    tipo: z.enum(["completo", "rapido", "personalizado"]),
    itens: z.array(z.enum(CHAVES_ITENS as [string, ...string[]])).max(50),
    audienciaTipo: z.enum(["todos", "departamentos", "colaboradores"]),
    areaIds: z.array(uuid).max(200),
    colaboradorIds: z.array(uuid).max(2000),
    dataInicio: dataOpc,
    encerraEm: dataOpc,
    coletarDepartamento: z.boolean(),
    mensagemConvite: z.string().trim().max(2000).transform((v) => v || null),
    faixas: z.array(z.number().int().min(1).max(99)).length(4),
  })
  .superRefine((d, c) => {
    if (d.tipo === "personalizado" && d.itens.length < 5) c.addIssue({ code: "custom", message: "No questionário personalizado, escolha ao menos 5 perguntas." });
    if (d.audienciaTipo === "departamentos" && !d.areaIds.length) c.addIssue({ code: "custom", message: "Escolha ao menos um departamento." });
    if (d.audienciaTipo === "colaboradores" && !d.colaboradorIds.length) c.addIssue({ code: "custom", message: "Escolha ao menos um colaborador." });
    if (d.dataInicio && d.encerraEm && d.encerraEm < d.dataInicio) c.addIssue({ code: "custom", message: "A data de fim deve ser igual ou posterior à de início." });
    if (!d.faixas.every((v, i) => i === 0 || v > d.faixas[i - 1])) c.addIssue({ code: "custom", message: "Os limites das faixas devem ser crescentes." });
  });

/** Pessoas ativas da audiência (convites e total de elegíveis). */
function membros(tx: Tx, c: { audienciaTipo: string; areaIds: string[]; colaboradorIds: string[] }) {
  const filtro =
    c.audienciaTipo === "departamentos" ? { equipe: { areaId: { in: c.areaIds } } } : c.audienciaTipo === "colaboradores" ? { id: { in: c.colaboradorIds } } : {};
  return tx.colaborador.findMany({ where: { AND: [{ status: "ativo" as const }, filtro] }, select: { id: true } });
}

/** Cria ou edita o rascunho; o questionário é copiado da biblioteca (snapshot por diagnóstico). */
export async function salvarDiagnostico(payload: string): Promise<RespostaNr1> {
  try {
    const bruto = JSON.parse(payload) as { id?: string };
    const { ctx } = await exigirGestao(bruto?.id ? "editar" : "criar");
    const d = diagnosticoSchema.parse(bruto);
    const fatores = itensDoTipo(d.tipo, d.itens);
    const id = await transacao(escopoTx(ctx), async (tx) => {
      if (d.areaIds.length && (await tx.area.count({ where: { id: { in: d.areaIds } } })) !== d.areaIds.length) throw new ErroAcesso("Departamento inválido.");
      if (d.colaboradorIds.length && (await tx.colaborador.count({ where: { id: { in: d.colaboradorIds } } })) !== d.colaboradorIds.length) throw new ErroAcesso("Colaborador inválido.");
      const dados = {
        titulo: d.titulo,
        descricao: d.descricao,
        tipo: d.tipo,
        audienciaTipo: d.audienciaTipo,
        areaIds: d.audienciaTipo === "departamentos" ? d.areaIds : [],
        colaboradorIds: d.audienciaTipo === "colaboradores" ? d.colaboradorIds : [],
        dataInicio: d.dataInicio ? dataDeTexto(d.dataInicio) : null,
        encerraEm: d.encerraEm ? dataDeTexto(d.encerraEm) : null,
        coletarDepartamento: d.coletarDepartamento,
        mensagemConvite: d.mensagemConvite,
        faixas: d.faixas,
      };
      let cicloId = d.id ?? null;
      if (cicloId) {
        const atual = await ciclo(tx, cicloId);
        if (atual.status !== "rascunho") throw new ErroAcesso("Depois de ativada, a pesquisa não pode ser alterada.");
        await tx.cicloNr1.update({ where: { id: cicloId }, data: dados });
        await tx.dimensaoNr1.deleteMany({ where: { cicloId } });
      } else {
        cicloId = (await tx.cicloNr1.create({ data: { ...dados, tenantId: ctx.org.id, criadoPor: ctx.usuario.nome, metodologiaVersao: METODOLOGIA_VERSAO } })).id;
      }
      let ordem = 0;
      for (const [i, f] of fatores.entries()) {
        const dim = await tx.dimensaoNr1.create({ data: { tenantId: ctx.org.id, cicloId, fatorChave: f.chave, nome: f.nome, descricao: f.descricao, severidade: f.severidade, ordem: i } });
        await tx.perguntaNr1.createMany({
          data: f.itens.map((q) => ({ tenantId: ctx.org.id, cicloId: cicloId!, dimensaoId: dim.id, chave: q.chave, texto: q.texto, reversa: q.reversa, ordem: ordem++ })),
        });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: d.id ? "nr1.editar" : "nr1.criar", entidade: "ciclo_nr1", entidadeId: cicloId, detalhes: { tipo: d.tipo, perguntas: ordem } });
      return cicloId;
    });
    revalidatePath("/nr1");
    return { ok: d.id ? "Rascunho atualizado." : "Rascunho criado.", id };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Ativa: congela questionário, escala, faixas e metodologia; fixa o total de
 * elegíveis; cria um convite por pessoa. Com `enviar`, dispara os e-mails
 * (falhas por pessoa voltam para a tela; a pesquisa fica ativa mesmo sem e-mail).
 */
export async function ativarDiagnostico(id: string, enviar: boolean): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("concluir");
    const convites = await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      if (c.status !== "rascunho") throw new ErroAcesso("A pesquisa já foi ativada.");
      if (!(await tx.perguntaNr1.count({ where: { cicloId: c.id } }))) throw new ErroAcesso("O questionário está vazio.");
      const h = hoje();
      if (c.encerraEm && c.encerraEm < h) throw new ErroAcesso("A data de fim já passou.");
      const pessoas = await membros(tx, c);
      if (!pessoas.length) throw new ErroAcesso("A audiência não tem nenhum colaborador ativo.");
      await tx.cicloNr1.update({
        where: { id: c.id },
        data: { status: "aberto", abertoEm: new Date(), dataInicio: c.dataInicio ?? h, publicoTotal: pessoas.length, escala: { itens: ESCALA_NR1, semResposta: SEM_RESPOSTA } },
      });
      await tx.conviteNr1.createMany({ data: pessoas.map((p) => ({ tenantId: ctx.org.id, cicloId: c.id, colaboradorId: p.id })), skipDuplicates: true });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.ativar", entidade: "ciclo_nr1", entidadeId: c.id, detalhes: { elegiveis: pessoas.length } });
      return (await tx.conviteNr1.findMany({ where: { cicloId: c.id }, select: { id: true } })).map((v) => v.id);
    });
    const envio = enviar ? await enviarConvitesNr1(escopoTx(ctx), convites, false) : undefined;
    revalidatePath("/nr1");
    revalidatePath(`/nr1/${id}`);
    return { ok: "Pesquisa ativada.", id, envio };
  } catch (e) {
    return erroDe(e);
  }
}

/** Envia os convites ainda não enviados (ou que falharam). */
export async function enviarConvitesPendentes(id: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const ids = await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      if (c.status !== "aberto") throw new ErroAcesso("A pesquisa não está ativa.");
      return (await tx.conviteNr1.findMany({ where: { cicloId: c.id, enviadoEm: null }, select: { id: true } })).map((v) => v.id);
    });
    if (!ids.length) return { ok: "Todos os convites já foram enviados." };
    const envio = await enviarConvitesNr1(escopoTx(ctx), ids, false);
    revalidatePath(`/nr1/${id}`);
    return { ok: "Envio concluído.", envio };
  } catch (e) {
    return erroDe(e);
  }
}

/**
 * Lembrete a quem ainda não usou o convite. A lista vem do banco e nunca é
 * exibida: a tela recebe só totais (nomes revelariam quem respondeu).
 */
export async function enviarLembreteNr1(id: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const ids = await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      if (c.status !== "aberto") throw new ErroAcesso("A pesquisa não está ativa.");
      const r = await tx.$queryRaw<{ id: string }[]>`select public.jl_convites_pendentes_nr1(${c.id}::uuid) as id`;
      await tx.cicloNr1.update({ where: { id: c.id }, data: { lembreteEm: new Date() } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.lembrete", entidade: "ciclo_nr1", entidadeId: c.id });
      return r.map((x) => x.id);
    });
    const envio = await enviarConvitesNr1(escopoTx(ctx), ids, true);
    revalidatePath(`/nr1/${id}`);
    return { ok: `Lembrete enviado: ${envio.enviados} e-mail(s)${envio.falhas.length + envio.semEmail ? `, ${envio.falhas.length + envio.semEmail} não entregue(s)` : ""}.` };
  } catch (e) {
    return erroDe(e);
  }
}

export async function encerrarDiagnostico(id: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("concluir");
    await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      if (c.status !== "aberto") throw new ErroAcesso("A pesquisa não está ativa.");
      await tx.cicloNr1.update({ where: { id: c.id }, data: { status: "encerrado", encerradoEm: new Date() } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.encerrar", entidade: "ciclo_nr1", entidadeId: c.id });
    });
    revalidatePath("/nr1");
    revalidatePath(`/nr1/${id}`);
    return { ok: "Pesquisa encerrada. Resultados liberados conforme as regras de proteção." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function excluirRascunhoNr1(id: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      if (c.status !== "rascunho") throw new ErroAcesso("Só rascunhos podem ser excluídos.");
      await tx.cicloNr1.delete({ where: { id: c.id } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.excluir_rascunho", entidade: "ciclo_nr1", entidadeId: c.id });
    });
    revalidatePath("/nr1");
    return { ok: "Rascunho excluído." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Revisão da matriz indicativa: severidade de referência por fator (1–3) + registro de quem revisou. */
export async function revisarMatriz(id: string, severidades: Record<string, number>): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const sev = z.record(uuid, z.number().int().min(1).max(3)).parse(severidades);
    await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      const dims = await tx.dimensaoNr1.findMany({ where: { cicloId: c.id }, select: { id: true, severidade: true } });
      for (const [dimId, s] of Object.entries(sev)) {
        if (!dims.some((d) => d.id === dimId)) throw new ErroAcesso("Fator inválido.");
        await tx.dimensaoNr1.update({ where: { id: dimId }, data: { severidade: s } });
      }
      await tx.cicloNr1.update({ where: { id: c.id }, data: { matrizRevisadaPor: ctx.usuario.nome, matrizRevisadaEm: new Date() } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.revisar_matriz", entidade: "ciclo_nr1", entidadeId: c.id, detalhes: { antes: dims, depois: sev } });
    });
    revalidatePath(`/nr1/${id}`);
    return { ok: "Matriz revisada e registrada." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Plano de ação ────────────────────────────────────────────────────────

const riscoSchema = z.object({
  cicloId: uuid,
  dimensaoId: uuid.nullable().optional(),
  titulo: z.string().trim().min(3, "Descreva o fator priorizado.").max(200),
  descricao: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  prioridade: z.enum(["alta", "media", "baixa"]),
});

export async function registrarRiscoNr1(dados: z.input<typeof riscoSchema>): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const d = riscoSchema.parse(dados);
    await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, d.cicloId);
      if (c.status !== "encerrado") throw new ErroAcesso("O plano de ação é elaborado após o encerramento da pesquisa.");
      if (d.dimensaoId && !(await tx.dimensaoNr1.findFirst({ where: { id: d.dimensaoId, cicloId: c.id } }))) throw new ErroAcesso("Fator inválido.");
      const r = await tx.riscoNr1.create({
        data: { tenantId: ctx.org.id, cicloId: c.id, dimensaoId: d.dimensaoId ?? null, titulo: d.titulo, descricao: d.descricao, prioridade: d.prioridade, origem: "humano", revisadoPor: ctx.usuario.nome, revisadoEm: new Date(), criadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.risco.criar", entidade: "risco_nr1", entidadeId: r.id });
    });
    revalidatePath(`/nr1/${d.cicloId}`);
    return { ok: "Fator priorizado registrado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarStatusRiscoNr1(riscoId: string, status: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const st = z.enum(["identificado", "em_tratamento", "monitorado", "encerrado"]).parse(status);
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const r = await tx.riscoNr1.findUnique({ where: { id: uuid.parse(riscoId) } });
      if (!r) throw new ErroAcesso("Fator não encontrado.");
      await tx.riscoNr1.update({ where: { id: r.id }, data: { status: st } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.risco.status", entidade: "risco_nr1", entidadeId: r.id, detalhes: { de: r.status, para: st } });
      return r.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Status atualizado." };
  } catch (e) {
    return erroDe(e);
  }
}

const acaoSchema = z.object({
  riscoId: uuid,
  titulo: z.string().trim().min(3, "Descreva a ação.").max(300),
  responsavelNome: z.string().trim().min(2, "Informe o responsável.").max(120),
  prazo: dataOpc,
});

export async function adicionarAcaoNr1(dados: z.input<typeof acaoSchema>): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const d = acaoSchema.parse(dados);
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const r = await tx.riscoNr1.findUnique({ where: { id: d.riscoId } });
      if (!r) throw new ErroAcesso("Fator não encontrado.");
      const a = await tx.acaoNr1.create({
        data: { tenantId: ctx.org.id, riscoId: r.id, titulo: d.titulo, responsavelNome: d.responsavelNome, prazo: d.prazo ? dataDeTexto(d.prazo) : null, origem: "humano", revisadoPor: ctx.usuario.nome, revisadoEm: new Date(), criadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.acao.criar", entidade: "acao_nr1", entidadeId: a.id });
      return r.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Ação incluída no plano." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function atualizarAcaoNr1(acaoId: string, status: string, evidencia: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const st = z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).parse(status);
    const ev = z.string().trim().max(2000).parse(evidencia) || null;
    const cicloId = await transacao(escopoTx(ctx), async (tx) => {
      const a = await tx.acaoNr1.findUnique({ where: { id: uuid.parse(acaoId) }, include: { risco: { select: { cicloId: true } } } });
      if (!a) throw new ErroAcesso("Ação não encontrada.");
      if (st === "concluida" && !ev && !a.evidencia) throw new ErroAcesso("Registre a evidência de acompanhamento para concluir a ação.");
      await tx.acaoNr1.update({ where: { id: a.id }, data: { status: st, evidencia: ev ?? a.evidencia, concluidaEm: st === "concluida" ? (a.concluidaEm ?? new Date()) : null } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.acao.atualizar", entidade: "acao_nr1", entidadeId: a.id, detalhes: { de: a.status, para: st } });
      return a.risco.cicloId;
    });
    revalidatePath(`/nr1/${cicloId}`);
    return { ok: "Ação atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── IA: sugestões em prévia, plano só com revisão humana ─────────────────

const sugestoesSchema = z.object({
  resumo_executivo: z.string().min(1).max(3000),
  fatores_investigar: z.array(z.object({ fator: z.string().max(120), motivo: z.string().max(600) })).max(13),
  hipoteses: z.array(z.string().max(600)).max(10),
  medidas: z.array(z.string().max(600)).max(12),
  plano_acao: z.array(z.object({ fator: z.string().max(120), acao: z.string().max(400), prazo_sugerido: z.string().max(80), responsavel_sugerido: z.string().max(120) })).max(15),
});
export type SugestoesNr1 = z.infer<typeof sugestoesSchema>;

/**
 * Envia à IA SOMENTE agregados que passaram pelas regras de proteção (fatores
 * com score exibível e recortes liberados). Sem respostas individuais, sem
 * texto livre, sem nomes ou e-mails. O resultado fica em prévia no diagnóstico.
 */
export async function gerarSugestoesNr1(id: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    if (!iaDisponivel()) throw new ErroAcesso("A integração de IA não está configurada. A análise manual continua disponível.");
    const c = await transacao(escopoTx(ctx), (tx) => tx.cicloNr1.findUnique({ where: { id: uuid.parse(id) }, include: { dimensoes: { orderBy: { ordem: "asc" } } } }));
    if (!c) throw new ErroAcesso("Diagnóstico não encontrado.");
    const org = await resultadoNr1(ctx, c.id, null);
    if (!org.resumo?.liberado) throw new ErroAcesso("Os resultados ainda não estão disponíveis (encerramento e mínimo de respostas).");
    const nome = (dimId: string) => c.dimensoes.find((d) => d.id === dimId)?.nome ?? "";
    const fatores = org.fatores.filter((f) => f.score !== null).map((f) => ({ fator: nome(f.dimensao_id), score_exposicao: f.score, faixa: faixaDe(f.score!, c.faixas).nome }));
    const sugestoes = await completarJson({
      sistema:
        "Você apoia equipes de RH e de Segurança e Saúde no Trabalho a analisar resultados AGREGADOS de uma pesquisa sobre fatores de risco psicossociais relacionados ao trabalho. " +
        "Scores de 0 a 100 indicam frequência de exposição relatada (maior = mais exposição); são indicativos, não laudo. " +
        "Retorne somente JSON: { resumo_executivo, fatores_investigar[{fator, motivo}], hipoteses[], medidas[], plano_acao[{fator, acao, prazo_sugerido, responsavel_sugerido}] }. " +
        "Regras: escreva em português do Brasil; foque em condições e organização do trabalho; hipóteses são coisas a VERIFICAR, não conclusões; " +
        "não diagnostique saúde mental de pessoas; não afirme causalidade; não declare conformidade ou não conformidade legal; não redija o PGR; " +
        "não invente dados além dos fornecidos; responsáveis sugeridos são funções (ex.: RH, liderança, SST), nunca pessoas.",
      usuario: JSON.stringify({ pesquisa: c.titulo, respostas_consideradas: org.resumo.respondentes, metodologia: c.metodologiaVersao, fatores, limitacoes: LIMITACOES }),
      schema: sugestoesSchema,
      maxTokens: 3000,
    });
    await transacao(escopoTx(ctx), async (tx) => {
      await tx.cicloNr1.update({ where: { id: c.id }, data: { aiSugestoes: sugestoes, aiSugestoesEm: new Date() } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.ia.sugestoes", entidade: "ciclo_nr1", entidadeId: c.id, detalhes: { fatores: fatores.length } });
    });
    revalidatePath(`/nr1/${id}`);
    return { ok: "Sugestões geradas. Revise antes de incluir no plano." };
  } catch (e) {
    return erroDe(e);
  }
}

const aprovacaoSchema = z
  .array(
    z.object({
      dimensaoId: uuid.nullable(),
      titulo: z.string().trim().min(3).max(200),
      prioridade: z.enum(["alta", "media", "baixa"]),
      acoes: z.array(z.object({ titulo: z.string().trim().min(3).max(300), responsavelNome: z.string().trim().min(2).max(120), prazo: dataOpc })).min(1).max(10),
    }),
  )
  .min(1, "Selecione ao menos uma ação para incluir no plano.")
  .max(15);

/** Inclui no plano as sugestões REVISADAS (editadas/selecionadas) — origem IA, com revisor e data. */
export async function aprovarSugestoesNr1(id: string, itensJson: string): Promise<RespostaNr1> {
  try {
    const { ctx } = await exigirGestao("editar");
    const itens = aprovacaoSchema.parse(JSON.parse(itensJson));
    await transacao(escopoTx(ctx), async (tx) => {
      const c = await ciclo(tx, id);
      if (c.status !== "encerrado") throw new ErroAcesso("O plano de ação é elaborado após o encerramento.");
      const dims = new Set((await tx.dimensaoNr1.findMany({ where: { cicloId: c.id }, select: { id: true } })).map((d) => d.id));
      const agora = new Date();
      for (const it of itens) {
        if (it.dimensaoId && !dims.has(it.dimensaoId)) throw new ErroAcesso("Fator inválido.");
        const r = await tx.riscoNr1.create({
          data: { tenantId: ctx.org.id, cicloId: c.id, dimensaoId: it.dimensaoId, titulo: it.titulo, prioridade: it.prioridade, origem: "ia", revisadoPor: ctx.usuario.nome, revisadoEm: agora, criadoPor: ctx.usuario.nome },
        });
        await tx.acaoNr1.createMany({
          data: it.acoes.map((a) => ({ tenantId: ctx.org.id, riscoId: r.id, titulo: a.titulo, responsavelNome: a.responsavelNome, prazo: a.prazo ? dataDeTexto(a.prazo) : null, origem: "ia", revisadoPor: ctx.usuario.nome, revisadoEm: agora, criadoPor: ctx.usuario.nome })),
        });
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "nr1.ia.aprovar", entidade: "ciclo_nr1", entidadeId: c.id, detalhes: { itens } });
    });
    revalidatePath(`/nr1/${id}`);
    return { ok: "Sugestões revisadas incluídas no plano de ação." };
  } catch (e) {
    return erroDe(e);
  }
}
