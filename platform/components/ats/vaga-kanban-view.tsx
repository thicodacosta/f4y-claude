"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { VagaKanbanColumn } from "@/components/ats/vaga-kanban-column";
import { VagaKanbanCard } from "@/components/ats/vaga-kanban-card";
import { formatMesAno } from "@/lib/format";
import type { VagaClient, PipelineEtapaClient } from "@/modules/ats/serialize";

function agruparPor(vagas: VagaClient[], chave: (v: VagaClient) => string) {
  const grupos = new Map<string, VagaClient[]>();
  for (const v of vagas) {
    const k = chave(v);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(v);
  }
  return [...grupos.entries()];
}

/** Bloco colapsável reaproveitado pelos dois agrupamentos da coluna (por mês
 * de fechamento na etapa Fechada, por cliente nas demais) — coluna que
 * acumula muitos cards vira uma lista rolável longa demais sem isso. */
function GrupoColapsavel({
  titulo,
  vagas,
  aberto,
  onCardClick,
  mostrarValor,
}: {
  titulo: string;
  vagas: VagaClient[];
  aberto: boolean;
  onCardClick: (v: VagaClient) => void;
  mostrarValor: boolean;
}) {
  return (
    <details open={aberto} className="group/grupo">
      <summary className="flex cursor-pointer select-none items-center gap-1 py-1 text-xs font-medium text-muted-foreground">
        <ChevronRight className="size-3 shrink-0 transition-transform group-open/grupo:rotate-90" />
        {titulo} ({vagas.length})
      </summary>
      <div className="flex flex-col gap-2 pt-1.5">
        {vagas.map((v) => (
          <VagaKanbanCard key={v.id} vaga={v} onClick={() => onCardClick(v)} mostrarValor={mostrarValor} />
        ))}
      </div>
    </details>
  );
}

export function VagaKanbanView({
  etapas,
  items,
  onCardClick,
  onMove,
  onFechar,
  mostrarValor,
}: {
  etapas: PipelineEtapaClient[];
  items: VagaClient[];
  onCardClick: (v: VagaClient) => void;
  onMove: (vagaId: string, novaEtapaId: string) => void;
  /** Etapa de destino é Ganho — abre o pop-up de fechamento em vez de mover
   * direto (ver components/ats/fechar-vaga-dialog.tsx). */
  onFechar: (vaga: VagaClient, novaEtapaId: string) => void;
  mostrarValor: boolean;
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
    const novaEtapa = etapas.find((e) => e.id === novaEtapaId);
    if (novaEtapa?.isGanho) {
      onFechar(atual, novaEtapaId);
      return;
    }
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
          // Fluxo normal (Abertas, Análise RH, CV Enviado, Entrevista
          // Cliente, Forecast) agrupa por cliente; Fechada agrupa por mês;
          // Perdida e Stand By ficam como lista plana mesmo (não pedido).
          let conteudo: React.ReactNode;
          if (etapa.isGanho) {
            const grupos = agruparPor(daEtapa, (v) => (v.fechadoEm ? v.fechadoEm.slice(0, 7) : "sem-data")).sort(
              (a, b) => b[0].localeCompare(a[0]),
            );
            conteudo = grupos.map(([chave, vagasDoGrupo], i) => (
              <GrupoColapsavel
                key={chave}
                titulo={chave === "sem-data" ? "Sem data" : formatMesAno(chave)}
                vagas={vagasDoGrupo}
                aberto={i === 0}
                onCardClick={onCardClick}
                mostrarValor={mostrarValor}
              />
            ));
          } else if (!etapa.isPerdido && !etapa.isPausada) {
            const grupos = agruparPor(daEtapa, (v) => v.empresaNome).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
            conteudo = grupos.map(([empresa, vagasDoGrupo]) => (
              <GrupoColapsavel
                key={empresa}
                titulo={empresa}
                vagas={vagasDoGrupo}
                aberto={false}
                onCardClick={onCardClick}
                mostrarValor={mostrarValor}
              />
            ));
          } else {
            conteudo = daEtapa.map((v) => (
              <VagaKanbanCard key={v.id} vaga={v} onClick={() => onCardClick(v)} mostrarValor={mostrarValor} />
            ));
          }

          return (
            <VagaKanbanColumn key={etapa.id} etapa={etapa} total={daEtapa.length}>
              {conteudo}
            </VagaKanbanColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeCard ? <VagaKanbanCard vaga={activeCard} onClick={() => {}} mostrarValor={mostrarValor} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
