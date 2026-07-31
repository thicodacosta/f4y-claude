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
