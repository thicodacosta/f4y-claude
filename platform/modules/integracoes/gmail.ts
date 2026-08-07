import "server-only";

import { prisma } from "@/lib/prisma";

async function obterAccessTokenValido(usuarioId: string) {
  const integracao = await prisma.integracaoUsuario.findUnique({
    where: { usuarioId_provedor: { usuarioId, provedor: "google" } },
  });
  if (!integracao) throw new Error("Conecte seu Gmail em Configurações > Integrações antes de enviar e-mails.");

  const expiraEmBreve = !integracao.expiraEm || integracao.expiraEm.getTime() < Date.now() + 60_000;
  if (!expiraEmBreve) return integracao.accessToken;

  if (!integracao.refreshToken) {
    throw new Error("Sua conexão com o Gmail expirou — reconecte em Configurações > Integrações.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: integracao.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Não foi possível renovar a conexão com o Gmail — reconecte em Configurações.");

  const dados = (await res.json()) as { access_token: string; expires_in: number };
  await prisma.integracaoUsuario.update({
    where: { id: integracao.id },
    data: { accessToken: dados.access_token, expiraEm: new Date(Date.now() + dados.expires_in * 1000) },
  });
  return dados.access_token;
}

function base64UrlEncode(texto: string) {
  return Buffer.from(texto, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Envia via Gmail API (users.messages.send) usando o token do usuário
 * conectado — o e-mail sai da caixa PESSOAL de quem enviou, não de uma
 * conta compartilhada da Find4You (ver decisão de produto no schema). */
export async function enviarEmailGmail(params: { usuarioId: string; para: string; assunto: string; corpo: string }) {
  const accessToken = await obterAccessTokenValido(params.usuarioId);

  const mime = `To: ${params.para}\r\nSubject: ${params.assunto}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${params.corpo}`;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });

  if (!res.ok) {
    const erro = await res.text();
    throw new Error(`Falha ao enviar e-mail pelo Gmail: ${erro}`);
  }

  return (await res.json()) as { id: string };
}
