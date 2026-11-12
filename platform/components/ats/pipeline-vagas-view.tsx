"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VagaKanbanView } from "@/components/ats/vaga-kanban-view";
import { NovaVagaDialog } from "@/components/ats/nova-vaga-dialog";
import { FecharVagaDialog, type ContatoClient } from "@/components/ats/fechar-vaga-dialog";
import { EditarVagaDialog } from "@/components/ats/editar-vaga-dialog";
import { moverVaga } from "@/modules/ats/actions";
import type { VagaClient, PipelineEtapaClient } from "@/modules/ats/serialize";

const TODOS_OS_CLIENTES = "__todos__";

export function PipelineVagasView({
  etapas,
  vagas,
  empresas,
  contatos,
  mostrarValor,
  equipe,
}: {
  etapas: PipelineEtapaClient[];
  vagas: VagaClient[];
  empresas: { id: string; nome: string }[];
  contatos: ContatoClient[];
  mostrarValor: boolean;
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(vagas);
  const [vagasAnteriores, setVagasAnteriores] = useState(vagas);
  if (vagas !== vagasAnteriores) {
    setVagasAnteriores(vagas);
    setItems(vagas);
  }

  const [novaAberta, setNovaAberta] = useState(false);
  const [fecharAlvo, setFecharAlvo] = useState<{ vaga: VagaClient; novaEtapaId: string } | null>(null);
  const [editarAlvo, setEditarAlvo] = useState<VagaClient | null>(null);
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [, startTransition] = useTransition();

  // Só clientes que têm vaga no pipeline agora — filtrar por um prospect sem
  // vaga nenhuma não faz sentido aqui (diferente do Select de "Nova vaga",
  // que precisa listar toda a base de empresas).
  const clientesComVaga = useMemo(() => {
    const porId = new Map<string, string>();
    for (const v of items) porId.set(v.empresaId, v.empresaNome);
    return [...porId.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [items]);

  const itemsFiltrados = clienteFiltro ? items.filter((v) => v.empresaId === clienteFiltro) : items;

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

  function handleFechada(vagaId: string, novaEtapaId: string, valorVenda: number) {
    setItems((prev) => prev.map((v) => (v.id === vagaId ? { ...v, etapaId: novaEtapaId, status: "fechada", valor: valorVenda } : v)));
    setFecharAlvo(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          items={{
            [TODOS_OS_CLIENTES]: "Todos os clientes",
            ...Object.fromEntries(clientesComVaga.map(([id, nome]) => [id, nome])),
          }}
          value={clienteFiltro || TODOS_OS_CLIENTES}
          onValueChange={(v) => setClienteFiltro(!v || v === TODOS_OS_CLIENTES ? "" : v)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS_OS_CLIENTES}>Todos os clientes</SelectItem>
            {clientesComVaga.map(([id, nome]) => (
              <SelectItem key={id} value={id}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setNovaAberta(true)}>
          <Plus />
          Nova vaga
        </Button>
      </div>

      <VagaKanbanView
        etapas={etapas}
        items={itemsFiltrados}
        onCardClick={(v) => setEditarAlvo(v)}
        onMove={handleMove}
        onFechar={(vaga, novaEtapaId) => setFecharAlvo({ vaga, novaEtapaId })}
        mostrarValor={mostrarValor}
      />

      <NovaVagaDialog
        open={novaAberta}
        onOpenChange={setNovaAberta}
        empresas={empresas}
        onCriada={(vagaId) => router.push(`/vagas/${vagaId}`)}
      />

      <FecharVagaDialog
        open={!!fecharAlvo}
        onOpenChange={(open) => !open && setFecharAlvo(null)}
        vaga={fecharAlvo?.vaga ?? null}
        novaEtapaId={fecharAlvo?.novaEtapaId ?? ""}
        contatos={contatos}
        onFechada={handleFechada}
      />

      {/* key={editarAlvo.id} força remontagem do form com defaultValues da
          vaga certa — react-hook-form só lê defaultValues no primeiro
          render, então trocar de card sem remontar deixaria os campos
          antigos visíveis. */}
      {editarAlvo && (
        <EditarVagaDialog
          key={editarAlvo.id}
          open
          onOpenChange={(open) => !open && setEditarAlvo(null)}
          vaga={editarAlvo}
          equipe={equipe}
        />
      )}
    </div>
  );
}
