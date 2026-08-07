import { getMeusProcessos } from "@/modules/portal-candidato/queries";
import { etapaVagaCandidatoLabel } from "@/modules/ats/schemas";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { Badge } from "@/components/ui/badge";

export default async function PortalCandidatoProcessoPage() {
  const processos = await getMeusProcessos();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Meu processo</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe em que etapa está cada processo seletivo em que você participa.
        </p>
      </div>

      {processos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não está em nenhum processo seletivo.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {processos.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{p.cargo}</span>
                <span className="text-xs text-muted-foreground">
                  {p.empresaNome} · {verticalNegocioLabel[p.vertical as keyof typeof verticalNegocioLabel]}
                </span>
              </div>
              <Badge>{etapaVagaCandidatoLabel[p.etapa as keyof typeof etapaVagaCandidatoLabel]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
