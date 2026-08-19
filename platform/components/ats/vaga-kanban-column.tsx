"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { PipelineEtapaClient } from "@/modules/ats/serialize";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function VagaKanbanColumn({
  etapa,
  total,
  valorTotal,
  valorMesAtual,
  mostrarValor,
  children,
}: {
  etapa: PipelineEtapaClient;
  total: number;
  valorTotal: number;
  /** Só preenchido na etapa Fechada — valor das vagas fechadas no mês
   * vigente, exibido acima do valor total acumulado da coluna. */
  valorMesAtual?: number;
  mostrarValor: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2">
      <div className="flex flex-col gap-0.5 px-1">
        {mostrarValor && valorMesAtual != null && valorMesAtual > 0 && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {currency.format(valorMesAtual)} <span className="text-[10px]">no mês</span>
          </span>
        )}
        {mostrarValor && valorTotal > 0 && (
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {currency.format(valorTotal)}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: etapa.cor }} />
          <span className="text-sm font-semibold">{etapa.nome}</span>
          <span className="text-xs text-muted-foreground">{total}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1.5 transition-colors",
          isOver && "border-primary/50 bg-primary/5",
        )}
      >
        {children}
      </div>
    </div>
  );
}
