"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";

export async function concluirTarefa(tarefaId: string) {
  const usuario = await requireUsuario();

  const tarefa = await prisma.tarefa.findUniqueOrThrow({ where: { id: tarefaId } });
  if (tarefa.responsavelId !== usuario.id && usuario.papel !== "admin") {
    throw new Error("Você não pode concluir uma tarefa de outra pessoa.");
  }

  await prisma.tarefa.update({ where: { id: tarefaId }, data: { status: "concluida" } });
  revalidatePath("/dashboard");
}
