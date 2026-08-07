import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireUsuario } from "@/lib/auth";

const ESCOPOS = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"].join(" ");

/** GET /api/integracoes/google/connect — inicia o fluxo OAuth do Google. Por
 * usuário (não uma conta única da empresa): cada pessoa conecta o próprio
 * Gmail — ver comentário no schema (IntegracaoUsuario). `access_type=offline`
 * + `prompt=consent` garantem um refresh_token mesmo em reconexão. */
export async function GET(request: NextRequest) {
  await requireUsuario();

  const { origin } = new URL(request.url);
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/integracoes/google/callback`,
    response_type: "code",
    scope: ESCOPOS,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("google_oauth_state", state, { httpOnly: true, maxAge: 600, sameSite: "lax" });
  return response;
}
