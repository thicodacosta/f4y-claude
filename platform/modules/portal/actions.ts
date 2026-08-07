"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_CRM, PAPEIS_ATS } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Papel } from "@/lib/nav";

/**
 * Convida (ou, se o e-mail já tem conta Supabase Auth, só vincula) um
 * usuário ao portal. Consulta `auth.users` direto via SQL em vez da Admin
 * API `listUsers` (que não filtra por e-mail nesta versão do supabase-js) —
 * a mesma conexão Postgres do Prisma já enxerga o schema `auth` do Supabase.
 */
async function vincularUsuarioPortal(email: string, papel: Extract<Papel, "cliente_portal" | "candidato_portal">, vinculo: { empresaId?: string; candidatoId?: string }) {
  const existentes = await prisma.$queryRaw<{ id: string }[]>`
    select id from auth.users where email = ${email} limit 1
  `;

  let userId = existentes[0]?.id;

  if (!userId) {
    // O link do e-mail é montado pelo template supabase/templates/invite.html
    // com {{ .SiteURL }}/auth/confirm?...&next=/dashboard — não depende de um
    // `redirectTo` aqui (o template não referencia {{ .RedirectTo }}).
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) {
      throw new Error(`Não foi possível enviar o convite: ${error?.message ?? "erro desconhecido"}`);
    }
    userId = data.user.id;
  }

  await prisma.usuario.update({
    where: { id: userId },
    data: { papel, empresaId: vinculo.empresaId ?? null, candidatoId: vinculo.candidatoId ?? null },
  });

  return userId;
}

export async function convidarClientePortal(input: { contatoId: string }) {
  await requirePapel(PAPEIS_CRM);

  const contato = await prisma.contato.findUniqueOrThrow({ where: { id: input.contatoId } });
  if (!contato.email) {
    throw new Error("Este contato não tem e-mail cadastrado — adicione um e-mail antes de convidar.");
  }

  await vincularUsuarioPortal(contato.email, "cliente_portal", { empresaId: contato.empresaId });
  revalidatePath(`/empresas/${contato.empresaId}`);
}

export async function convidarCandidatoPortal(input: { candidatoId: string }) {
  await requirePapel(PAPEIS_ATS);

  const candidato = await prisma.candidato.findUniqueOrThrow({ where: { id: input.candidatoId } });
  if (!candidato.email) {
    throw new Error("Este candidato não tem e-mail cadastrado — adicione um e-mail antes de convidar.");
  }

  await vincularUsuarioPortal(candidato.email, "candidato_portal", { candidatoId: candidato.id });
  revalidatePath(`/candidatos/${candidato.id}`);
}
