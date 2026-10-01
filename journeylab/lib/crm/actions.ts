"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, pode, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { enviarArquivo, removerArquivo, TAMANHO_MAXIMO, tipoRealCurriculo, TIPOS_CURRICULO } from "@/lib/storage";
import { buscarDuplicidades, filtroCandidatos } from "./consultas";
import { normalizarEmail, normalizarLinkedin, normalizarTelefone, normalizarTexto, STATUS_CANDIDATURA } from "./normalizar";
import { criarOnboardingAutomatico } from "@/lib/onboarding/servico";
import { dataDeTexto } from "@/lib/datas";
import type { EstadoForm } from "@/lib/auth/actions";
import type { Tx } from "@/lib/db";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Registro duplicado (já existe um igual nesta organização)." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const texto = z.string().trim().transform((v) => v || null);
const uuidOpcional = z.string().trim().transform((v) => (v === "" ? null : v)).pipe(z.string().uuid().nullable());
const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });

/** Carrega o candidato respeitando organização (RLS) e escopo do papel. */
async function candidatoVisivel(tx: Tx, ctx: Contexto, id: string, escopo: Parameters<typeof filtroCandidatos>[1]) {
  const c = await tx.candidato.findFirst({ where: { AND: [{ id }, filtroCandidatos(ctx, escopo)] } });
  if (!c) throw new ErroAcesso("Candidato não encontrado.");
  return c;
}

async function registrar(tx: Tx, ctx: Contexto, candidatoId: string, textoRegistro: string, tipo: "sistema" | "nota" = "sistema") {
  await tx.interacaoCandidato.create({
    data: { tenantId: ctx.org.id, candidatoId, tipo, texto: textoRegistro, autorId: ctx.usuario.id, autorNome: ctx.usuario.nome },
  });
}

async function aplicarTags(tx: Tx, ctx: Contexto, candidatoId: string, bruto: string) {
  const nomes = [...new Set(bruto.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  await tx.candidatoTag.deleteMany({ where: { candidatoId } });
  for (const nome of nomes) {
    const tag = await tx.tag.upsert({
      where: { tenantId_nome: { tenantId: ctx.org.id, nome } },
      update: {},
      create: { tenantId: ctx.org.id, nome },
    });
    await tx.candidatoTag.create({ data: { tenantId: ctx.org.id, candidatoId, tagId: tag.id } });
  }
}

// ─── Candidatos ───────────────────────────────────────────────────────────

const candidatoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do candidato."),
  email: z.string().trim().toLowerCase().transform((v) => v || null).pipe(z.string().email("E-mail inválido.").nullable()),
  telefone: texto,
  cidade: texto,
  uf: z.string().trim().toUpperCase().max(2, "UF com 2 letras.").transform((v) => v || null),
  linkedin: texto,
  experiencia: texto,
  observacoes: texto,
  origem: texto,
  baseLegal: texto,
});

export async function salvarCandidato(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let novoId: string | null = null;
  try {
    const id = uuidOpcional.parse(fd.get("id") ?? "");
    const { ctx, escopo } = await exigirPermissaoAcao("crm", id ? "editar" : "criar");
    const d = candidatoSchema.parse(Object.fromEntries(fd));
    const competencias = String(fd.get("competencias") ?? "")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);
    const dados = {
      ...d,
      competencias,
      nomeNorm: normalizarTexto(d.nome),
      emailNorm: normalizarEmail(d.email),
      telefoneNorm: normalizarTelefone(d.telefone),
      linkedinNorm: normalizarLinkedin(d.linkedin),
    };
    const resultado = await transacao(escopoTx(ctx), async (tx) => {
      if (id) await candidatoVisivel(tx, ctx, id, escopo);
      const duplicados = await buscarDuplicidades(tx, d, id ?? undefined);
      // Duplicidade forte (e-mail/telefone/LinkedIn) exige confirmação explícita.
      const fortes = duplicados.filter((x) => /e-mail|telefone|LinkedIn/.test(x.motivo));
      if (fortes.length && fd.get("confirmarDuplicidade") !== "on") {
        return { duplicados: fortes };
      }
      if (id) {
        await tx.candidato.update({ where: { id }, data: dados });
        await aplicarTags(tx, ctx, id, String(fd.get("tags") ?? ""));
        await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "crm.candidato.editar", entidade: "candidato", entidadeId: id });
        return { id };
      }
      const c = await tx.candidato.create({ data: { ...dados, tenantId: ctx.org.id, criadoPor: ctx.usuario.nome } });
      await aplicarTags(tx, ctx, c.id, String(fd.get("tags") ?? ""));
      await registrar(tx, ctx, c.id, `Cadastro criado${fortes.length ? ` (confirmado apesar de possível duplicidade com ${fortes.map((f) => f.nome).join(", ")})` : ""}.`);
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "crm.candidato.criar", entidade: "candidato", entidadeId: c.id });
      return { id: c.id, novo: true };
    });
    if ("duplicados" in resultado) {
      return {
        erro: `Possível duplicidade: ${resultado.duplicados!.map((x) => `${x.nome} (${x.motivo})`).join("; ")}. Confira antes de continuar ou marque “Cadastrar mesmo assim”.`,
        campos: { duplicidade: "sim" },
      };
    }
    if ("novo" in resultado) novoId = resultado.id;
    revalidatePath("/crm");
  } catch (e) {
    return erroDe(e);
  }
  if (novoId) redirect(`/crm/candidatos/${novoId}`);
  return { ok: "Candidato atualizado." };
}

