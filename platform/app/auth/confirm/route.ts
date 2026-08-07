import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

const TIPOS_VALIDOS: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Troca o `token_hash` do e-mail (convite ou magic link, Fase 7) por uma
 * sessão via cookie. Fluxo recomendado pelo Supabase para apps SSR — a
 * alternativa (`.ConfirmationURL` padrão do GoTrue) entrega a sessão como
 * fragmento de URL, que só client-side JS enxerga, incompatível com nossos
 * Server Components/Server Actions que leem sessão via cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (!tokenHash || !type || !TIPOS_VALIDOS.includes(type)) {
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=link_expirado`);
  }

  return response;
}
