import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CartaoAuth } from "@/components/auth/cartao-auth";
import { FormularioLogin } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <CartaoAuth
      titulo="Entrar"
      descricao="Acesse os produtos JourneyLab contratados pela sua organização."
      rodape={
        <>
          Recebeu um convite? Use o link do e-mail para criar sua senha.{" "}
          <Link href="/recuperar-senha" className="font-medium text-teal-strong underline-offset-2 hover:underline">
            Esqueci minha senha
          </Link>
        </>
      }
    >
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </CartaoAuth>
  );
}
