"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { COOKIE_ORG, exigirSuperadminAcao, getUsuario } from "@/lib/contexto";
import { alterarEntitlement } from "@/lib/entitlements";
import { auditar } from "@/lib/auditoria";
import { criarPapeisPadrao } from "@/lib/papeis";
import { convidarParaOrganizacao } from "@/lib/convites";
import { aplicar as aplicarEventoIntegracao, processarRecebido } from "@/lib/integracoes/processar";
import type { EstadoForm } from "@/lib/auth/actions";

const MODULOS = ["crm", "onboarding", "feedback", "pulse", "pdi", "nr1"] as const;

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Já existe um registro com esse identificador." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const listaTexto = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

// ─── Organizações ─────────────────────────────────────────────────────────

export async function criarOrganizacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { usuario } = await exigirSuperadminAcao();
    const nome = z.string().trim().min(2, "Informe o nome da organização.").parse(fd.get("nome"));
    const documento = String(fd.get("documento") ?? "").trim() || null;
    const adminEmail = z.string().trim().toLowerCase().email("E-mail do administrador inválido.").parse(fd.get("adminEmail"));
    const adminNome = String(fd.get("adminNome") ?? "").trim();
    id = randomUUID();
    await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      await tx.organizacao.create({
        data: { id, nome, documento, slug: `${slugify(nome)}-${id.slice(0, 6)}`, identificadoresExternos: listaTexto(fd.get("identificadores")) },
      });
      const papeis = await criarPapeisPadrao(tx, id);
      await convidarParaOrganizacao(tx, { tenantId: id, email: adminEmail, nome: adminNome, papelId: papeis.admin_org, convidadoPor: usuario.nome });
      await auditar(tx, { tenantId: null, usuario, acao: "organizacao.criar", entidade: "organizacao", entidadeId: id, detalhes: { nome, adminEmail } });
    });
  } catch (e) {
    return erroDe(e);
  }
  redirect(`/plataforma/organizacoes/${id}`);
}

export async function editarOrganizacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { usuario } = await exigirSuperadminAcao();
    const id = z.string().uuid().parse(fd.get("id"));
    const dados = {
      nome: z.string().trim().min(2).parse(fd.get("nome")),
      documento: String(fd.get("documento") ?? "").trim() || null,
      identificadoresExternos: listaTexto(fd.get("identificadores")),
      minimoRecorte: z.coerce.number().int().min(3, "O mínimo para recortes deve ser pelo menos 3.").max(50).parse(fd.get("minimoRecorte")),
      ativa: fd.get("ativa") === "on",
      // Marca dos e-mails (white-label do Pulse).
      corMarca: z
        .string()
        .trim()
        .transform((v) => v || null)
        .pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor da marca: use o formato #RRGGBB.").nullable())
        .parse(fd.get("corMarca") ?? ""),
      logoUrl: z
        .string()
        .trim()
        .transform((v) => v || null)
        .pipe(z.string().url("Logo: informe uma URL válida.").startsWith("https://", "Logo: use uma URL https.").max(500).nullable())
        .parse(fd.get("logoUrl") ?? ""),
    };
    await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      const antes = await tx.organizacao.findUniqueOrThrow({ where: { id } });
      await tx.organizacao.update({ where: { id }, data: dados });
      await auditar(tx, { tenantId: id, usuario, acao: "organizacao.editar", entidade: "organizacao", entidadeId: id, detalhes: { antes, depois: dados } });
    });
    revalidatePath(`/plataforma/organizacoes/${id}`);
    return { ok: "Organização atualizada." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function convidarAdminOrganizacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { usuario } = await exigirSuperadminAcao();
    const tenantId = z.string().uuid().parse(fd.get("tenantId"));
    const email = z.string().trim().toLowerCase().email("E-mail inválido.").parse(fd.get("email"));
    const r = await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      const papeis = await criarPapeisPadrao(tx, tenantId);
      const r = await convidarParaOrganizacao(tx, {
        tenantId,
        email,
        nome: String(fd.get("nome") ?? ""),
        papelId: papeis.admin_org,
        convidadoPor: usuario.nome,
      });
      await auditar(tx, { tenantId, usuario, acao: "organizacao.convidar_admin", entidade: "associacao", detalhes: { email } });
      return r;
    });
    revalidatePath(`/plataforma/organizacoes/${tenantId}`);
    return { ok: r.enviado ? `Convite enviado para ${email}.` : `${email} já tinha conta e foi vinculado como administrador.` };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Módulos (entitlements) ───────────────────────────────────────────────

