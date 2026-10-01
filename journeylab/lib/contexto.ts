import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dbTenant, dbUsuario, dbPlataforma } from "@/lib/db";
import { entitlementLibera } from "@/lib/entitlements";
import { VERSAO_TERMOS } from "@/lib/legal";
import {
  ACOES,
  AREAS,
  ORDEM_ESCOPO,
  escopoDe,
  type Acao,
  type AreaPermissao,
  type Escopo,
  type MapaPermissoes,
  type Modulo,
  type PapelBase,
} from "@/lib/permissoes";

export const COOKIE_ORG = "jl_org";

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  superadmin: boolean;
  aceitouTermos: boolean;
  organizacoes: { id: string; nome: string }[];
};

export type Contexto = {
  usuario: UsuarioSessao;
  org: { id: string; nome: string; minimoRecorte: number };
  papel: { nome: string; base: PapelBase };
  /** Cadastro de pessoa ligado à conta nesta organização (para escopo próprio/equipe). */
  colaboradorId: string | null;
  permissoes: MapaPermissoes;
  modulos: Set<Modulo>;
  entitlements: { modulo: Modulo; status: string; inicio: Date; fim: Date | null }[];
  /** Acesso de suporte do superadmin: somente leitura, com prazo. */
  suporte: { id: string; expiraEm: Date } | null;
};

/** Usuário autenticado (Supabase Auth validado no servidor) + organizações às quais pertence. */
export const getUsuario = cache(async (): Promise<UsuarioSessao | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const db = dbUsuario(user.id);
  const u = await db.usuario.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email.toLowerCase(),
      nome: (user.user_metadata?.nome as string | undefined)?.trim() || user.email.split("@")[0],
    },
  });
  const [associacoes, termos] = await Promise.all([
    db.associacao.findMany({
      where: { usuarioId: user.id, status: "ativa", organizacao: { ativa: true } },
      select: { organizacao: { select: { id: true, nome: true } } },
      orderBy: { organizacao: { nome: "asc" } },
    }),
    db.consentimento.findFirst({
      where: { usuarioId: user.id, tipo: "termos", versao: VERSAO_TERMOS },
      orderBy: { registradoEm: "desc" },
    }),
  ]);

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    superadmin: u.superadmin,
    aceitouTermos: termos?.aceito ?? false,
    organizacoes: associacoes.map((a) => a.organizacao),
  };
});

async function suporteVigente(usuario: UsuarioSessao, orgId: string) {
  if (!usuario.superadmin) return null;
  const s = await dbPlataforma(usuario.id).acessoSuporte.findFirst({
    where: { tenantId: orgId, superadminId: usuario.id, encerradoEm: null, expiraEm: { gt: new Date() } },
    orderBy: { inicio: "desc" },
  });
  return s ? { id: s.id, expiraEm: s.expiraEm } : null;
}

/**
 * Contexto da organização ativa. A organização vem do cookie, mas SÓ é aceita
 * se o usuário tiver associação ativa com ela (ou suporte vigente).
 */
export const getContexto = cache(async (): Promise<Contexto | null> => {
  const usuario = await getUsuario();
  if (!usuario) return null;
  const store = await cookies();
  const pedida = store.get(COOKIE_ORG)?.value;

  let orgId: string | null = null;
  let suporte: Contexto["suporte"] = null;
  if (pedida && usuario.organizacoes.some((o) => o.id === pedida)) orgId = pedida;
  else if (pedida && (suporte = await suporteVigente(usuario, pedida))) orgId = pedida;
  else if (!pedida && usuario.organizacoes.length === 1) orgId = usuario.organizacoes[0].id;
  if (!orgId) return null;

  const db = dbTenant(orgId, usuario.id);
  const [org, associacao, entitlements] = await Promise.all([
    db.organizacao.findUnique({ where: { id: orgId }, select: { id: true, nome: true, minimoRecorte: true, ativa: true } }),
    suporte
      ? null
      : db.associacao.findUnique({
          where: { tenantId_usuarioId: { tenantId: orgId, usuarioId: usuario.id } },
          include: { papel: { include: { permissoes: true } } },
        }),
    db.entitlement.findMany({ where: { tenantId: orgId } }),
  ]);
  if (!org || !org.ativa) return null;
  if (!suporte && (!associacao || associacao.status !== "ativa")) return null;

  const modulos = new Set(entitlements.filter((e) => entitlementLibera(e)).map((e) => e.modulo as Modulo));

  const permissoes: MapaPermissoes = {};
  if (suporte) {
    // Suporte: somente leitura de cadastro, organização e módulos contratados.
    for (const a of AREAS) permissoes[`${a.chave}:visualizar`] = "todos";
  } else {
    for (const p of associacao!.papel.permissoes) {
      const chave = `${p.area}:${p.acao}` as const;
      const atual = permissoes[chave];
      if (!atual || ORDEM_ESCOPO[p.escopo] > ORDEM_ESCOPO[atual]) permissoes[chave] = p.escopo;
    }
  }

  return {
    usuario,
    org: { id: org.id, nome: org.nome, minimoRecorte: org.minimoRecorte },
    papel: suporte ? { nome: "Suporte JourneyLab (leitura)", base: "personalizado" } : { nome: associacao!.papel.nome, base: associacao!.papel.base },
    colaboradorId: associacao?.colaboradorId ?? null,
    permissoes,
    modulos,
    entitlements: entitlements.map((e) => ({ modulo: e.modulo as Modulo, status: e.status, inicio: e.inicio, fim: e.fim })),
    suporte,
  };
});

