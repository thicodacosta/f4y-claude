import Link from "next/link";
import { GitPullRequest, ChevronRight } from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ADMIN } from "@/lib/roles";

export default async function ConfiguracoesPage() {
  await requirePapel(PAPEIS_ADMIN);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Automações, usuários e integrações chegam nas próximas fases — ver
          docs/business-platform/plano-modulos.md.
        </p>
      </div>
      <Link
        href="/configuracoes/pipelines"
        className="flex max-w-md items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
      >
        <GitPullRequest className="size-5 text-primary" />
        <div className="flex-1">
          <div className="font-semibold">Pipelines</div>
          <div className="text-sm text-muted-foreground">
            Etapas, cores, SLA e probabilidade do Pipeline Comercial
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
