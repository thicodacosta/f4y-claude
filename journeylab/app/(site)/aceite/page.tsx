import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUsuario } from "@/lib/contexto";
import { CartaoAuth } from "@/components/auth/cartao-auth";
import { FormularioAceite } from "@/components/auth/formularios";

export const metadata: Metadata = { title: "Aceite dos termos" };

export default async function AceitePage() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/entrar");
  if (usuario.aceitouTermos) redirect("/inicio");
  return (
    <CartaoAuth
      titulo={`Boas-vindas, ${usuario.nome.split(" ")[0]}`}
      descricao="Antes de acessar sua conta, confirme que leu os documentos abaixo."
    >
      <FormularioAceite />
    </CartaoAuth>
  );
}
