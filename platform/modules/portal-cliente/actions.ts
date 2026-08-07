"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePortalCliente } from "@/lib/auth";
import { enviarFeedbackSchema, type EnviarFeedbackInput } from "@/modules/portal-cliente/schemas";

/** Fluxos-usuario.md, Portal do Cliente: aprovar/reprovar shortlist gera
 * atividade no histórico interno da vaga e notifica o recrutador — evita que
 * o feedback do cliente fique "preso" no portal sem ninguém saber. */
export async function enviarFeedbackCandidato(input: EnviarFeedbackInput) {
  const { empresaId, id: usuarioId } = await requirePortalCliente();
  const data = enviarFeedbackSchema.parse(input);

  const vagaCandidato = await prisma.vagaCandidato.findUnique({
    where: { id: data.vagaCandidatoId },
    include: { vaga: true, candidato: true },
  });

  if (!vagaCandidato || vagaCandidato.vaga.empresaId !== empresaId) {
    throw new Error("Candidato não encontrado.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.vagaCandidato.update({
      where: { id: data.vagaCandidatoId },
      data: {
        feedbackCliente: data.feedback,
        comentarioCliente: data.comentario ?? null,
        feedbackEm: new Date(),
      },
    });

    const decisao = data.feedback === "aprovado" ? "aprovou" : "reprovou";
    await tx.atividade.create({
      data: {
        entidadeTipo: "vaga",
        entidadeId: vagaCandidato.vagaId,
        tipo: "feedback_cliente",
        autorId: usuarioId,
        conteudo: `Cliente ${decisao} o candidato "${vagaCandidato.candidato.nome}"${
          data.comentario ? ` — "${data.comentario}"` : ""
        }.`,
      },
    });

    if (vagaCandidato.vaga.recrutadorId) {
      await tx.notificacao.create({
        data: {
          usuarioId: vagaCandidato.vaga.recrutadorId,
          titulo: `Cliente ${decisao} um candidato`,
          corpo: `${vagaCandidato.candidato.nome} — ${vagaCandidato.vaga.cargo}${
            data.comentario ? `: "${data.comentario}"` : ""
          }`,
          link: `/vagas/${vagaCandidato.vagaId}`,
        },
      });
    }
  });

  revalidatePath(`/portal-cliente/vagas/${vagaCandidato.vagaId}`);
  revalidatePath(`/vagas/${vagaCandidato.vagaId}`);
}
