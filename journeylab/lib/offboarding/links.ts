import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link da entrevista de desligamento: `<id>.<envio em base36>.<HMAC>` — nenhum
 * token é gravado. O instante do envio entra na assinatura: reenviar o convite
 * invalida o link anterior. Segredo: OFFBOARDING_LINK_SECRET (ou PULSE_LINK_SECRET),
 * com contexto próprio ("offboarding:"), então links do Pulse/NR-1 não valem aqui.
 */
function segredo() {
  const s = process.env.OFFBOARDING_LINK_SECRET ?? process.env.PULSE_LINK_SECRET;
  if (!s || s.length < 32) throw new Error("OFFBOARDING_LINK_SECRET (ou PULSE_LINK_SECRET) não configurado (mínimo 32 caracteres).");
  return s;
}
const assinar = (id: string, envio: string) => createHmac("sha256", segredo()).update(`offboarding:${id}:${envio}`).digest("base64url").slice(0, 32);

export function tokenEntrevista(id: string, enviadaEm: Date) {
  const envio = enviadaEm.getTime().toString(36);
  return `${id}.${envio}.${assinar(id, envio)}`;
}

/** Devolve o id e o instante do envio se a assinatura confere; senão, null. */
export function entrevistaDoToken(token: string | null | undefined) {
  if (!token) return null;
  const m = token.match(/^([0-9a-f-]{36})\.([0-9a-z]{6,12})\.([A-Za-z0-9_-]{32})$/);
  if (!m) return null;
  const esperado = Buffer.from(assinar(m[1], m[2]));
  const recebido = Buffer.from(m[3]);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  return { id: m[1], enviadaEm: parseInt(m[2], 36) };
}

export const urlEntrevista = (id: string, enviadaEm: Date) =>
  `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/desligamento/${encodeURIComponent(tokenEntrevista(id, enviadaEm))}`;
