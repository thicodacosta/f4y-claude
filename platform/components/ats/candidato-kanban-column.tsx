"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export function CandidatoKanbanColumn({
  etapaValue,
  nome,
  cor,
  total,
  children,
}: {
  etapaValue: string;
  nome: string;
  cor: string;
  total: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapaValue });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="size-2 rounded-full" style={{ background: cor }} />
        <span className="text-sm font-semibold">{nome}</span>
        <span className="text-xs text-muted-foreground">{total}</span>
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
