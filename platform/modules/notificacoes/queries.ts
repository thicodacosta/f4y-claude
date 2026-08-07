import "server-only";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";

export async function getMinhasNotificacoes() {
  const usuario = await requireUsuario();

  const notificacoes = await prisma.notificacao.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });

  return notificacoes.map((n) => ({
    id: n.id,
    titulo: n.titulo,
    corpo: n.corpo,
    link: n.link,
    lida: n.lida,
    criadoEm: n.criadoEm.toISOString(),
  }));
}

export async function getContagemNaoLidas() {
  const usuario = await requireUsuario();
  return prisma.notificacao.count({ where: { usuarioId: usuario.id, lida: false } });
}
