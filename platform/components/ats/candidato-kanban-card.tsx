"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { VagaCandidatoClient } from "@/modules/ats/serialize";

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function CandidatoKanbanCard({
  vagaCandidato,
  onClick,
}: {
  vagaCandidato: VagaCandidatoClient;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: vagaCandidato.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const { candidato } = vagaCandidato;

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
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {initials(candidato.nome)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold leading-tight">{candidato.nome}</span>
          {candidato.cargoAtual && (
            <span className="truncate text-xs text-muted-foreground">{candidato.cargoAtual}</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        {vagaCandidato.fitScore !== null ? (
          <Badge variant="secondary">Fit {vagaCandidato.fitScore}%</Badge>
        ) : (
          <span />
        )}
        {candidato.cidade && <span className="text-xs text-muted-foreground">{candidato.cidade}</span>}
      </div>
    </div>
  );
}
