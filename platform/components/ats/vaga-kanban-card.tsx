"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { prioridadeVagaLabel } from "@/modules/ats/schemas";
import type { VagaClient } from "@/modules/ats/serialize";

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const prioridadeCor: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-primary/10 text-primary",
  alta: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  urgente: "bg-destructive/10 text-destructive",
};

export function VagaKanbanCard({ vaga, onClick }: { vaga: VagaClient; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: vaga.id });

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
        <span className="text-sm font-semibold leading-tight">{vaga.cargo}</span>
        <Badge variant="secondary" className="shrink-0">
          {verticalNegocioLabel[vaga.vertical as keyof typeof verticalNegocioLabel]}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground">{vaga.empresaNome}</span>
      <div className="flex items-center justify-between">
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", prioridadeCor[vaga.prioridade])}>
          {prioridadeVagaLabel[vaga.prioridade as keyof typeof prioridadeVagaLabel]}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {vaga.posicoesPreenchidas}/{vaga.quantidadePosicoes} posições
        </span>
      </div>
      {vaga.recrutadorNome && (
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {initials(vaga.recrutadorNome)}
          </span>
          <span className="truncate text-xs text-muted-foreground">{vaga.recrutadorNome}</span>
        </div>
      )}
    </div>
  );
}
