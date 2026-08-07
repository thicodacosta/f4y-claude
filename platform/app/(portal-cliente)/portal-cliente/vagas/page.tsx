import Link from "next/link";
import { getVagasDoCliente } from "@/modules/portal-cliente/queries";
import { statusSimplificadoLabel } from "@/modules/portal-cliente/schemas";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { Badge } from "@/components/ui/badge";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  em_andamento: "secondary",
  shortlist_disponivel: "default",
  fechada: "outline",
  encerrada: "outline",
};

export default async function PortalClienteVagasPage() {
  const vagas = await getVagasDoCliente();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Suas vagas</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o andamento dos processos abertos com a Find4You.
        </p>
      </div>

      {vagas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma vaga em andamento no momento.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {vagas.map((v) => (
            <Link
              key={v.id}
              href={`/portal-cliente/vagas/${v.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 hover:bg-muted"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">{v.cargo}</span>
                <span className="text-xs text-muted-foreground">
                  {verticalNegocioLabel[v.vertical as keyof typeof verticalNegocioLabel]}
                  {" · "}
                  {v.posicoesPreenchidas}/{v.quantidadePosicoes} posições preenchidas
                </span>
              </div>
              <Badge variant={statusVariant[v.status]}>{statusSimplificadoLabel[v.status]}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
