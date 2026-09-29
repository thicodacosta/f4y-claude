import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Building2, ChevronRight, ShieldCheck } from "lucide-react";
import { getUsuario } from "@/lib/contexto";
import { selecionarOrganizacao, sair } from "@/lib/auth/actions";
import { Container } from "@/components/secao";

export const metadata: Metadata = { title: "Escolher organização" };

export default async function OrganizacoesPage() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/entrar");
  if (!usuario.aceitouTermos) redirect("/aceite");

  return (
    <Container className="max-w-lg py-12 sm:py-16">
      <h1 className="font-heading text-[28px] font-extrabold tracking-tight">Escolha a organização</h1>
      <p className="mt-2 text-muted-foreground">
        {usuario.organizacoes.length > 0
          ? "Você participa de mais de uma organização. Os dados de cada uma ficam separados."
          : "Sua conta ainda não está vinculada a nenhuma organização. Peça um convite ao administrador da sua empresa."}
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {usuario.organizacoes.map((o) => (
          <li key={o.id}>
            <form action={selecionarOrganizacao.bind(null, o.id)}>
              <button
                type="submit"
                className="group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-surface transition-shadow outline-none hover:shadow-hover focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-teal-soft text-teal-strong">
                  <Building2 className="size-5" aria-hidden />
                </span>
                <span className="flex-1 font-semibold">{o.nome}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </form>
          </li>
        ))}
      </ul>

      {usuario.superadmin && (
        <Link
          href="/plataforma"
          className="mt-3 flex items-center gap-4 rounded-lg border border-dashed border-border p-4 text-sm font-medium hover:border-teal"
        >
          <ShieldCheck className="size-5 text-teal-strong" aria-hidden /> Administração JourneyLab
        </Link>
      )}

      <form action={sair} className="mt-8">
        <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
          Sair ({usuario.email})
        </button>
      </form>
    </Container>
  );
}
