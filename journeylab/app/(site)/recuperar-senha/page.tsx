import Link from "next/link";
import type { Metadata } from "next";
import { CartaoAuth } from "@/components/auth/cartao-auth";
import { FormularioRecuperar } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <CartaoAuth
      titulo="Recuperar senha"
      descricao="Enviaremos um link para você criar uma nova senha."
      rodape={
        <Link href="/entrar" className="font-medium text-primary underline-offset-2 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <FormularioRecuperar />
    </CartaoAuth>
  );
}
