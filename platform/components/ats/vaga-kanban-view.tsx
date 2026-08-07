"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { VagaKanbanColumn } from "@/components/ats/vaga-kanban-column";
import { VagaKanbanCard } from "@/components/ats/vaga-kanban-card";
import { formatMesAno } from "@/lib/format";
import type { VagaClient, PipelineEtapaClient } from "@/modules/ats/serialize";

/** Agrupa por mês de fechadoEm, mais recente primeiro — usado só na coluna
 * Fechada (etapa.isGanho), que acumula cards indefinidamente e vira uma
 * lista longa demais pra rolar sem essa quebra. */
function agruparPorMesFechamento(vagas: VagaClient[]) {
  const grupos = new Map<string, VagaClient[]>();
  for (const v of vagas) {
    const chave = v.fechadoEm ? v.fechadoEm.slice(0, 7) : "sem-data";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(v);
  }
  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function VagaKanbanView({
  etapas,
  items,
  onCardClick,
  onMove,
}: {
  etapas: PipelineEtapaClient[];
  items: VagaClient[];
  onCardClick: (v: VagaClient) => void;
  onMove: (vagaId: string, novaEtapaId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const vagaId = String(active.id);
    const novaEtapaId = String(over.id);
    const atual = items.find((v) => v.id === vagaId);
    if (!atual || atual.etapaId === novaEtapaId) return;
    onMove(vagaId, novaEtapaId);
  }

  const activeCard = activeId ? items.find((v) => v.id === activeId) : null;

  return (
    <DndContext
      id="kanban-pipeline-vagas"
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {etapas.map((etapa) => {
          const daEtapa = items.filter((v) => v.etapaId === etapa.id);
          return (
            <VagaKanbanColumn key={etapa.id} etapa={etapa} total={daEtapa.length}>
              {etapa.isGanho
                ? agruparPorMesFechamento(daEtapa).map(([mes, vagasDoMes], i) => (
                    <details key={mes} open={i === 0} className="group/mes">
                      <summary className="flex cursor-pointer select-none items-center gap-1 py-1 text-xs font-medium text-muted-foreground">
                        <ChevronRight className="size-3 shrink-0 transition-transform group-open/mes:rotate-90" />
                        {mes === "sem-data" ? "Sem data" : formatMesAno(mes)} ({vagasDoMes.length})
                      </summary>
                      <div className="flex flex-col gap-2 pt-1.5">
                        {vagasDoMes.map((v) => (
                          <VagaKanbanCard key={v.id} vaga={v} onClick={() => onCardClick(v)} />
                        ))}
                      </div>
                    </details>
                  ))
                : daEtapa.map((v) => <VagaKanbanCard key={v.id} vaga={v} onClick={() => onCardClick(v)} />)}
            </VagaKanbanColumn>
          );
        })}
      </div>
      <DragOverlay>{activeCard ? <VagaKanbanCard vaga={activeCard} onClick={() => {}} /> : null}</DragOverlay>
    </DndContext>
  );
}
