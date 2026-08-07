"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { VagaKanbanColumn } from "@/components/ats/vaga-kanban-column";
import { VagaKanbanCard } from "@/components/ats/vaga-kanban-card";
import type { VagaClient, PipelineEtapaClient } from "@/modules/ats/serialize";

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
              {daEtapa.map((v) => (
                <VagaKanbanCard key={v.id} vaga={v} onClick={() => onCardClick(v)} />
              ))}
            </VagaKanbanColumn>
          );
        })}
      </div>
      <DragOverlay>{activeCard ? <VagaKanbanCard vaga={activeCard} onClick={() => {}} /> : null}</DragOverlay>
    </DndContext>
  );
}
