import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getVagaDoCliente } from "@/modules/portal-cliente/queries";
import { statusSimplificadoLabel } from "@/modules/portal-cliente/schemas";
import { ShortlistCard } from "@/components/portal-cliente/shortlist-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function PortalClienteVagaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vaga = await getVagaDoCliente(id);
  if (!vaga) notFound();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/portal-cliente/vagas">
        <Button variant="ghost" size="sm" className="w-fit">
          <ArrowLeft />
          Voltar
        </Button>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">{vaga.cargo}</h1>
        </div>
        <Badge>{statusSimplificadoLabel[vaga.status]}</Badge>
      </div>

      {vaga.jobDescription && (
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm font-semibold">Descrição da posição</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{vaga.jobDescription}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-semibold">Shortlist ({vaga.shortlist.length})</h2>
        {vaga.shortlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há candidatos em shortlist para esta vaga.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {vaga.shortlist.map((c) => (
              <ShortlistCard key={c.id} candidato={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
