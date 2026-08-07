import { NextResponse, type NextRequest } from "next/server";
import { requireUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const usuario = await requireUsuario();
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stateCookie = request.cookies.get("linkedin_oauth_state")?.value;
  const erroOAuth = searchParams.get("error");

  const redirecionarComErro = (motivo: string) =>
    NextResponse.redirect(`${origin}/configuracoes/integracoes?erro=${encodeURIComponent(motivo)}`);

  if (erroOAuth) return redirecionarComErro(erroOAuth);
  if (!code || !state || state !== stateCookie) return redirecionarComErro("estado_invalido");

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/integracoes/linkedin/callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) return redirecionarComErro("falha_ao_trocar_token");
  const tokens = (await tokenRes.json()) as { access_token: string; expires_in: number; refresh_token?: string };

  const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = userInfoRes.ok ? ((await userInfoRes.json()) as { name?: string; email?: string }) : {};

  await prisma.integracaoUsuario.upsert({
    where: { usuarioId_provedor: { usuarioId: usuario.id, provedor: "linkedin" } },
    create: {
      usuarioId: usuario.id,
      provedor: "linkedin",
      contaExterna: userInfo.name ?? userInfo.email ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      contaExterna: userInfo.name ?? userInfo.email ?? null,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  const response = NextResponse.redirect(`${origin}/configuracoes/integracoes?conectado=linkedin`);
  response.cookies.delete("linkedin_oauth_state");
  return response;
}
