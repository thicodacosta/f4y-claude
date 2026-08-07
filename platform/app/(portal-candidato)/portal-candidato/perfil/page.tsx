import { getMeuPerfil, getMinhasEdicoesPendentes } from "@/modules/portal-candidato/queries";
import { PerfilForm } from "@/components/portal-candidato/perfil-form";
import { Badge } from "@/components/ui/badge";

const statusEdicaoLabel: Record<string, string> = {
  pendente: "Aguardando revisão",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const statusEdicaoVariant: Record<string, "secondary" | "default" | "outline"> = {
  pendente: "secondary",
  aprovada: "default",
  rejeitada: "outline",
};

export default async function PortalCandidatoPerfilPage() {
  const [perfil, edicoes] = await Promise.all([getMeuPerfil(), getMinhasEdicoesPendentes()]);
  const temPendente = edicoes.some((e) => e.status === "pendente");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Suas alterações passam por uma revisão rápida da equipe Find4You antes de valer no seu
          perfil.
        </p>
      </div>

      <PerfilForm perfil={perfil} temPendente={temPendente} />

      {edicoes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-semibold">Histórico de edições</h2>
          {edicoes.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <span className="text-muted-foreground">
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(e.criadoEm),
                )}
              </span>
              <Badge variant={statusEdicaoVariant[e.status]}>{statusEdicaoLabel[e.status]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
