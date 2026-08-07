import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireUsuario } from "@/lib/auth";

/** GET /api/integracoes/linkedin/connect — "Sign in with LinkedIn using
 * OpenID Connect". Só identificação (perfil básico + e-mail) — a API do
 * LinkedIn não libera Recruiter/import de contatos pra apps de terceiros
 * comuns, ver modules/integracoes/schemas.ts. */
export async function GET(request: NextRequest) {
  await requireUsuario();

  const { origin } = new URL(request.url);
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${origin}/api/integracoes/linkedin/callback`,
    scope: "openid profile email",
    state,
  });

  const response = NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
  response.cookies.set("linkedin_oauth_state", state, { httpOnly: true, maxAge: 600, sameSite: "lax" });
  return response;
}
