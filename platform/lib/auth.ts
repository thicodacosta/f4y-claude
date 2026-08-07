import "server-only";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Papel } from "@/lib/nav";

export type SessionUsuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel | null;
};

export async function getSessionUsuario(): Promise<SessionUsuario | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const usuario = await prisma.usuario.findUnique({ where: { id: user.id } });
  return {
    id: user.id,
    nome: usuario?.nome ?? user.email?.split("@")[0] ?? "",
    email: user.email ?? "",
    papel: (usuario?.papel as Papel | null) ?? null,
  };
}

/** Usa em Server Actions: lança erro (não redirect — quem chama é uma mutação, não uma navegação de página). */
export async function requireUsuario(): Promise<SessionUsuario> {
  const usuario = await getSessionUsuario();
  if (!usuario) throw new Error("Sessão expirada — faça login novamente.");
  return usuario;
}

export async function requirePapel(allowed: Papel[]): Promise<SessionUsuario> {
  const usuario = await requireUsuario();
  if (!usuario.papel || !allowed.includes(usuario.papel)) {
    throw new Error("Você não tem permissão para esta ação.");
  }
  return usuario;
}

/**
 * Fase 7 — portais externos. `empresaId`/`candidatoId` vêm de
 * `usuarios.empresa_id`/`usuarios.candidato_id` (preenchidos só no convite,
 * ver modules/portal/actions.ts), nunca de input do cliente, então servem
 * como escopo confiável para toda query/action do respectivo portal.
 */
export async function requirePortalCliente(): Promise<SessionUsuario & { empresaId: string }> {
  const usuario = await requirePapel(["cliente_portal"]);
  const empresaId = await getEmpresaIdDoUsuario(usuario.id);
  if (!empresaId) {
    throw new Error("Seu acesso ao portal ainda não foi vinculado a uma empresa — contate a Find4You.");
  }
  return { ...usuario, empresaId };
}

export async function requirePortalCandidato(): Promise<SessionUsuario & { candidatoId: string }> {
  const usuario = await requirePapel(["candidato_portal"]);
  const candidatoId = await getCandidatoIdDoUsuario(usuario.id);
  if (!candidatoId) {
    throw new Error("Seu acesso ao portal ainda não foi vinculado a um candidato — contate a Find4You.");
  }
  return { ...usuario, candidatoId };
}

async function getEmpresaIdDoUsuario(id: string): Promise<string | null> {
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { empresaId: true } });
  return usuario?.empresaId ?? null;
}

async function getCandidatoIdDoUsuario(id: string): Promise<string | null> {
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { candidatoId: true } });
  return usuario?.candidatoId ?? null;
}
