"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";

export async function marcarNotificacaoLida(notificacaoId: string) {
  const usuario = await requireUsuario();

  await prisma.notificacao.updateMany({
    where: { id: notificacaoId, usuarioId: usuario.id },
    data: { lida: true },
  });
  revalidatePath("/dashboard");
}

export async function marcarTodasNotificacoesLidas() {
  const usuario = await requireUsuario();

  await prisma.notificacao.updateMany({
    where: { usuarioId: usuario.id, lida: false },
    data: { lida: true },
  });
  revalidatePath("/dashboard");
}
