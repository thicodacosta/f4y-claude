"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CandidatoKanbanColumn } from "@/components/ats/candidato-kanban-column";
import { CandidatoKanbanCard } from "@/components/ats/candidato-kanban-card";
import { etapaVagaCandidatoValues, etapaVagaCandidatoLabel, etapaVagaCandidatoCor } from "@/modules/ats/schemas";
import type { VagaCandidatoClient } from "@/modules/ats/serialize";

export function CandidatoKanbanView({
  items,
  onCardClick,
  onMove,
}: {
  items: VagaCandidatoClient[];
  onCardClick: (vc: VagaCandidatoClient) => void;
  onMove: (vagaCandidatoId: string, novaEtapa: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const vagaCandidatoId = String(active.id);
    const novaEtapa = String(over.id);
    const atual = items.find((vc) => vc.id === vagaCandidatoId);
    if (!atual || atual.etapa === novaEtapa) return;
    onMove(vagaCandidatoId, novaEtapa);
  }

  const activeCard = activeId ? items.find((vc) => vc.id === activeId) : null;

  return (
    <DndContext
      id="kanban-vaga-candidatos"
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {etapaVagaCandidatoValues.map((etapa) => {
          const daEtapa = items.filter((vc) => vc.etapa === etapa);
          return (
            <CandidatoKanbanColumn
              key={etapa}
              etapaValue={etapa}
              nome={etapaVagaCandidatoLabel[etapa]}
              cor={etapaVagaCandidatoCor[etapa]}
              total={daEtapa.length}
            >
              {daEtapa.map((vc) => (
                <CandidatoKanbanCard key={vc.id} vagaCandidato={vc} onClick={() => onCardClick(vc)} />
              ))}
            </CandidatoKanbanColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeCard ? <CandidatoKanbanCard vagaCandidato={activeCard} onClick={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
