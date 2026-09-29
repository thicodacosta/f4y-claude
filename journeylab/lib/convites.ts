import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Tx } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020";

/**
 * Convida alguém para uma organização. Se a pessoa ainda não tem conta, o
 * Supabase envia o e-mail de convite (criar senha). Se já tem, a associação
 * é criada e a organização aparece na próxima entrada.
 * O usuário é sempre resolvido pelo e-mail no Auth — nunca por dado do cliente.
 */
export async function convidarParaOrganizacao(
  tx: Tx,
  p: { tenantId: string; email: string; nome?: string; papelId: string; colaboradorId?: string | null; convidadoPor: string },
) {
  const email = p.email.trim().toLowerCase();
  const admin = createAdminClient();

  // Resolve a conta pelo Auth (service role, só no servidor). Convite novo → e-mail de criação de senha.
  let usuarioId: string;
  let enviado = false;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome: p.nome },
    redirectTo: `${SITE}/auth/confirmar?proximo=/nova-senha`,
  });
  if (!error && data.user) {
    usuarioId = data.user.id;
    enviado = true;
  } else {
    // Conta já existente: localiza pelo e-mail.
    const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = lista.users.find((x) => x.email?.toLowerCase() === email);
    if (!u) throw new Error("Não foi possível enviar o convite. Verifique o e-mail.");
    usuarioId = u.id;
  }
  await tx.$executeRaw`select public.jl_garantir_usuario(${usuarioId}::uuid, ${email}, ${p.nome?.trim() || email.split("@")[0]})`;

  await tx.associacao.upsert({
    where: { tenantId_usuarioId: { tenantId: p.tenantId, usuarioId } },
    update: { papelId: p.papelId, status: "ativa", ...(p.colaboradorId ? { colaboradorId: p.colaboradorId } : {}) },
    create: { tenantId: p.tenantId, usuarioId, papelId: p.papelId, colaboradorId: p.colaboradorId ?? null },
  });
  await tx.convite.create({
    data: {
      tenantId: p.tenantId,
      email,
      papelId: p.papelId,
      colaboradorId: p.colaboradorId ?? null,
      convidadoPor: p.convidadoPor,
      status: enviado ? "enviado" : "vinculado",
    },
  });
  return { usuarioId, enviado };
}
