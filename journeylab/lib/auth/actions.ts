"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbUsuario } from "@/lib/db";
import { COOKIE_ORG, getContexto, getUsuario } from "@/lib/contexto";
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from "@/lib/legal";
import { aposAutenticar } from "@/lib/auth/pos-login";

export type EstadoForm = { erro?: string; ok?: string; campos?: Record<string, string> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020";

const senhaSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa ter letras.")
  .regex(/\d/, "A senha precisa ter números.");

function destinoSeguro(d: string | null | undefined, padrao = "/inicio") {
  return d && d.startsWith("/") && !d.startsWith("//") ? d : padrao;
}

/** Login no servidor (POST) — funciona antes do JavaScript carregar e nunca expõe credenciais na URL. */
export async function entrar(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha.", campos: { email } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    return {
      erro:
        error.code === "email_not_confirmed"
          ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
          : "E-mail ou senha incorretos.",
      campos: { email },
    };
  }
  await aposAutenticar(data.user);
  // Nova sessão: a organização é escolhida de novo.
  (await cookies()).delete(COOKIE_ORG);
  redirect(destinoSeguro(String(formData.get("redirectTo") ?? "")));
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(COOKIE_ORG);
  redirect("/entrar");
}

export async function solicitarRedefinicao(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { erro: "Informe um e-mail válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${SITE}/auth/confirmar?proximo=/nova-senha`,
  });
  return { ok: "Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha." };
}

export async function definirNovaSenha(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const senha = senhaSchema.safeParse(formData.get("senha"));
  if (!senha.success) return { erro: senha.error.issues[0].message };
  if (formData.get("senha") !== formData.get("confirmacao")) return { erro: "As senhas não conferem." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha.data });
  if (error) return { erro: "Link expirado ou sessão inválida. Solicite uma nova redefinição." };
  redirect("/inicio");
}

export async function aceitarTermos(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await getUsuario();
  if (!usuario) redirect("/entrar");
  if (formData.get("aceite") !== "on") return { erro: "É preciso aceitar os Termos de uso e a Política de privacidade." };
  await dbUsuario(usuario.id).consentimento.createMany({
    data: [
      { usuarioId: usuario.id, tipo: "termos", versao: VERSAO_TERMOS, aceito: true },
      { usuarioId: usuario.id, tipo: "privacidade", versao: VERSAO_PRIVACIDADE, aceito: true },
    ],
  });
  redirect("/inicio");
}

/** Troca a organização ativa — aceita só organizações às quais o usuário pertence. */
export async function selecionarOrganizacao(orgId: string) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/entrar");
  if (!usuario.organizacoes.some((o) => o.id === orgId)) redirect("/organizacoes");
  (await cookies()).set(COOKIE_ORG, orgId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/inicio");
}

/** Usado pelo servidor para confirmar que a sessão ainda tem contexto válido. */
export async function contextoAtual() {
  return Boolean(await getContexto());
}
