// Situação do plano da conta logada e registro do consumo de IA.
//
//   GET  ?produto=bp|recruiter          → situação (teste com % usado, assinatura, bloqueio)
//   POST { produto, tokens }            → soma o consumo e devolve a situação atualizada
//
// As extensões chamam com o token da sessão (Authorization: Bearer <jwt>). O
// teste gratuito acaba aqui, no servidor, ao atingir 100 mil tokens ou 3 dias.
import { admin, PRODUTOS_VALIDOS, situacao } from "../_shared/acesso.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const json = (dados: unknown, status = 200) => Response.json(dados, { status, headers: CORS });
const CHECKOUT = (Deno.env.get("CHECKOUT_URL") ?? "https://thicodacosta.github.io/candydate-acesso/assinar/").replace(/\/?$/, "/");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data, error } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: true };
  const user = data?.user;
  if (error || !user?.email) return json({ ok: false, motivo: "Sessão inválida." }, 401);

  try {
    let produto: string;
    let tokens = 0;
    if (req.method === "POST") {
      const corpo = await req.json().catch(() => ({}));
      produto = String(corpo.produto ?? "");
      // Teto por chamada, para um valor absurdo não zerar o teste de uma vez.
      tokens = Math.max(0, Math.min(500_000, Math.round(Number(corpo.tokens) || 0)));
    } else {
      produto = new URL(req.url).searchParams.get("produto") ?? "";
    }
    if (!PRODUTOS_VALIDOS.has(produto)) return json({ ok: false, motivo: "Produto inválido." }, 400);
    if (req.method === "POST" && tokens > 0) await admin.rpc("registrar_uso", { p_user: user.id, p_produto: produto, p_tokens: tokens });

    const produtos = Array.isArray(user.app_metadata?.produtos) ? user.app_metadata.produtos : [];
    const s = await situacao(user.id, user.email.toLowerCase(), produto, produtos);
    return json({ ok: true, produto, email: user.email, checkout: `${CHECKOUT}?plano=${produto}`, ...s });
  } catch (e) {
    console.error(e);
    return json({ ok: false, motivo: "Não foi possível consultar o plano." }, 500);
  }
});
