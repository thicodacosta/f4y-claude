"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanView } from "@/components/crm/kanban-view";
import { ListaView } from "@/components/crm/lista-view";
import { TabelaView } from "@/components/crm/tabela-view";
import { FiltrosBar, aplicarFiltros, type Filtros } from "@/components/crm/filtros-bar";
import { MotivoPerdaDialog } from "@/components/crm/motivo-perda-dialog";
import { NovaOportunidadeDialog } from "@/components/crm/nova-oportunidade-dialog";
import { OportunidadeDrawer } from "@/components/crm/oportunidade-drawer";
import { moverOportunidade } from "@/modules/crm/actions";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";

type Empresa = { id: string; nome: string };
type Consultor = { id: string; nome: string };

const FILTROS_VAZIOS: Filtros = { busca: "", vertical: "", responsavelId: "" };

export function PipelineComercialView({
  etapas,
  oportunidades,
  empresas,
  consultores,
}: {
  etapas: PipelineEtapaClient[];
  oportunidades: OportunidadeClient[];
  empresas: Empresa[];
  consultores: Consultor[];
}) {
  const [items, setItems] = useState(oportunidades);
  // Resincroniza o estado local quando o Server Component pai revalida (ex.:
  // após um Server Action). Ajuste durante o render, não em useEffect — evita
  // um passo de render extra só para copiar a prop (ver react.dev, "Adjusting
  // state when a prop changes").
  const [oportunidadesAnteriores, setOportunidadesAnteriores] = useState(oportunidades);
  if (oportunidades !== oportunidadesAnteriores) {
    setOportunidadesAnteriores(oportunidades);
    setItems(oportunidades);
  }

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [pendingPerda, setPendingPerda] = useState<{ oportunidadeId: string; etapaId: string } | null>(null);
  const [selecionada, setSelecionada] = useState<OportunidadeClient | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [, startTransition] = useTransition();

  function moverCard(oportunidadeId: string, novaEtapaId: string, motivoPerda?: string) {
    const anterior = items;
    setItems((prev) => prev.map((o) => (o.id === oportunidadeId ? { ...o, etapaId: novaEtapaId } : o)));

    startTransition(async () => {
      try {
        await moverOportunidade({ oportunidadeId, novaEtapaId, motivoPerda });
      } catch (err) {
        setItems(anterior);
        toast.error(err instanceof Error ? err.message : "Não foi possível mover a oportunidade.");
      }
    });
  }

  function handleMove(oportunidadeId: string, novaEtapaId: string) {
    const etapaDestino = etapas.find((e) => e.id === novaEtapaId);
    if (!etapaDestino) return;
    if (etapaDestino.isPerdido) {
      setPendingPerda({ oportunidadeId, etapaId: novaEtapaId });
      return;
    }
    moverCard(oportunidadeId, novaEtapaId);
  }

  const filtrados = aplicarFiltros(items, filtros);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltrosBar filtros={filtros} onChange={setFiltros} consultores={consultores} />
        <Button onClick={() => setNovaAberta(true)}>
          <Plus />
          Nova oportunidade
        </Button>
      </div>

      <Tabs defaultValue="kanban" className="flex flex-1 flex-col gap-3 overflow-hidden">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="flex flex-1 overflow-hidden">
          <KanbanView etapas={etapas} items={filtrados} onCardClick={setSelecionada} onMove={handleMove} />
        </TabsContent>
        <TabsContent value="lista" className="flex-1 overflow-hidden">
          <ListaView items={filtrados} etapas={etapas} onCardClick={setSelecionada} />
        </TabsContent>
        <TabsContent value="tabela" className="flex-1 overflow-hidden">
          <TabelaView items={filtrados} etapas={etapas} onCardClick={setSelecionada} />
        </TabsContent>
      </Tabs>

      <MotivoPerdaDialog
        open={!!pendingPerda}
        onOpenChange={(open) => !open && setPendingPerda(null)}
        onConfirm={(motivo) => {
          if (pendingPerda) moverCard(pendingPerda.oportunidadeId, pendingPerda.etapaId, motivo);
          setPendingPerda(null);
        }}
      />

      <NovaOportunidadeDialog open={novaAberta} onOpenChange={setNovaAberta} empresas={empresas} />

      <OportunidadeDrawer
        oportunidade={selecionada}
        onOpenChange={(open) => !open && setSelecionada(null)}
        consultores={consultores}
        etapas={etapas}
      />
    </div>
  );
}
