"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarEtapa, atualizarEtapa, excluirEtapa, reordenarEtapas } from "@/modules/crm/actions";
import type { PipelineEtapaClient } from "@/modules/crm/serialize";

const CORES_PRESET = ["#9297A0", "#28AAF0", "#5860A9", "#F5A623", "#15A66B", "#E5484D"];

export function PipelineEtapasEditor({
  pipelineId,
  etapasIniciais,
}: {
  pipelineId: string;
  etapasIniciais: PipelineEtapaClient[];
}) {
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [excluindo, setExcluindo] = useState<PipelineEtapaClient | null>(null);
  const [destinoId, setDestinoId] = useState("");
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const normais = etapas.filter((e) => !e.isGanho && !e.isPerdido).sort((a, b) => a.ordem - b.ordem);
  const fixas = etapas.filter((e) => e.isGanho || e.isPerdido).sort((a, b) => a.ordem - b.ordem);

  function atualizarLocal(id: string, patch: Partial<PipelineEtapaClient>) {
    setEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function salvar(id: string, patch: { nome?: string; cor?: string; slaDias?: number | null; probabilidadePadrao?: number | null }) {
    startTransition(async () => {
      try {
        await atualizarEtapa({ etapaId: id, ...patch });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = normais.findIndex((e) => e.id === active.id);
    const newIndex = normais.findIndex((e) => e.id === over.id);
    const reordenadas = arrayMove(normais, oldIndex, newIndex);
    setEtapas([...reordenadas, ...fixas]);

    startTransition(async () => {
      try {
        await reordenarEtapas({ pipelineId, ordem: reordenadas.map((e) => e.id) });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível reordenar.");
      }
    });
  }

  function adicionarEtapa() {
    startTransition(async () => {
      try {
        const nova = await criarEtapa({ pipelineId, nome: "Nova etapa", cor: "#9297A0" });
        setEtapas((prev) => [...prev, nova]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível criar a etapa.");
      }
    });
  }

  function confirmarExclusao() {
    if (!excluindo || !destinoId) return;
    startTransition(async () => {
      try {
        await excluirEtapa({ etapaId: excluindo.id, etapaDestinoId: destinoId });
        setEtapas((prev) => prev.filter((e) => e.id !== excluindo.id));
        setExcluindo(null);
        setDestinoId("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <DndContext id="pipeline-etapas-editor" sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={normais.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {normais.map((etapa) => (
              <EtapaRow
                key={etapa.id}
                etapa={etapa}
                sortable
                onChange={(patch) => atualizarLocal(etapa.id, patch)}
                onSave={(patch) => salvar(etapa.id, patch)}
                onDelete={() => setExcluindo(etapa)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="outline" onClick={adicionarEtapa} className="w-fit">
        <Plus />
        Nova etapa
      </Button>

      <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Etapas fixas (sempre ao final)
        </p>
        {fixas.map((etapa) => (
          <EtapaRow
            key={etapa.id}
            etapa={etapa}
            sortable={false}
            onChange={(patch) => atualizarLocal(etapa.id, patch)}
            onSave={(patch) => salvar(etapa.id, patch)}
          />
        ))}
      </div>

      <Dialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir etapa &quot;{excluindo?.nome}&quot;</DialogTitle>
            <DialogDescription>
              Oportunidades nesta etapa precisam ir para outra — escolha o destino.
            </DialogDescription>
          </DialogHeader>
          <Select
            items={Object.fromEntries(
              etapas.filter((e) => e.id !== excluindo?.id).map((e) => [e.id, e.nome]),
            )}
            value={destinoId}
            onValueChange={(v) => setDestinoId(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Etapa de destino" />
            </SelectTrigger>
            <SelectContent>
              {etapas.filter((e) => e.id !== excluindo?.id).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!destinoId} onClick={confirmarExclusao}>
              <Trash2 />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EtapaRow({
  etapa,
  sortable,
  onChange,
  onSave,
  onDelete,
}: {
  etapa: PipelineEtapaClient;
  sortable: boolean;
  onChange: (patch: Partial<PipelineEtapaClient>) => void;
  onSave: (patch: { nome?: string; cor?: string; slaDias?: number | null; probabilidadePadrao?: number | null }) => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: etapa.id,
    disabled: !sortable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
    >
      {sortable ? (
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing">
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="size-4" />
      )}

      <div className="flex gap-1">
        {CORES_PRESET.map((cor) => (
          <button
            key={cor}
            type="button"
            className="size-4 rounded-full ring-offset-1"
            style={{ background: cor, outline: etapa.cor === cor ? `2px solid ${cor}` : undefined, outlineOffset: 2 }}
            onClick={() => {
              onChange({ cor });
              onSave({ cor });
            }}
          />
        ))}
      </div>

      <Input
        value={etapa.nome}
        onChange={(e) => onChange({ nome: e.target.value })}
        onBlur={(e) => onSave({ nome: e.target.value })}
        className="h-8 flex-1"
      />

      <Input
        type="number"
        placeholder="SLA (dias)"
        value={etapa.slaDias ?? ""}
        onChange={(e) => onChange({ slaDias: e.target.value ? Number(e.target.value) : null })}
        onBlur={(e) => onSave({ slaDias: e.target.value ? Number(e.target.value) : null })}
        className="h-8 w-28"
      />

      <Input
        type="number"
        placeholder="Prob. %"
        value={etapa.probabilidadePadrao ?? ""}
        onChange={(e) => onChange({ probabilidadePadrao: e.target.value ? Number(e.target.value) : null })}
        onBlur={(e) => onSave({ probabilidadePadrao: e.target.value ? Number(e.target.value) : null })}
        className="h-8 w-24"
      />

      {onDelete && (
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={isDragging}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
