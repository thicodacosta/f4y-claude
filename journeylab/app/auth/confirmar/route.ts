import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { aposAutenticar } from "@/lib/auth/pos-login";

/**
 * Destino dos links de e-mail (confirmação de cadastro e redefinição de
 * senha). Aceita o fluxo PKCE (`code`) e o de token (`token_hash` + `type`).
 * `proximo` só aceita caminho interno — evita redirecionamento aberto.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const proximoBruto = url.searchParams.get("proximo") ?? "/inicio";
  const proximo = proximoBruto.startsWith("/") && !proximoBruto.startsWith("//") ? proximoBruto : "/inicio";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const r = await supabase.auth.exchangeCodeForSession(code);
    ok = !r.error;
    if (ok) await aposAutenticar(r.data.user);
  } else if (tokenHash && tipo) {
    const r = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    ok = !r.error;
    if (ok) await aposAutenticar(r.data.user);
  }

  const destino = url.clone();
  destino.search = "";
  if (ok) {
    destino.pathname = proximo;
  } else {
    destino.pathname = "/entrar";
    destino.searchParams.set("erro", "link");
  }
  return NextResponse.redirect(destino);
}
