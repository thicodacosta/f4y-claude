import "server-only";

import { prisma } from "@/lib/prisma";

const GRAPH_API_VERSAO = "v21.0";

type MetadadosWhatsapp = { phoneNumberId: string };

/** Sem Embedded Signup (o fluxo com popup da Meta que dispensaria colar o
 * token manualmente) — isso exigiria App Review da Meta e o SDK JS do
 * Facebook Login for Business, desproporcional para uma ferramenta interna
 * de poucos usuários. Em vez disso, cada pessoa cola o Phone Number ID +
 * token permanente que ela mesma gerou no Meta Business Manager. */
export async function conectarWhatsapp(params: { usuarioId: string; phoneNumberId: string; accessToken: string }) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSAO}/${params.phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${params.accessToken}` } },
  );

  if (!res.ok) {
    throw new Error("Não foi possível validar o Phone Number ID e o token — confira os valores no Meta Business Manager.");
  }
  const dados = (await res.json()) as { display_phone_number?: string; verified_name?: string };

  await prisma.integracaoUsuario.upsert({
    where: { usuarioId_provedor: { usuarioId: params.usuarioId, provedor: "whatsapp" } },
    create: {
      usuarioId: params.usuarioId,
      provedor: "whatsapp",
      contaExterna: dados.display_phone_number ?? dados.verified_name ?? null,
      accessToken: params.accessToken,
      metadados: { phoneNumberId: params.phoneNumberId } satisfies MetadadosWhatsapp,
    },
    update: {
      contaExterna: dados.display_phone_number ?? dados.verified_name ?? null,
      accessToken: params.accessToken,
      metadados: { phoneNumberId: params.phoneNumberId } satisfies MetadadosWhatsapp,
    },
  });
}

/** Envia via WhatsApp Cloud API — só funciona dentro da janela de 24h desde
 * a última mensagem do destinatário, ou usando um template pré-aprovado
 * (não implementado aqui); fora disso a Graph API retorna erro, que sobe
 * como exceção pra quem chamou tratar na UI. */
export async function enviarMensagemWhatsapp(params: { usuarioId: string; paraTelefone: string; mensagem: string }) {
  const integracao = await prisma.integracaoUsuario.findUnique({
    where: { usuarioId_provedor: { usuarioId: params.usuarioId, provedor: "whatsapp" } },
  });
  if (!integracao) {
    throw new Error("Conecte seu WhatsApp Business em Configurações > Integrações antes de enviar mensagens.");
  }
  const { phoneNumberId } = integracao.metadados as unknown as MetadadosWhatsapp;

  const digitos = params.paraTelefone.replace(/\D/g, "");
  const destinatario = digitos.length <= 11 ? `55${digitos}` : digitos;

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSAO}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${integracao.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destinatario,
      type: "text",
      text: { body: params.mensagem },
    }),
  });

  if (!res.ok) {
    const erro = await res.text();
    throw new Error(`Falha ao enviar mensagem pelo WhatsApp: ${erro}`);
  }

  return (await res.json()) as { messages: { id: string }[] };
}
