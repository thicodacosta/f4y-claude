import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/portal-login", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    // Fase 7 — quem tenta um link direto de portal sem sessão vai pra tela de
    // login do portal (sem senha), não pra tela de login interno da equipe.
    const isPortalPath =
      request.nextUrl.pathname.startsWith("/portal-cliente") ||
      request.nextUrl.pathname.startsWith("/portal-candidato");
    url.pathname = isPortalPath ? "/portal-login" : "/login";
    if (!isPortalPath) url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/portal-login"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
