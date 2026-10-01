"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transacao, type Tx } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { emailValido, enviarEmail, esc } from "@/lib/email";
import { dataDeTexto, hoje } from "@/lib/datas";
import { formatarData } from "@/lib/formato";
import { CHAVES_MOTIVO, TIPO_DESLIGAMENTO, type Motivo, type TipoDesligamento } from "./motivos";
import { gravarRespostas } from "./servico";
import { urlEntrevista } from "./links";

export type RespostaOffboarding = { ok?: string; erro?: string; id?: string };

const PRAZO_ENTREVISTA_DIAS = 30;

function erroDe(e: unknown): RespostaOffboarding {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  const msg = e instanceof Error ? e.message : "";
  return { erro: msg && !/prisma|invocation/i.test(msg) ? msg : "Não foi possível concluir. Tente novamente." };
}

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });
const uuid = z.string().uuid();

const registroSchema = z.object({
  colaboradorId: uuid,
  data: z.string().trim().min(1, "Informe a data do desligamento."),
  tipo: z.enum(Object.keys(TIPO_DESLIGAMENTO) as [TipoDesligamento, ...TipoDesligamento[]], { message: "Escolha o tipo de desligamento." }),
  voluntario: z.boolean(),
  motivoDeclarado: z.enum(CHAVES_MOTIVO as [Motivo, ...Motivo[]], { message: "Escolha o motivo informado." }),
  observacao: z
    .string()
    .trim()
    .max(3000)
    .optional()
    .nullable()
    .transform((v) => v || null),
  perdaLamentada: z.boolean(),
  elegivelRecontratacao: z.boolean().nullable(),
  emailContato: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .transform((v) => v || null)
    .pipe(z.string().email("E-mail pessoal inválido.").nullable()),
});

/**
 * Registra o desligamento: fotografa cargo, equipe, área, gestor e admissão (os
 * indicadores não mudam quando o cadastro mudar), marca a pessoa como desligada e
 * deixa a entrevista pendente. Só RH/Admin (escopo "todos" no Offboarding).
 */
export async function registrarDesligamento(dados: z.input<typeof registroSchema>): Promise<RespostaOffboarding> {
  try {
    const { ctx } = await exigirPermissaoAcao("offboarding", "criar");
    const d = registroSchema.parse(dados);
    const data = dataDeTexto(d.data);
    if (data > hoje()) throw new ErroAcesso("Registre o desligamento na data efetiva (hoje ou antes).");
    const id = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.colaborador.findUnique({
        where: { id: d.colaboradorId },
        include: { equipe: { include: { area: true } }, gestor: { select: { id: true, nome: true } } },
      });
      if (!c) throw new ErroAcesso("Colaborador não encontrado nesta organização.");
      if (c.status === "pre_admissao") throw new ErroAcesso("Pessoa em pré-admissão: altere o cadastro em vez de registrar desligamento.");
      if (c.dataAdmissao && data < c.dataAdmissao) throw new ErroAcesso("A data do desligamento é anterior à admissão.");
      const existente = await tx.desligamento.findFirst({ where: { colaboradorId: c.id, ...(c.dataAdmissao ? { data: { gte: c.dataAdmissao } } : {}) } });
      if (existente) throw new ErroAcesso("Já existe um desligamento registrado para este vínculo.");
      const r = await tx.desligamento.create({
        data: {
          tenantId: ctx.org.id,
          colaboradorId: c.id,
          data,
          tipo: d.tipo,
          voluntario: d.voluntario,
          motivoDeclarado: d.motivoDeclarado,
          observacao: d.observacao,
          perdaLamentada: d.perdaLamentada,
          elegivelRecontratacao: d.elegivelRecontratacao,
          cargo: c.cargo,
          equipeId: c.equipeId,
          equipeNome: c.equipe?.nome ?? null,
          areaId: c.equipe?.areaId ?? null,
          areaNome: c.equipe?.area?.nome ?? null,
          gestorId: c.gestor?.id ?? null,
          gestorNome: c.gestor?.nome ?? null,
          admissao: c.dataAdmissao,
          emailContato: d.emailContato,
          registradoPor: ctx.usuario.nome,
          registradoPorId: ctx.usuario.id,
        },
      });
      // Data civil como instante de desligamento (meio-dia UTC evita troca de dia no fuso).
      await tx.colaborador.update({ where: { id: c.id }, data: { status: "desligado", desligadoEm: new Date(data.getTime() + 12 * 3600_000) } });
      await auditar(tx, {
        tenantId: ctx.org.id,
        usuario: quem(ctx),
        acao: "offboarding.registrar",
        entidade: "desligamento",
        entidadeId: r.id,
        detalhes: { colaborador: c.nome, data: d.data, tipo: d.tipo, voluntario: d.voluntario },
      });
      return r.id;
    });
    revalidatePath("/offboarding");
    revalidatePath("/colaboradores");
    return { ok: "Desligamento registrado. Agora conduza ou envie a entrevista de desligamento.", id };
  } catch (e) {
    return erroDe(e);
  }
}

