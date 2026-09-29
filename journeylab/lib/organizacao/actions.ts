"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { transacao } from "@/lib/db";
import { ErroAcesso, exigirPermissaoAcao, type Contexto } from "@/lib/contexto";
import { auditar } from "@/lib/auditoria";
import { convidarParaOrganizacao } from "@/lib/convites";
import { ACOES, AREAS, type Escopo } from "@/lib/permissoes";
import type { EstadoForm } from "@/lib/auth/actions";
import { CATEGORIAS_RETENCAO, executarRetencao, type CategoriaRetencao } from "@/lib/retencao";

function erroDe(e: unknown): EstadoForm {
  if (e instanceof z.ZodError) return { erro: e.issues[0].message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { erro: "Já existe um registro com esse nome ou e-mail nesta organização." };
  }
  return { erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

const uuidOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().uuid().nullable());

const escopoTx = (ctx: Contexto) => ({ escopo: "tenant" as const, tenantId: ctx.org.id, usuarioId: ctx.usuario.id });
const quem = (ctx: Contexto) => ({ id: ctx.usuario.id, nome: ctx.usuario.nome });

// ─── Usuários da organização ──────────────────────────────────────────────

export async function convidarUsuario(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirPermissaoAcao("organizacao", "criar");
    const email = z.string().trim().toLowerCase().email("E-mail inválido.").parse(fd.get("email"));
    const papelId = z.string().uuid("Selecione o papel.").parse(fd.get("papelId"));
    const colaboradorId = uuidOpcional.parse(fd.get("colaboradorId") ?? "");
    const r = await transacao(escopoTx(ctx), async (tx) => {
      // Referências conferidas dentro da organização (RLS devolve null para outra empresa).
      if (!(await tx.papel.findUnique({ where: { id: papelId } }))) throw new ErroAcesso("Papel inválido.");
      if (colaboradorId && !(await tx.colaborador.findUnique({ where: { id: colaboradorId } }))) throw new ErroAcesso("Pessoa inválida.");
      const r = await convidarParaOrganizacao(tx, {
        tenantId: ctx.org.id,
        email,
        nome: String(fd.get("nome") ?? ""),
        papelId,
        colaboradorId,
        convidadoPor: ctx.usuario.nome,
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "usuario.convidar", entidade: "associacao", detalhes: { email, papelId } });
      return r;
    });
    revalidatePath("/configuracoes/usuarios");
    return { ok: r.enviado ? `Convite enviado para ${email}.` : `${email} já tinha conta JourneyLab e foi vinculado à organização.` };
  } catch (e) {
    return erroDe(e);
  }
}

export async function alterarAssociacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirPermissaoAcao("organizacao", "editar");
    const id = z.string().uuid().parse(fd.get("id"));
    const papelId = z.string().uuid().parse(fd.get("papelId"));
    const status = z.enum(["ativa", "suspensa"]).parse(fd.get("status"));
    const colaboradorId = uuidOpcional.parse(fd.get("colaboradorId") ?? "");
    await transacao(escopoTx(ctx), async (tx) => {
      const antes = await tx.associacao.findUnique({ where: { id }, include: { papel: true } });
      const papel = await tx.papel.findUnique({ where: { id: papelId } });
      if (!antes || !papel) throw new ErroAcesso("Registro não encontrado nesta organização.");
      if (colaboradorId && !(await tx.colaborador.findUnique({ where: { id: colaboradorId } }))) throw new ErroAcesso("Pessoa inválida.");
      if (antes.usuarioId === ctx.usuario.id && (papel.base !== "admin_org" || status !== "ativa") && antes.papel.base === "admin_org") {
        throw new ErroAcesso("Você não pode remover o próprio acesso de administrador.");
      }
      if (antes.papel.base === "admin_org" && (papel.base !== "admin_org" || status !== "ativa")) {
        const admins = await tx.associacao.count({ where: { status: "ativa", papel: { base: "admin_org" } } });
        if (admins <= 1) throw new ErroAcesso("A organização precisa de ao menos um administrador ativo.");
      }
      await tx.associacao.update({ where: { id }, data: { papelId, status, colaboradorId } });
      await auditar(tx, {
        tenantId: ctx.org.id,
        usuario: quem(ctx),
        acao: "usuario.alterar",
        entidade: "associacao",
        entidadeId: id,
        detalhes: { antes: { papelId: antes.papelId, status: antes.status, colaboradorId: antes.colaboradorId }, depois: { papelId, status, colaboradorId } },
      });
    });
    revalidatePath("/configuracoes/usuarios");
    return { ok: "Acesso atualizado." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Papéis e permissões ──────────────────────────────────────────────────

export async function criarPapel(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let id: string;
  try {
    const { ctx } = await exigirPermissaoAcao("organizacao", "administrar");
    const nome = z.string().trim().min(3, "Informe o nome do papel.").max(60).parse(fd.get("nome"));
    const copiarDe = uuidOpcional.parse(fd.get("copiarDe") ?? "");
    id = await transacao(escopoTx(ctx), async (tx) => {
      const p = await tx.papel.create({ data: { tenantId: ctx.org.id, nome, base: "personalizado" } });
      if (copiarDe) {
        const origem = await tx.papelPermissao.findMany({ where: { papelId: copiarDe } });
        if (origem.length) {
          await tx.papelPermissao.createMany({
            data: origem.map((o) => ({ tenantId: ctx.org.id, papelId: p.id, area: o.area, acao: o.acao, escopo: o.escopo })),
          });
        }
      }
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "papel.criar", entidade: "papel", entidadeId: p.id, detalhes: { nome, copiarDe } });
      return p.id;
    });
  } catch (e) {
    return erroDe(e);
  }
  redirect(`/configuracoes/papeis/${id}`);
}

