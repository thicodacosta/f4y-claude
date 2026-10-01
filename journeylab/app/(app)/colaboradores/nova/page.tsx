import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { dbTenant } from "@/lib/db";
import { exigirContexto, pode } from "@/lib/contexto";
import { FormPessoa } from "@/components/cadastro/form-pessoa";

export const metadata: Metadata = { title: "Nova pessoa" };

export default async function NovaPessoaPage() {
  const ctx = await exigirContexto();
  if (pode(ctx, "cadastro", "criar") !== "todos") redirect("/colaboradores");
  const db = dbTenant(ctx.org.id, ctx.usuario.id);
  const [equipes, gestores] = await Promise.all([
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: { not: "desligado" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <>
      <div>
        <Link href="/colaboradores" className="text-sm text-muted-foreground hover:text-foreground">← Colaboradores</Link>
        <h1 className="mt-2 font-heading text-2xl font-bold">Nova pessoa</h1>
      </div>
      <FormPessoa equipes={equipes} gestores={gestores} onboardingAutomatico={ctx.modulos.has("onboarding")} />
    </>
  );
}
