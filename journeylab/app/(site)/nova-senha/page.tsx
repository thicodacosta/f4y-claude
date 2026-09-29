import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUsuario } from "@/lib/contexto";
import { CartaoAuth } from "@/components/auth/cartao-auth";
import { FormularioNovaSenha } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Criar senha" };

/** Fora da área logada: quem chega por convite cria a senha antes do aceite dos termos. */
export default async function NovaSenhaPage() {
  if (!(await getUsuario())) redirect("/entrar");
  return (
    <CartaoAuth titulo="Criar sua senha" descricao="Mínimo de 8 caracteres, com letras e números.">
      <FormularioNovaSenha />
    </CartaoAuth>
  );
}
