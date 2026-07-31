"use client";

import { Badge } from "@/components/ui/badge";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ListaView({
  items,
  etapas,
  onCardClick,
}: {
  items: OportunidadeClient[];
  etapas: PipelineEtapaClient[];
  onCardClick: (o: OportunidadeClient) => void;
}) {
  const etapaPorId = new Map(etapas.map((e) => [e.id, e]));
  const ordenados = [...items].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
  );

  if (ordenados.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma oportunidade ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto pb-4">
      {ordenados.map((o) => {
        const etapa = etapaPorId.get(o.etapaId);
        return (
          <button
            key={o.id}
            onClick={() => onCardClick(o)}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 text-left text-sm hover:bg-muted"
          >
            <span className="w-40 shrink-0 truncate font-semibold">{o.empresaNome}</span>
            <Badge variant="secondary" className="shrink-0">
              {verticalNegocioLabel[o.vertical as keyof typeof verticalNegocioLabel]}
            </Badge>
            {etapa && (
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: etapa.cor }} />
                {etapa.nome}
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono tabular-nums">
              {currency.format(o.valorEstimado)}
            </span>
            <span className="w-32 shrink-0 truncate text-muted-foreground">
              {o.responsavelNome ?? "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
