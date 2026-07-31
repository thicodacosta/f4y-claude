"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/crm/kanban-column";
import { KanbanCard } from "@/components/crm/kanban-card";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";

export function KanbanView({
  etapas,
  items,
  onCardClick,
  onMove,
}: {
  etapas: PipelineEtapaClient[];
  items: OportunidadeClient[];
  onCardClick: (o: OportunidadeClient) => void;
  onMove: (oportunidadeId: string, novaEtapaId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const oportunidadeId = String(active.id);
    const novaEtapaId = String(over.id);
    const atual = items.find((o) => o.id === oportunidadeId);
    if (!atual || atual.etapaId === novaEtapaId) return;
    onMove(oportunidadeId, novaEtapaId);
  }

  const activeCard = activeId ? items.find((o) => o.id === activeId) : null;

  return (
    <DndContext
      id="kanban-pipeline-comercial"
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {etapas.map((etapa) => {
          const doEtapa = items.filter((o) => o.etapaId === etapa.id);
          return (
            <KanbanColumn key={etapa.id} etapa={etapa} total={doEtapa.length}>
              {doEtapa.map((o) => (
                <KanbanCard key={o.id} oportunidade={o} onClick={() => onCardClick(o)} />
              ))}
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeCard ? <KanbanCard oportunidade={activeCard} onClick={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
