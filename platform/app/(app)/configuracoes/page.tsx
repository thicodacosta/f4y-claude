import Link from "next/link";
import { GitPullRequest, Zap, Target, Plug, ChevronRight } from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { PAPEIS_ADMIN, PAPEIS_INTERNOS } from "@/lib/roles";

export default async function ConfiguracoesPage() {
  const usuario = await requirePapel(PAPEIS_INTERNOS);
  const isAdmin = !!usuario.papel && PAPEIS_ADMIN.includes(usuario.papel);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Configurações administrativas e suas integrações pessoais."
            : "Conecte suas contas pessoais usadas pela plataforma."}
        </p>
      </div>
      <div className="flex max-w-md flex-col gap-3">
        {isAdmin && (
          <>
            <Link
              href="/configuracoes/pipelines"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
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
            <Link
              href="/configuracoes/automacoes"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
            >
              <Zap className="size-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold">Automações</div>
                <div className="text-sm text-muted-foreground">Regras ativas e histórico de execução</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              href="/configuracoes/metas"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
            >
              <Target className="size-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold">Metas</div>
                <div className="text-sm text-muted-foreground">
                  Metas mensais de comercial e recrutamento por pessoa
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </>
        )}
        <Link
          href="/configuracoes/integracoes"
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
        >
          <Plug className="size-5 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Integrações</div>
            <div className="text-sm text-muted-foreground">Conecte seu Gmail, LinkedIn e WhatsApp pessoais</div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