export async function adicionarInteracao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "criar");
    const candidatoId = z.string().uuid().parse(fd.get("candidatoId"));
    const tipo = z.enum(["nota", "ligacao", "email", "entrevista"]).parse(fd.get("tipo"));
    const conteudo = z.string().trim().min(2, "Escreva o registro.").max(5000).parse(fd.get("texto"));
    await transacao(escopoTx(ctx), async (tx) => {
      await candidatoVisivel(tx, ctx, candidatoId, escopo);
      await tx.interacaoCandidato.create({
        data: { tenantId: ctx.org.id, candidatoId, tipo, texto: conteudo, autorId: ctx.usuario.id, autorNome: ctx.usuario.nome },
      });
    });
    revalidatePath(`/crm/candidatos/${candidatoId}`);
    return { ok: "Registro adicionado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function enviarAnexo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const candidatoId = z.string().uuid().parse(fd.get("candidatoId"));
    const tipo = z.enum(["curriculo", "outro"]).parse(fd.get("tipo"));
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo." };
    if (arquivo.size > TAMANHO_MAXIMO) return { erro: "Arquivo acima de 10 MB." };
    const real = await tipoRealCurriculo(arquivo);
    if (!real || !TIPOS_CURRICULO[real]) return { erro: "Formato não aceito. Envie PDF, DOC ou DOCX." };

    await transacao(escopoTx(ctx), async (tx) => {
      await candidatoVisivel(tx, ctx, candidatoId, escopo);
      const caminho = await enviarArquivo(ctx.org.id, `crm/${candidatoId}`, arquivo);
      await tx.anexoCandidato.create({
        data: { tenantId: ctx.org.id, candidatoId, tipo, nomeArquivo: arquivo.name.slice(0, 200), caminho, tamanho: arquivo.size, mime: real, enviadoPor: ctx.usuario.nome },
      });
      await registrar(tx, ctx, candidatoId, `${tipo === "curriculo" ? "Currículo" : "Anexo"} enviado: ${arquivo.name}.`);
    });
    revalidatePath(`/crm/candidatos/${candidatoId}`);
    return { ok: "Arquivo enviado." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function removerAnexo(anexoId: string) {
  const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
  const caminho = await transacao(escopoTx(ctx), async (tx) => {
    const a = await tx.anexoCandidato.findUnique({ where: { id: anexoId } });
    if (!a) throw new ErroAcesso("Anexo não encontrado.");
    await candidatoVisivel(tx, ctx, a.candidatoId, escopo);
    await tx.anexoCandidato.delete({ where: { id: anexoId } });
    await registrar(tx, ctx, a.candidatoId, `Anexo removido: ${a.nomeArquivo}.`);
    await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "crm.anexo.remover", entidade: "anexo", entidadeId: anexoId });
    return { caminho: a.caminho, candidatoId: a.candidatoId };
  });
  await removerArquivo(caminho.caminho);
  revalidatePath(`/crm/candidatos/${caminho.candidatoId}`);
}