// ─── Guardas ─────────────────────────────────────────────────────────────

/** Páginas da área da organização. */
export async function exigirContexto(): Promise<Contexto> {
  const usuario = await getUsuario();
  if (!usuario) redirect("/entrar");
  if (!usuario.aceitouTermos) redirect("/aceite");
  const ctx = await getContexto();
  if (!ctx) redirect(usuario.superadmin && usuario.organizacoes.length === 0 ? "/plataforma" : "/organizacoes");
  return ctx;
}

/**
 * Escopo mínimo por área: Onboarding, Feedback 1:1, Pulse, PDI, NR-1 e Retenção são de RH/Admin e gestores —
 * uma permissão com escopo "próprio" (colaborador) não dá acesso, mesmo se
 * concedida no editor de papéis. Offboarding (entrevistas de saída confidenciais)
 * e People Analytics (dados da organização inteira) exigem escopo "todos".
 */
const ESCOPO_MINIMO: Partial<Record<AreaPermissao, Escopo>> = {
  onboarding: "equipe",
  feedback: "equipe",
  pulse: "equipe",
  pdi: "equipe",
  nr1: "equipe",
  retencao: "equipe",
  offboarding: "todos",
  analytics: "todos",
};

function escopoEfetivo(ctx: Contexto, area: AreaPermissao, acao: Acao): Escopo | null {
  const e = escopoDe(ctx.permissoes, area, acao);
  const minimo = ESCOPO_MINIMO[area];
  if (e && minimo && ORDEM_ESCOPO[e] < ORDEM_ESCOPO[minimo]) return null;
  return e;
}

export function pode(ctx: Contexto, area: AreaPermissao, acao: Acao): Escopo | null {
  if (area !== "organizacao" && area !== "cadastro" && !ctx.modulos.has(area)) return null;
  if (ctx.suporte && acao !== "visualizar") return null;
  return escopoEfetivo(ctx, area, acao);
}

export function moduloLiberado(ctx: Contexto, modulo: Modulo) {
  return ctx.modulos.has(modulo);
}

/** Página de módulo: bloqueia no servidor se não contratado/sem permissão de visualizar. */
export async function exigirModulo(modulo: Modulo, acao: Acao = "visualizar") {
  const ctx = await exigirContexto();
  if (!ctx.modulos.has(modulo)) redirect(`/inicio?bloqueado=${modulo}`);
  const escopo = pode(ctx, modulo, acao);
  if (!escopo) redirect(`/inicio?sem_permissao=${modulo}`);
  return { ctx, escopo, db: dbTenant(ctx.org.id, ctx.usuario.id) };
}

export class ErroAcesso extends Error {}

/**
 * Server Actions: valida sessão, organização, módulo contratado, permissão e
 * modo suporte (somente leitura). Devolve o cliente de banco já isolado.
 */
export async function exigirPermissaoAcao(area: AreaPermissao, acao: Acao) {
  const ctx = await getContexto();
  if (!ctx) throw new ErroAcesso("Sessão expirada ou organização não selecionada.");
  if (!ctx.usuario.aceitouTermos) throw new ErroAcesso("Aceite os termos de uso para continuar.");
  if (area !== "organizacao" && area !== "cadastro" && !ctx.modulos.has(area)) {
    throw new ErroAcesso("Este módulo não está ativo para a sua organização.");
  }
  if (ctx.suporte && acao !== "visualizar") throw new ErroAcesso("Acesso de suporte é somente leitura.");
  const escopo = escopoEfetivo(ctx, area, acao);
  if (!escopo) throw new ErroAcesso("Você não tem permissão para esta ação.");
  return { ctx, escopo, db: dbTenant(ctx.org.id, ctx.usuario.id) };
}

export async function exigirSuperadmin() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/entrar");
  if (!usuario.superadmin) redirect("/inicio");
  return { usuario, db: dbPlataforma(usuario.id) };
}

export async function exigirSuperadminAcao() {
  const usuario = await getUsuario();
  if (!usuario?.superadmin) throw new ErroAcesso("Ação restrita ao superadmin JourneyLab.");
  return { usuario, db: dbPlataforma(usuario.id) };
}

/** Filtro de colaboradores conforme o escopo da permissão. */
export function filtroColaboradores(ctx: Contexto, escopo: Escopo) {
  if (escopo === "todos") return {};
  const eu = ctx.colaboradorId ?? "00000000-0000-0000-0000-000000000000";
  if (escopo === "equipe") return { OR: [{ id: eu }, { gestorId: eu }] };
  return { id: eu };
}

export { ACOES };
