import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link do convite NR-1: `<id do convite>.<HMAC>` — nenhum token é gravado, o
 * link não contém dado do destinatário em texto aberto e é validado no servidor.
 * Segredo: NR1_LINK_SECRET (ou PULSE_LINK_SECRET), com contexto próprio ("nr1:"),
 * então um link do Pulse nunca vale aqui.
 */
function segredo() {
  const s = process.env.NR1_LINK_SECRET ?? process.env.PULSE_LINK_SECRET;
  if (!s || s.length < 32) throw new Error("NR1_LINK_SECRET (ou PULSE_LINK_SECRET) não configurado (mínimo 32 caracteres).");
  return s;
}
const assinar = (conviteId: string) => createHmac("sha256", segredo()).update(`nr1:${conviteId}`).digest("base64url").slice(0, 32);

export const tokenConviteNr1 = (conviteId: string) => `${conviteId}.${assinar(conviteId)}`;

export function conviteNr1DoToken(token: string | null | undefined) {
  if (!token) return null;
  const m = token.match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/);
  if (!m) return null;
  const esperado = Buffer.from(assinar(m[1]));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? m[1] : null;
}

export const urlRespostaNr1 = (conviteId: string) => `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/nr1/responder/${encodeURIComponent(tokenConviteNr1(conviteId))}`;
