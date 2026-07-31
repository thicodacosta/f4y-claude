"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import type { OportunidadeClient, PipelineEtapaClient } from "@/modules/crm/serialize";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

type Coluna = "empresa" | "etapa" | "valor" | "criadoEm";

function SortableHead({
  coluna,
  onSort,
  children,
}: {
  coluna: Coluna;
  onSort: (coluna: Coluna) => void;
  children: React.ReactNode;
}) {
  return (
    <TableHead>
      <button className="flex items-center gap-1 font-semibold" onClick={() => onSort(coluna)}>
        {children}
        <ArrowUpDown className="size-3 text-muted-foreground" />
      </button>
    </TableHead>
  );
}

export function TabelaView({
  items,
  etapas,
  onCardClick,
}: {
  items: OportunidadeClient[];
  etapas: PipelineEtapaClient[];
  onCardClick: (o: OportunidadeClient) => void;
}) {
  const [sortBy, setSortBy] = useState<Coluna>("criadoEm");
  const [asc, setAsc] = useState(false);
  const etapaPorId = new Map(etapas.map((e) => [e.id, e]));

  function toggleSort(coluna: Coluna) {
    if (sortBy === coluna) setAsc((v) => !v);
    else {
      setSortBy(coluna);
      setAsc(true);
    }
  }

  const ordenados = [...items].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "empresa") cmp = a.empresaNome.localeCompare(b.empresaNome);
    else if (sortBy === "etapa") cmp = (etapaPorId.get(a.etapaId)?.ordem ?? 0) - (etapaPorId.get(b.etapaId)?.ordem ?? 0);
    else if (sortBy === "valor") cmp = a.valorEstimado - b.valorEstimado;
    else cmp = new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
    return asc ? cmp : -cmp;
  });

  return (
    <div className="overflow-auto pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead coluna="empresa" onSort={toggleSort}>Empresa</SortableHead>
            <TableHead>Vertical</TableHead>
            <SortableHead coluna="etapa" onSort={toggleSort}>Etapa</SortableHead>
            <SortableHead coluna="valor" onSort={toggleSort}>Valor</SortableHead>
            <TableHead>Responsável</TableHead>
            <SortableHead coluna="criadoEm" onSort={toggleSort}>Criada em</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhuma oportunidade ainda.
              </TableCell>
            </TableRow>
          ) : (
            ordenados.map((o) => {
              const etapa = etapaPorId.get(o.etapaId);
              return (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => onCardClick(o)}
                >
                  <TableCell className="font-medium">{o.empresaNome}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {verticalNegocioLabel[o.vertical as keyof typeof verticalNegocioLabel]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {etapa && (
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: etapa.cor }} />
                        {etapa.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {currency.format(o.valorEstimado)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.responsavelNome ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {data.format(new Date(o.criadoEm))}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
