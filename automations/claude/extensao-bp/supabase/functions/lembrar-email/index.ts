// "Esqueci o e-mail": pelo CPF do cadastro, devolve o e-mail da conta
// parcialmente oculto (ex.: a•••••@gmail.com), para a pessoa reconhecer.
//
//   POST { cpf } → { ok, emails: string[] }
//
// Limite: 5 consultas por conexão a cada hora.
import { admin, cpfValido } from "../_shared/acesso.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const json = (dados: unknown, status = 200) => Response.json(dados, { status, headers: CORS });
const LIMITE_POR_HORA = 5;

const ocultar = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${"•".repeat(Math.min(b.length, 6))}${c}`);

async function hashIp(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "desconhecido";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`candydate:${ip}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, motivo: "Método não permitido." }, 405);
  try {
    const corpo = await req.json().catch(() => ({}));
    const cpf = cpfValido(String(corpo.cpf ?? ""));
    if (!cpf) return json({ ok: false, motivo: "Informe um CPF válido." }, 400);

    const ip = await hashIp(req);
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("lembretes_email").select("id", { count: "exact", head: true }).eq("ip_hash", ip).gte("criado_em", desde);
    if ((count ?? 0) >= LIMITE_POR_HORA) return json({ ok: false, motivo: "Muitas consultas em pouco tempo. Tente de novo em uma hora." }, 429);
    await admin.from("lembretes_email").insert({ ip_hash: ip });

    const { data } = await admin.from("clientes").select("email").eq("cpf", cpf).order("criado_em").limit(5);
    return json({ ok: true, emails: (data ?? []).map((c) => ocultar(c.email)) });
  } catch (e) {
    console.error(e);
    return json({ ok: false, motivo: "Não foi possível procurar agora. Tente novamente em instantes." }, 500);
  }
});
