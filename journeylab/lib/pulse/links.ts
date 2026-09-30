import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link pessoal da pesquisa: `<id do convite>.<HMAC>` — derivado do id, então
 * nenhum token fica gravado no banco e o lembrete reenvia o mesmo link.
 * Segredo: PULSE_LINK_SECRET (obrigatório; trocar invalida os links emitidos).
 */
function segredo() {
  const s = process.env.PULSE_LINK_SECRET;
  if (!s || s.length < 32) throw new Error("PULSE_LINK_SECRET não configurado (mínimo 32 caracteres).");
  return s;
}
const assinar = (conviteId: string) => createHmac("sha256", segredo()).update(`pulse:${conviteId}`).digest("base64url").slice(0, 32);

export function tokenDoConvite(conviteId: string) {
  return `${conviteId}.${assinar(conviteId)}`;
}

/** Devolve o id do convite se a assinatura confere; senão, null. */
export function conviteDoToken(token: string | undefined | null) {
  if (!token) return null;
  const m = token.match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/);
  if (!m) return null;
  const esperado = Buffer.from(assinar(m[1]));
  const recebido = Buffer.from(m[2]);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? m[1] : null;
}

export function urlResposta(pesquisaId: string, token?: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/pesquisa/responder/${pesquisaId}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
}