async function carregar(tx: Tx, id: string) {
  const r = await tx.desligamento.findUnique({ where: { id: uuid.parse(id) }, include: { colaborador: { select: { nome: true, email: true } } } });
  if (!r) throw new ErroAcesso("Desligamento não encontrado.");
  return r;
}

/** Ajusta dados do registro (não altera a entrevista). */
export async function atualizarDesligamento(id: string, dados: Omit<z.input<typeof registroSchema>, "colaboradorId" | "data">): Promise<RespostaOffboarding> {
  try {
    const { ctx } = await exigirPermissaoAcao("offboarding", "editar");
    const d = registroSchema.omit({ colaboradorId: true, data: true }).parse(dados);
    await transacao(escopoTx(ctx), async (tx) => {
      const r = await carregar(tx, id);
      await tx.desligamento.update({
        where: { id: r.id },
        data: {
          tipo: d.tipo,
          voluntario: d.voluntario,
          motivoDeclarado: d.motivoDeclarado,
          observacao: d.observacao,
          perdaLamentada: d.perdaLamentada,
          elegivelRecontratacao: d.elegivelRecontratacao,
          emailContato: d.emailContato,
        },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "offboarding.editar", entidade: "desligamento", entidadeId: r.id });
    });
    revalidatePath(`/offboarding/${id}`);
    revalidatePath("/offboarding");
    return { ok: "Registro atualizado." };
  } catch (e) {
    return erroDe(e);
  }
}

