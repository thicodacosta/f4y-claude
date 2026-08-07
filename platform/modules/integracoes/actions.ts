"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUsuario } from "@/lib/auth";
import {
  provedorIntegracaoValues,
  conectarWhatsappSchema,
  enviarEmailCandidatoSchema,
  enviarWhatsappCandidatoSchema,
  type ProvedorIntegracao,
  type ConectarWhatsappFormInput,
  type EnviarEmailCandidatoFormInput,
  type EnviarWhatsappCandidatoFormInput,
} from "@/modules/integracoes/schemas";
import { conectarWhatsapp as conectarWhatsappNaApi, enviarMensagemWhatsapp } from "@/modules/integracoes/whatsapp";
import { enviarEmailGmail } from "@/modules/integracoes/gmail";

export async function desconectarIntegracao(provedor: ProvedorIntegracao) {
  const usuario = await requireUsuario();
  if (!provedorIntegracaoValues.includes(provedor)) {
    throw new Error("Provedor inválido.");
  }

  await prisma.integracaoUsuario.deleteMany({ where: { usuarioId: usuario.id, provedor } });
  revalidatePath("/configuracoes/integracoes");
}

export async function conectarWhatsapp(input: ConectarWhatsappFormInput) {
  const usuario = await requireUsuario();
  const data = conectarWhatsappSchema.parse(input);

  await conectarWhatsappNaApi({ usuarioId: usuario.id, ...data });
  revalidatePath("/configuracoes/integracoes");
}

export async function enviarEmailCandidato(input: EnviarEmailCandidatoFormInput) {
  const usuario = await requireUsuario();
  const { candidatoId, assunto, corpo } = enviarEmailCandidatoSchema.parse(input);

  const candidato = await prisma.candidato.findUniqueOrThrow({
    where: { id: candidatoId },
    select: { email: true },
  });
  if (!candidato.email) throw new Error("Este candidato não tem e-mail cadastrado.");

  await enviarEmailGmail({ usuarioId: usuario.id, para: candidato.email, assunto, corpo });

  await prisma.atividade.create({
    data: {
      entidadeTipo: "candidato",
      entidadeId: candidatoId,
      tipo: "email",
      autorId: usuario.id,
      conteudo: `E-mail enviado — "${assunto}": ${corpo}`,
    },
  });

  revalidatePath(`/candidatos/${candidatoId}`);
}

export async function enviarWhatsappCandidato(input: EnviarWhatsappCandidatoFormInput) {
  const usuario = await requireUsuario();
  const { candidatoId, mensagem } = enviarWhatsappCandidatoSchema.parse(input);

  const candidato = await prisma.candidato.findUniqueOrThrow({
    where: { id: candidatoId },
    select: { whatsapp: true, telefone: true },
  });
  const paraTelefone = candidato.whatsapp || candidato.telefone;
  if (!paraTelefone) throw new Error("Este candidato não tem telefone/WhatsApp cadastrado.");

  await enviarMensagemWhatsapp({ usuarioId: usuario.id, paraTelefone, mensagem });

  await prisma.atividade.create({
    data: {
      entidadeTipo: "candidato",
      entidadeId: candidatoId,
      tipo: "whatsapp",
      autorId: usuario.id,
      conteudo: `Mensagem enviada pelo WhatsApp: ${mensagem}`,
    },
  });

  revalidatePath(`/candidatos/${candidatoId}`);
}
