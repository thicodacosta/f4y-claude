"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VagaKanbanView } from "@/components/ats/vaga-kanban-view";
import { NovaVagaDialog } from "@/components/ats/nova-vaga-dialog";
import { moverVaga } from "@/modules/ats/actions";
import type { VagaClient, PipelineEtapaClient } from "@/modules/ats/serialize";

export function PipelineVagasView({
  etapas,
  vagas,
  empresas,
}: {
  etapas: PipelineEtapaClient[];
  vagas: VagaClient[];
  empresas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(vagas);
  const [vagasAnteriores, setVagasAnteriores] = useState(vagas);
  if (vagas !== vagasAnteriores) {
    setVagasAnteriores(vagas);
    setItems(vagas);
  }

  const [novaAberta, setNovaAberta] = useState(false);
  const [, startTransition] = useTransition();

  function handleMove(vagaId: string, novaEtapaId: string) {
    const anterior = items;
    setItems((prev) => prev.map((v) => (v.id === vagaId ? { ...v, etapaId: novaEtapaId } : v)));

    startTransition(async () => {
      try {
        await moverVaga({ vagaId, novaEtapaId });
      } catch (err) {
        setItems(anterior);
        toast.error(err instanceof Error ? err.message : "Não foi possível mover a vaga.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={() => setNovaAberta(true)}>
          <Plus />
          Nova vaga
        </Button>
      </div>

      <VagaKanbanView
        etapas={etapas}
        items={items}
        onCardClick={(v) => router.push(`/vagas/${v.id}`)}
        onMove={handleMove}
      />

      <NovaVagaDialog
        open={novaAberta}
        onOpenChange={setNovaAberta}
        empresas={empresas}
        onCriada={(vagaId) => router.push(`/vagas/${vagaId}`)}
      />
    </div>
  );
}
