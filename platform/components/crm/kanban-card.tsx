"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { OportunidadeClient } from "@/modules/crm/serialize";

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function KanbanCard({
  oportunidade,
  onClick,
}: {
  oportunidade: OportunidadeClient;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: oportunidade.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm outline-none active:cursor-grabbing",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight">{oportunidade.empresaNome}</span>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Badge variant="secondary">
            {verticalNegocioLabel[oportunidade.vertical as keyof typeof verticalNegocioLabel]}
          </Badge>
          {oportunidade.executiveSearch && <Badge>Executive Search</Badge>}
        </div>
      </div>
      {oportunidade.contatoNome && (
        <span className="text-xs text-muted-foreground">{oportunidade.contatoNome}</span>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {currency.format(oportunidade.valorEstimado)}
        </span>
        {oportunidade.probabilidade !== null && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {oportunidade.probabilidade}%
          </span>
        )}
      </div>
      {oportunidade.responsavelNome && (
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {initials(oportunidade.responsavelNome)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{oportunidade.responsavelNome}</span>
        </div>
      )}
    </div>
  );
}