/** Matriz enviada como campos `p:<area>:<acao>` = escopo ("" = sem permissão). */
export async function salvarPermissoes(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirPermissaoAcao("organizacao", "administrar");
    const papelId = z.string().uuid().parse(fd.get("papelId"));
    const escopos = new Set<Escopo>(["proprio", "equipe", "todos"]);
    const novas: { area: (typeof AREAS)[number]["chave"]; acao: (typeof ACOES)[number]["chave"]; escopo: Escopo }[] = [];
    for (const a of AREAS) {
      for (const ac of ACOES) {
        const v = String(fd.get(`p:${a.chave}:${ac.chave}`) ?? "");
        if (v && escopos.has(v as Escopo)) novas.push({ area: a.chave, acao: ac.chave, escopo: v as Escopo });
      }
    }
    await transacao(escopoTx(ctx), async (tx) => {
      const papel = await tx.papel.findUnique({ where: { id: papelId }, include: { permissoes: true } });
      if (!papel) throw new ErroAcesso("Papel não encontrado.");
      if (papel.base === "admin_org" && !novas.some((n) => n.area === "organizacao" && n.acao === "administrar")) {
        throw new ErroAcesso("O papel de administrador precisa manter “Organização › Administrar”.");
      }
      await tx.papelPermissao.deleteMany({ where: { papelId } });
      if (novas.length) await tx.papelPermissao.createMany({ data: novas.map((n) => ({ ...n, tenantId: ctx.org.id, papelId })) });
      await auditar(tx, {
        tenantId: ctx.org.id,
        usuario: quem(ctx),
        acao: "papel.permissoes",
        entidade: "papel",
        entidadeId: papelId,
        detalhes: { antes: papel.permissoes.map((p) => `${p.area}:${p.acao}:${p.escopo}`), depois: novas.map((n) => `${n.area}:${n.acao}:${n.escopo}`) },
      });
    });
    revalidatePath(`/configuracoes/papeis/${papelId}`);
    return { ok: "Permissões salvas. Valem no próximo carregamento de página de quem tem este papel." };
  } catch (e) {
    return erroDe(e);
  }
}

// ─── Cadastro compartilhado ───────────────────────────────────────────────

export async function salvarArea(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = uuidOpcional.parse(fd.get("id") ?? "");
    const { ctx } = await exigirPermissaoAcao("cadastro", id ? "editar" : "criar");
    const nome = z.string().trim().min(2, "Informe o nome da área.").parse(fd.get("nome"));
    await transacao(escopoTx(ctx), async (tx) => {
      const a = id ? await tx.area.update({ where: { id }, data: { nome } }) : await tx.area.create({ data: { tenantId: ctx.org.id, nome } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: id ? "area.editar" : "area.criar", entidade: "area", entidadeId: a.id, detalhes: { nome } });
    });
    revalidatePath("/equipes");
    return { ok: "Área salva." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function salvarEquipe(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const id = uuidOpcional.parse(fd.get("id") ?? "");
    const { ctx } = await exigirPermissaoAcao("cadastro", id ? "editar" : "criar");
    const nome = z.string().trim().min(2, "Informe o nome da equipe.").parse(fd.get("nome"));
    const areaId = uuidOpcional.parse(fd.get("areaId") ?? "");
    const gestorId = uuidOpcional.parse(fd.get("gestorId") ?? "");
    await transacao(escopoTx(ctx), async (tx) => {
      if (areaId && !(await tx.area.findUnique({ where: { id: areaId } }))) throw new ErroAcesso("Área inválida.");
      if (gestorId && !(await tx.colaborador.findUnique({ where: { id: gestorId } }))) throw new ErroAcesso("Gestor inválido.");
      const dados = { nome, areaId, gestorId };
      const e = id ? await tx.equipe.update({ where: { id }, data: dados }) : await tx.equipe.create({ data: { ...dados, tenantId: ctx.org.id } });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: id ? "equipe.editar" : "equipe.criar", entidade: "equipe", entidadeId: e.id, detalhes: dados });
    });
    revalidatePath("/equipes");
    return { ok: "Equipe salva." };
  } catch (e) {
    return erroDe(e);
  }
}

const colaboradorSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().email("E-mail inválido.").nullable()),
  cargo: z.string().trim().transform((v) => v || null),
  dataAdmissao: z.string().trim().transform((v) => (v ? new Date(`${v}T12:00:00`) : null)),
  status: z.enum(["pre_admissao", "ativo", "desligado"]),
});

export async function salvarColaborador(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  let novoId: string | null = null;
  try {
    const id = uuidOpcional.parse(fd.get("id") ?? "");
    const { ctx, escopo } = await exigirPermissaoAcao("cadastro", id ? "editar" : "criar");
    if (escopo !== "todos") throw new ErroAcesso("Seu papel não permite alterar o cadastro de pessoas.");
    const d = colaboradorSchema.parse(Object.fromEntries(fd));
    const equipeId = uuidOpcional.parse(fd.get("equipeId") ?? "");
    let gestorId = uuidOpcional.parse(fd.get("gestorId") ?? "");
    await transacao(escopoTx(ctx), async (tx) => {
      const equipe = equipeId ? await tx.equipe.findUnique({ where: { id: equipeId } }) : null;
      if (equipeId && !equipe) throw new ErroAcesso("Equipe inválida.");
      if (gestorId && !(await tx.colaborador.findUnique({ where: { id: gestorId } }))) throw new ErroAcesso("Gestor inválido.");
      if (gestorId && gestorId === id) throw new ErroAcesso("A pessoa não pode ser gestora de si mesma.");
      // Sem gestor informado: herda o gestor da equipe.
      if (!gestorId && equipe?.gestorId && equipe.gestorId !== id) gestorId = equipe.gestorId;
      const dados = { ...d, equipeId, gestorId, desligadoEm: d.status === "desligado" ? new Date() : null };
      if (id) {
        const antes = await tx.colaborador.findUnique({ where: { id } });
        if (!antes) throw new ErroAcesso("Pessoa não encontrada nesta organização.");
        await tx.colaborador.update({
          where: { id },
          data: { ...dados, desligadoEm: d.status === "desligado" ? (antes.desligadoEm ?? new Date()) : null },
        });
        await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "colaborador.editar", entidade: "colaborador", entidadeId: id, detalhes: { antes, depois: dados } });
      } else {
        const c = await tx.colaborador.create({ data: { ...dados, tenantId: ctx.org.id } });
        novoId = c.id;
        await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "colaborador.criar", entidade: "colaborador", entidadeId: c.id, detalhes: dados });
      }
    });
    revalidatePath("/pessoas");
  } catch (e) {
    return erroDe(e);
  }
  if (novoId) redirect(`/pessoas/${novoId}`);
  return { ok: "Cadastro atualizado. A mudança vale para todos os módulos." };
}

// ─── Retenção de dados ────────────────────────────────────────────────────

async function exigirAdministracaoRetencao() {
  const r = await exigirPermissaoAcao("organizacao", "administrar");
  if (r.escopo !== "todos") throw new ErroAcesso("Somente a administração da organização define a retenção de dados.");
  return r;
}

const mesesOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number({ message: "Informe um número de meses." }).int("Use meses inteiros.").min(1, "Mínimo de 1 mês.").max(240, "Máximo de 240 meses.").nullable());

export async function salvarRetencao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirAdministracaoRetencao();
    const dados = Object.fromEntries(
      Object.keys(CATEGORIAS_RETENCAO).map((k) => [k, mesesOpcional.parse(String(fd.get(k) ?? ""))]),
    ) as Record<CategoriaRetencao, number | null>;
    await transacao(escopoTx(ctx), async (tx) => {
      await tx.politicaRetencao.upsert({
        where: { tenantId: ctx.org.id },
        create: { tenantId: ctx.org.id, ...dados, atualizadoPor: ctx.usuario.nome },
        update: { ...dados, atualizadoPor: ctx.usuario.nome },
      });
      await auditar(tx, { tenantId: ctx.org.id, usuario: quem(ctx), acao: "retencao.configurar", entidade: "politica_retencao", detalhes: dados });
    });
    revalidatePath("/configuracoes/retencao");
    return { ok: "Política de retenção salva. Use “Simular” para ver o efeito antes da próxima execução." };
  } catch (e) {
    return erroDe(e);
  }
}

export async function executarRetencaoAgora(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  try {
    const { ctx } = await exigirAdministracaoRetencao();
    const simular = fd.get("modo") !== "aplicar";
    if (!simular && fd.get("confirmo") !== "on") throw new ErroAcesso("Confirme que entende que a exclusão é definitiva.");
    const r = await executarRetencao(escopoTx(ctx), ctx.org.id, simular, quem(ctx));
    const partes = Object.entries(r).map(([k, n]) => `${CATEGORIAS_RETENCAO[k as CategoriaRetencao].nome}: ${n}`);
    revalidatePath("/configuracoes/retencao");
    if (!partes.length) return { ok: "Nenhuma categoria com prazo definido." };
    return { ok: `${simular ? "Simulação — seriam eliminados" : "Eliminados"}: ${partes.join(" · ")}.` };
  } catch (e) {
    return erroDe(e);
  }
}
