import { NextResponse, type NextRequest } from "next/server";
import { requireUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const usuario = await requireUsuario();
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const stateCookie = request.cookies.get("google_oauth_state")?.value;
  const erroOAuth = searchParams.get("error");

  const redirecionarComErro = (motivo: string) =>
    NextResponse.redirect(`${origin}/configuracoes/integracoes?erro=${encodeURIComponent(motivo)}`);

  if (erroOAuth) return redirecionarComErro(erroOAuth);
  if (!code || !state || state !== stateCookie) return redirecionarComErro("estado_invalido");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/integracoes/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return redirecionarComErro("falha_ao_trocar_token");
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = userInfoRes.ok ? ((await userInfoRes.json()) as { email?: string }) : {};

  await prisma.integracaoUsuario.upsert({
    where: { usuarioId_provedor: { usuarioId: usuario.id, provedor: "google" } },
    create: {
      usuarioId: usuario.id,
      provedor: "google",
      contaExterna: userInfo.email ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      contaExterna: userInfo.email ?? null,
      accessToken: tokens.access_token,
      // Google só devolve refresh_token na primeira autorização (prompt=consent
      // força isso a acontecer de novo a cada reconexão, mas defensivamente
      // preserva o antigo se por algum motivo não vier um novo).
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  const response = NextResponse.redirect(`${origin}/configuracoes/integracoes?conectado=google`);
  response.cookies.delete("google_oauth_state");
  return response;
}