// ─── Vagas e candidaturas ─────────────────────────────────────────────────
// Criação/edição/publicação de vagas: lib/carreiras/actions.ts (Página de Carreiras).

export async function associarVaga(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const candidatoId = z.string().uuid().parse(fd.get("candidatoId"));
    const vagaId = z.string().uuid("Selecione a vaga.").parse(fd.get("vagaId"));
    await transacao(escopoTx(ctx), async (tx) => {
      await candidatoVisivel(tx, ctx, candidatoId, escopo);
      const vaga = await tx.vaga.findUnique({ where: { id: vagaId } });
      if (!vaga) throw new ErroAcesso("Vaga inválida.");
      await tx.candidatura.create({ data: { tenantId: ctx.org.id, vagaId, candidatoId } });
      await registrar(tx, ctx, candidatoId, `Associado à vaga “${vaga.titulo}”.`);
    });
    revalidatePath(`/crm/candidatos/${candidatoId}`);
    return { ok: "Candidato associado à vaga." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarCandidatura(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const id = z.string().uuid().parse(fd.get("id"));
    const status = z.enum(Object.keys(STATUS_CANDIDATURA) as [keyof typeof STATUS_CANDIDATURA]).parse(fd.get("status"));
    const observacao = texto.parse(fd.get("observacao") ?? "");
    const candidatoId = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.candidatura.findUnique({ where: { id }, include: { vaga: { select: { titulo: true } } } });
      if (!c) throw new ErroAcesso("Candidatura não encontrada.");
      await candidatoVisivel(tx, ctx, c.candidatoId, escopo);
      await tx.candidatura.update({ where: { id }, data: { status, observacao } });
      if (c.status !== status) {
        await registrar(tx, ctx, c.candidatoId, `Vaga “${c.vaga.titulo}”: ${STATUS_CANDIDATURA[c.status].nome} → ${STATUS_CANDIDATURA[status].nome}.`);
      }
      return c.candidatoId;
    });
    revalidatePath(`/crm/candidatos/${candidatoId}`);
    return { ok: "Situação atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Kanban: move a candidatura para outra etapa (mesma regra e histórico de alterarCandidatura). */
export async function moverCandidatura(id: string, status: string): Promise<{ ok?: string; erro?: string }> {
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "editar");
    const novo = z.enum(Object.keys(STATUS_CANDIDATURA) as [keyof typeof STATUS_CANDIDATURA]).parse(status);
    const candidatoId = await transacao(escopoTx(ctx), async (tx) => {
      const c = await tx.candidatura.findUnique({ where: { id: z.string().uuid().parse(id) }, include: { vaga: { select: { titulo: true } } } });
      if (!c) throw new ErroAcesso("Candidatura não encontrada.");
      await candidatoVisivel(tx, ctx, c.candidatoId, escopo);
      if (c.status === novo) return c.candidatoId;
      await tx.candidatura.update({ where: { id: c.id }, data: { status: novo } });
      await registrar(tx, ctx, c.candidatoId, `Vaga “${c.vaga.titulo}”: ${STATUS_CANDIDATURA[c.status].nome} → ${STATUS_CANDIDATURA[novo].nome} (Kanban).`);
      return c.candidatoId;
    });
    revalidatePath("/crm");
    revalidatePath(`/crm/candidatos/${candidatoId}`);
    return { ok: `Movido para “${STATUS_CANDIDATURA[novo].nome}”.` };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Conversão em colaborador ─────────────────────────────────────────────

/**
 * Ação explícita e autorizada: exige CRM › Concluir E Cadastro › Criar.
 * Cria (ou vincula a um existente, evitando duplicidade) o colaborador,
 * preserva o histórico do candidato e, se o Onboarding estiver ativo e for
 * solicitado, inicia o onboarding a partir de um modelo.
 */
export async function converterEmColaborador(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let colaboradorId: string;
  let avisoOnboarding = "";
  try {
    const { ctx, escopo } = await exigirPermissaoAcao("crm", "concluir");
    if (pode(ctx, "cadastro", "criar") !== "todos") throw new ErroAcesso("Seu papel não permite criar colaboradores no cadastro.");
    const candidatoId = z.string().uuid().parse(fd.get("candidatoId"));
    const modo = z.enum(["novo", "vincular"]).parse(fd.get("modo"));
    const existenteId = uuidOpcional.parse(fd.get("colaboradorExistenteId") ?? "");
    const candidaturaId = uuidOpcional.parse(fd.get("candidaturaId") ?? "");
    const cargo = texto.parse(fd.get("cargo") ?? "");
    const equipeId = uuidOpcional.parse(fd.get("equipeId") ?? "");
    const gestorId = uuidOpcional.parse(fd.get("gestorId") ?? "");
    const dataAdmissao = z.string().trim().min(10, "Informe a data de admissão.").parse(fd.get("dataAdmissao"));
    const escolhaOnboarding = String(fd.get("modeloOnboardingId") ?? "auto");
    const modeloOnboardingId = escolhaOnboarding === "auto" || escolhaOnboarding === "nao" ? null : z.string().uuid().parse(escolhaOnboarding);

    colaboradorId = await transacao(escopoTx(ctx), async (tx) => {
      const cand = await candidatoVisivel(tx, ctx, candidatoId, escopo);
      const jaConvertido = await tx.colaborador.findUnique({ where: { candidatoOrigemId: candidatoId } });
      if (jaConvertido) throw new ErroAcesso("Este candidato já foi convertido em colaborador.");
      const equipe = equipeId ? await tx.equipe.findUnique({ where: { id: equipeId } }) : null;
      if (equipeId && !equipe) throw new ErroAcesso("Equipe inválida.");
      if (gestorId && !(await tx.colaborador.findUnique({ where: { id: gestorId } }))) throw new ErroAcesso("Gestor inválido.");

      let colab;
      if (modo === "vincular") {
        if (!existenteId) throw new ErroAcesso("Selecione o colaborador existente.");
        colab = await tx.colaborador.findUnique({ where: { id: existenteId } });
        if (!colab) throw new ErroAcesso("Colaborador inválido.");
        if (colab.candidatoOrigemId) throw new ErroAcesso("Este colaborador já está vinculado a outro candidato.");
        colab = await tx.colaborador.update({ where: { id: colab.id }, data: { candidatoOrigemId: candidatoId } });
      } else {
        if (cand.emailNorm && (await tx.colaborador.findUnique({ where: { tenantId_email: { tenantId: ctx.org.id, email: cand.emailNorm } } }))) {
          throw new ErroAcesso("Já existe um colaborador com este e-mail. Use “Vincular a colaborador existente”.");
        }
        colab = await tx.colaborador.create({
          data: {
            tenantId: ctx.org.id,
            nome: cand.nome,
            email: cand.emailNorm,
            cargo,
            equipeId,
            gestorId: gestorId ?? equipe?.gestorId ?? null,
            dataAdmissao: dataDeTexto(dataAdmissao),
            status: "pre_admissao",
            candidatoOrigemId: candidatoId,
          },
        });
      }

      if (candidaturaId) {
        const cd = await tx.candidatura.findFirst({ where: { id: candidaturaId, candidatoId } });
        if (cd && cd.status !== "contratado") await tx.candidatura.update({ where: { id: cd.id }, data: { status: "contratado" } });
      }
      await registrar(tx, ctx, candidatoId, `Convertido em colaborador (${modo === "novo" ? "novo cadastro" : "vinculado a cadastro existente"}): ${colab.nome}.`);
      await auditar(tx, {
        tenantId: ctx.org.id,
        usuario: quem(ctx),
        acao: "crm.converter_colaborador",
        entidade: "candidato",
        entidadeId: candidatoId,
        detalhes: { colaboradorId: colab.id, modo },
      });

      return colab.id;
    });
    // Onboarding (se contratado): mesma criação automática do cadastro, em transação própria.
    if (ctx.modulos.has("onboarding") && escolhaOnboarding !== "nao") {
      const r = await criarOnboardingAutomatico({ tenantId: ctx.org.id, usuario: quem(ctx) }, colaboradorId, "crm", modeloOnboardingId);
      avisoOnboarding = r.situacao === "erro" ? `erro&motivo=${encodeURIComponent(r.mensagem.slice(0, 300))}` : r.situacao;
    }
  } catch (e) {
    return erroDe(e);
  }
  revalidatePath("/crm");
  revalidatePath("/colaboradores");
  revalidatePath("/onboarding");
  redirect(`/colaboradores/${colaboradorId}${avisoOnboarding ? `?onboarding=${avisoOnboarding}` : ""}`);
}
