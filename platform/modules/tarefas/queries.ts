import "server-only";

import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";

export async function getMinhasTarefas() {
  const usuario = await requireUsuario();

  const tarefas = await prisma.tarefa.findMany({
    where: { responsavelId: usuario.id },
    orderBy: [{ status: "asc" }, { prazo: "asc" }, { criadoEm: "desc" }],
    take: 20,
  });

  return tarefas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    entidadeTipo: t.entidadeTipo,
    entidadeId: t.entidadeId,
    prazo: t.prazo ? t.prazo.toISOString() : null,
    status: t.status,
    origem: t.origem,
    criadoEm: t.criadoEm.toISOString(),
  }));
}