const mudancaSchema = z.object({
  tenantId: z.string().uuid(),
  modulo: z.enum(MODULOS),
  status: z.enum(["ativo", "teste", "inativo", "suspenso", "expirado"]),
  inicio: z.string().trim().optional(),
  fim: z.string().trim().optional(),
  motivo: z.string().trim().min(5, "Descreva o motivo (fica no histórico)."),
});

export async function alterarModulo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { usuario } = await exigirSuperadminAcao();
    const d = mudancaSchema.parse(Object.fromEntries(fd));
    await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      await alterarEntitlement(tx, {
        tenantId: d.tenantId,
        modulo: d.modulo,
        status: d.status,
        inicio: d.inicio ? new Date(`${d.inicio}T00:00:00`) : undefined,
        fim: d.fim ? new Date(`${d.fim}T23:59:59`) : null,
        origem: "manual",
        responsavel: { id: usuario.id, nome: usuario.nome },
        motivo: d.motivo,
      });
      await auditar(tx, { tenantId: d.tenantId, usuario, acao: "modulo.alterar", entidade: "entitlement", detalhes: d });
    });
    revalidatePath(`/plataforma/organizacoes/${d.tenantId}`);
    return { ok: "Módulo atualizado. A mudança vale imediatamente." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Produtos externos (integração comercial futura) ─────────────────────

export async function salvarProdutoExterno(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { usuario } = await exigirSuperadminAcao();
    const id = String(fd.get("id") ?? "") || null;
    const dados = {
      canal: z.enum(["kiwify", "site"]).parse(fd.get("canal")),
      idExterno: z.string().trim().min(1, "Informe o id do produto no canal.").parse(fd.get("idExterno")),
      descricao: z.string().trim().min(2, "Informe uma descrição.").parse(fd.get("descricao")),
      modulos: z.array(z.enum(MODULOS)).min(1, "Selecione ao menos um módulo.").parse(fd.getAll("modulos")),
      duracaoDias: fd.get("duracaoDias") ? z.coerce.number().int().positive().parse(fd.get("duracaoDias")) : null,
      ativo: fd.get("ativo") === "on",
    };
    await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      const p = id ? await tx.produtoExterno.update({ where: { id }, data: dados }) : await tx.produtoExterno.create({ data: dados });
      await auditar(tx, { tenantId: null, usuario, acao: id ? "produto_externo.editar" : "produto_externo.criar", entidade: "produto_externo", entidadeId: p.id, detalhes: dados });
    });
    revalidatePath("/plataforma/produtos");
    return { ok: "Produto salvo." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Acesso de suporte ────────────────────────────────────────────────────

export async function iniciarSuporte(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let tenantId: string;
  try {
    const { usuario } = await exigirSuperadminAcao();
    tenantId = z.string().uuid().parse(fd.get("tenantId"));
    const motivo = z.string().trim().min(10, "Descreva o motivo do acesso (mín. 10 caracteres).").parse(fd.get("motivo"));
    const horas = z.coerce.number().int().min(1).max(8).parse(fd.get("horas"));
    await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      const s = await tx.acessoSuporte.create({
        data: { tenantId, superadminId: usuario.id, superadminNome: usuario.nome, motivo, expiraEm: new Date(Date.now() + horas * 3600_000) },
      });
      await auditar(tx, { tenantId, usuario, acao: "suporte.iniciar", entidade: "acesso_suporte", entidadeId: s.id, detalhes: { motivo, horas }, suporte: true });
    });
  } catch (e) {
    return erroDe(e);
  }
  (await cookies()).set(COOKIE_ORG, tenantId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/inicio");
}

