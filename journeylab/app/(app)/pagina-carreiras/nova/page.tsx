import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirModulo, pode } from "@/lib/contexto";
import { FormVagaCarreiras } from "@/components/carreiras/form-vaga";

export const metadata: Metadata = { title: "Nova vaga · Página de Carreiras" };

export default async function NovaVaga() {
  const { ctx, db } = await exigirModulo("crm");
  if (!pode(ctx, "crm", "criar") || ctx.suporte) redirect("/pagina-carreiras");
  const [equipes, gestores] = await Promise.all([
    db.equipe.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    db.colaborador.findMany({ where: { status: "ativo" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-4">
      <div>
        <Link href="/pagina-carreiras" className="text-sm text-muted-foreground hover:text-foreground">
          ← Página de Carreiras
        </Link>
        <h2 id="titulo" className="font-heading text-lg font-bold">
          Nova vaga
        </h2>
        <p className="text-sm text-muted-foreground">
          A vaga nasce não publicada. Você ({ctx.usuario.email}) fica registrado como criador e recebe os avisos de candidatura — o e-mail é conferido antes de publicar.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 shadow-surface">
        <FormVagaCarreiras equipes={equipes} gestores={gestores} />
      </div>
    </section>
  );
}
