"use client";

import { useState } from "react";
import { ChevronDown, FileText, Handshake, XCircle, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarList } from "@/components/dashboard/bar-list";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function valorPrincipal(o: OportunidadeClient) {
  return o.valorNegociado ?? o.valorProposta ?? o.valorEstimado;
}

/** Dias desde a última atualização — proxy de "tempo na etapa atual", já
 * que `atualizadoEm` muda a cada edição (não só troca de etapa) e o app
 * ainda não guarda um carimbo de "entrou na etapa X" por registro. Rotulado
 * como aproximado na UI — ver seção 3 do pedido original (Funil de
 * conversão) para o motivo dessa simplificação. */
function diasDesde(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function PipelineKpis({ etapas, items }: { etapas: PipelineEtapaClient[]; items: OportunidadeClient[] }) {
  const [expandido, setExpandido] = useState(false);

  const etapaDe = (o: OportunidadeClient) => etapas.find((e) => e.id === o.etapaId);
  const homologados = items.filter((o) => etapaDe(o)?.isGanho);
  const perdidos = items.filter((o) => etapaDe(o)?.isPerdido);

  const contarPorNome = (nome: string) => {
    const etapa = etapas.find((e) => e.nome.toLowerCase() === nome.toLowerCase());
    return etapa ? items.filter((o) => o.etapaId === etapa.id).length : 0;
  };

  const totalDecidido = homologados.length + perdidos.length;
  const taxaConversao = totalDecidido > 0 ? (homologados.length / totalDecidido) * 100 : 0;

  const funil = etapas.map((etapa) => {
    const doEtapa = items.filter((o) => o.etapaId === etapa.id);
    return {
      id: etapa.id,
      nome: etapa.nome,
      cor: etapa.cor,
      quantidade: doEtapa.length,
      valor: doEtapa.reduce((acc, o) => acc + valorPrincipal(o), 0),
      tempoMedioDias: doEtapa.length > 0
        ? Math.round(doEtapa.reduce((acc, o) => acc + diasDesde(o.atualizadoEm), 0) / doEtapa.length)
        : null,
      isGanho: etapa.isGanho,
      isPerdido: etapa.isPerdido,
    };
  });
  const baseFunil = funil.find((f) => !f.isGanho && !f.isPerdido)?.quantidade || 1;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Pipeline Comercial — visão geral</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpandido((v) => !v)}>
          <ChevronDown className={cn("transition-transform", expandido && "rotate-180")} />
          {expandido ? "Recolher funil" : "Ver funil de conversão"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Propostas" value={String(contarPorNome("Proposta"))} icon={FileText} />
        <KpiCard label="Negociações" value={String(contarPorNome("Negociação"))} icon={Handshake} />
        <KpiCard label="Perdidos" value={String(perdidos.length)} icon={XCircle} />
        <KpiCard label="Taxa de conversão" value={`${taxaConversao.toFixed(0)}%`} hint="Homologados / decididos" icon={TrendingUp} />
      </div>

      {expandido && (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Funil atual — quantidade por etapa
              </h3>
              <BarList
                items={funil.map((f) => ({ id: f.id, label: f.nome, value: f.quantidade, color: f.cor }))}
                emptyLabel="Nenhuma oportunidade cadastrada ainda."
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Funil atual — valor por etapa
              </h3>
              <BarList
                items={funil.map((f) => ({ id: f.id, label: f.nome, value: f.valor, color: f.cor }))}
                formatValue={(v) => currency.format(v)}
                emptyLabel="Nenhuma oportunidade com valor cadastrado."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Detalhamento por etapa
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>% do topo do funil</TableHead>
                  <TableHead>Tempo médio na etapa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funil.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="font-mono tabular-nums">{f.quantidade}</TableCell>
                    <TableCell className="font-mono tabular-nums text-muted-foreground">
                      {f.valor > 0 ? currency.format(f.valor) : "—"}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-muted-foreground">
                      {f.isGanho || f.isPerdido ? "—" : `${Math.round((f.quantidade / baseFunil) * 100)}%`}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-muted-foreground">
                      {f.tempoMedioDias !== null ? `~${f.tempoMedioDias}d` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Tempo médio aproximado, calculado pela última atualização de cada oportunidade parada na etapa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