type Org = { nome: string; corMarca: string | null; logoUrl: string | null };
const corSegura = (c: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#0B1F3A");
const logoSeguro = (u: string | null) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

function emailEntrevista(org: Org, nome: string, link: string, expira: Date) {
  const cor = corSegura(org.corMarca);
  const logo = logoSeguro(org.logoUrl);
  const primeiro = nome.split(" ")[0];
  const assunto = `Sua opinião sobre a experiência na ${org.nome}`;
  const corpo = `Obrigado pelo tempo em que esteve com a gente. Queremos entender, com franqueza, o que levou à sua saída e o que podemos melhorar. São cerca de 5 minutos.`;
  const privacidade = `As respostas são lidas apenas pela equipe de RH, de forma confidencial — não são compartilhadas com a sua liderança direta — e usadas para melhorar a experiência de quem fica.`;
  const texto = [`Olá, ${primeiro}.`, "", corpo, privacidade, "", `Responder: ${link}`, `O link é pessoal e vale até ${formatarData(expira)}.`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1F3A">
    <div style="background:${cor};padding:20px 24px;border-radius:12px 12px 0 0">
      ${logo ? `<img src="${esc(logo)}" alt="${esc(org.nome)}" style="max-height:36px">` : `<strong style="color:#fff;font-size:18px">${esc(org.nome)}</strong>`}
    </div>
    <div style="border:1px solid #E2E8EE;border-top:0;padding:24px;border-radius:0 0 12px 12px">
      <p>Olá, ${esc(primeiro)}.</p>
      <p>${esc(corpo)}</p>
      <p style="color:#526173;font-size:13px">${esc(privacidade)}</p>
      <p style="margin:28px 0"><a href="${esc(link)}" style="background:${cor};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Responder entrevista</a></p>
      <p style="color:#526173;font-size:12px">O link é pessoal e vale até ${esc(formatarData(expira))} — não o encaminhe. Enviado pelo JourneyLab em nome de ${esc(org.nome)}.</p>
    </div></div>`;
  return { assunto, texto, html };
}

/**
 * Envia (ou reenvia) o link da entrevista ao e-mail informado — de preferência o
 * pessoal, pois o corporativo costuma ser desativado na saída. Reenviar invalida
 * o link anterior.
 */
export async function enviarEntrevista(id: string, email: string): Promise<RespostaOffboarding> {
  try {
    const { ctx } = await exigirPermissaoAcao("offboarding", "editar");
    const destino = email.trim().toLowerCase();
    if (!emailValido(destino)) throw new ErroAcesso("Informe um e-mail válido para enviar a entrevista.");
    const agora = new Date();
    const expira = new Date(agora.getTime() + PRAZO_ENTREVISTA_DIAS * 86_400_000);
    const { r, org } = await transacao(escopoTx(ctx), async (tx) => {
      const r = await carregar(tx, id);
      if (r.entrevistaStatus === "respondida") throw new ErroAcesso("A entrevista já foi respondida.");
      const org = await tx.organizacao.findUnique({ where: { id: ctx.org.id }, select: { nome: true, corMarca: true, logoUrl: true } });
      await tx.desligamento.update({
        where: { id: r.id },
        data: { entrevistaStatus: "enviada", entrevistaModo: "link", emailContato: destino, entrevistaEnviadaEm: agora, entrevistaExpiraEm: expira, entrevistaErro: null },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "offboarding.entrevista.enviar", entidade: "desligamento", entidadeId: r.id, detalhes: { para: destino } });
      return { r, org: org! };
    });
    try {
      await enviarEmail({ para: destino, ...emailEntrevista(org, r.colaborador.nome, urlEntrevista(r.id, agora), expira) });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "Falha no envio.";
      await transacao(escopoTx(ctx), (tx) => tx.desligamento.update({ where: { id: r.id }, data: { entrevistaErro: motivo } }));
      revalidatePath(`/offboarding/${id}`);
      return { erro: `O convite foi gerado, mas o e-mail não foi enviado: ${motivo}` };
    }
    revalidatePath(`/offboarding/${id}`);
    revalidatePath("/offboarding");
    return { ok: `Entrevista enviada para ${destino}. O link vale por ${PRAZO_ENTREVISTA_DIAS} dias.` };
  } catch (e) {
    return erroDe(e);
  }
}

/** Entrevista conduzida pelo RH (conversa presencial ou por vídeo), registrada no sistema. */
export async function registrarEntrevistaConduzida(id: string, respostasJson: string): Promise<RespostaOffboarding> {
  try {
    const { ctx } = await exigirPermissaoAcao("offboarding", "editar");
    let json: unknown;
    try {
      json = JSON.parse(respostasJson);
    } catch {
      throw new ErroAcesso("Respostas inválidas.");
    }
    await transacao(escopoTx(ctx), async (tx) => {
      const r = await carregar(tx, id);
      if (r.entrevistaStatus === "respondida") throw new ErroAcesso("A entrevista já foi respondida.");
      await gravarRespostas(tx, r.id, json, "conduzida");
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "offboarding.entrevista.conduzida", entidade: "desligamento", entidadeId: r.id });
    });
    revalidatePath(`/offboarding/${id}`);
    revalidatePath("/offboarding");
    return { ok: "Entrevista registrada." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Sem entrevista (ex.: justa causa ou recusa da pessoa) — sai das pendências. */
export async function dispensarEntrevista(id: string, motivo: string): Promise<RespostaOffboarding> {
  try {
    const { ctx } = await exigirPermissaoAcao("offboarding", "editar");
    const m = z.string().trim().min(3, "Informe o motivo.").max(300).parse(motivo);
    await transacao(escopoTx(ctx), async (tx) => {
      const r = await carregar(tx, id);
      if (r.entrevistaStatus === "respondida") throw new ErroAcesso("A entrevista já foi respondida.");
      await tx.desligamento.update({ where: { id: r.id }, data: { entrevistaStatus: "dispensada", entrevistaErro: null, entrevistaExpiraEm: null } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "offboarding.entrevista.dispensar", entidade: "desligamento", entidadeId: r.id, detalhes: { motivo: m } });
    });
    revalidatePath(`/offboarding/${id}`);
    revalidatePath("/offboarding");
    return { ok: "Entrevista marcada como não realizada." };
  } catch (e) {
    return erroDe(e);
  }
}