export async function encerrarSuporte() {
  const usuario = await getUsuario();
  if (!usuario?.superadmin) redirect("/entrar");
  await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
    const abertos = await tx.acessoSuporte.findMany({ where: { superadminId: usuario.id, encerradoEm: null, expiraEm: { gt: new Date() } } });
    for (const s of abertos) {
      await tx.acessoSuporte.update({ where: { id: s.id }, data: { encerradoEm: new Date() } });
      await auditar(tx, { tenantId: s.tenantId, usuario, acao: "suporte.encerrar", entidade: "acesso_suporte", entidadeId: s.id, suporte: true });
    }
  });
  (await cookies()).delete(COOKIE_ORG);
  redirect("/plataforma");
}

// ─── Usuários da plataforma ───────────────────────────────────────────────

export async function alternarSuperadmin(usuarioId: string) {
  const { usuario } = await exigirSuperadminAcao();
  if (usuarioId === usuario.id) throw new Error("Você não pode alterar o próprio papel.");
  await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
    const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    await tx.usuario.update({ where: { id: usuarioId }, data: { superadmin: !u.superadmin } });
    await auditar(tx, { tenantId: null, usuario, acao: "usuario.superadmin", entidade: "usuario", entidadeId: usuarioId, detalhes: { de: u.superadmin, para: !u.superadmin } });
  });
  revalidatePath("/plataforma/usuarios");
}

// ─── Eventos de compra (Kiwify/site) ──────────────────────────────────────

/** Aplica o evento a uma organização escolhida (ou confirmada) pelo superadmin. */
export async function aplicarEvento(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { usuario } = await exigirSuperadminAcao();
    const eventoId = z.string().uuid().parse(fd.get("eventoId"));
    const organizacaoId = z.string().uuid("Escolha a organização.").parse(fd.get("organizacaoId"));
    const r = await transacao({ escopo: "plataforma", usuarioId: usuario.id }, (tx) => aplicarEventoIntegracao(tx, eventoId, organizacaoId, { id: usuario.id, nome: usuario.nome }));
    revalidatePath("/plataforma/integracoes");
    revalidatePath(`/plataforma/organizacoes/${organizacaoId}`);
    return r === "duplicado" ? { erro: "Evento duplicado: o pedido já tinha sido processado. Marcado como ignorado." } : { ok: "Evento aplicado. Acessos atualizados com histórico." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function ignorarEvento(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { usuario } = await exigirSuperadminAcao();
    const eventoId = z.string().uuid().parse(fd.get("eventoId"));
    const motivo = z.string().trim().min(3, "Informe o motivo.").parse(fd.get("motivo"));
    await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
      const e = await tx.eventoIntegracao.findUnique({ where: { id: eventoId } });
      if (!e || e.status === "processado") throw new Error("Evento não encontrado ou já processado.");
      await tx.eventoIntegracao.update({ where: { id: eventoId }, data: { status: "ignorado", erro: `Ignorado por ${usuario.nome}: ${motivo}`, processadoEm: new Date(), aplicadoPor: usuario.nome } });
      await auditar(tx, { tenantId: null, usuario, acao: "integracao.ignorar", entidade: "evento_integracao", entidadeId: eventoId, detalhes: { motivo } });
    });
    revalidatePath("/plataforma/integracoes");
    return { ok: "Evento ignorado." };
  } catch (e) {
    return erroDe(e);
  }
}

/** Reinterpreta um evento (ex.: depois de cadastrar o produto externo ou os identificadores da organização). */
export async function reprocessarEvento(eventoId: string) {
  const { usuario } = await exigirSuperadminAcao();
  await transacao({ escopo: "plataforma", usuarioId: usuario.id }, async (tx) => {
    const e = await tx.eventoIntegracao.findUnique({ where: { id: eventoId } });
    if (!e || e.status === "processado") throw new Error("Evento não encontrado ou já processado.");
    await tx.eventoIntegracao.update({ where: { id: eventoId }, data: { status: "recebido" } });
  });
  await processarRecebido(eventoId);
  revalidatePath("/plataforma/integracoes");
}
