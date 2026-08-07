"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atualizarStatusFaturamento } from "@/modules/financeiro/actions";
import { statusFaturamentoLabel, proximoStatusFaturamento } from "@/modules/financeiro/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  pendente: "secondary",
  faturado: "default",
  pago: "outline",
};

export function FaturamentoTable({
  faturamentos,
}: {
  faturamentos: {
    id: string;
    empresaNome: string;
    origem: string;
    valor: number;
    status: string;
    dataPrevista: string | null;
    dataEfetiva: string | null;
  }[];
}) {
  if (faturamentos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum faturamento ainda.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data prevista</TableHead>
            <TableHead>Data efetiva</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturamentos.map((f) => {
            const proximo = proximoStatusFaturamento[f.status as keyof typeof proximoStatusFaturamento];
            return (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.empresaNome}</TableCell>
                <TableCell className="text-muted-foreground">{f.origem}</TableCell>
                <TableCell className="font-mono tabular-nums">{currency.format(f.valor)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[f.status] ?? "outline"}>
                    {statusFaturamentoLabel[f.status as keyof typeof statusFaturamentoLabel]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {f.dataPrevista ? data.format(new Date(f.dataPrevista)) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {f.dataEfetiva ? data.format(new Date(f.dataEfetiva)) : "—"}
                </TableCell>
                <TableCell>
                  {proximo && (
                    <StatusButton
                      label={`Marcar ${statusFaturamentoLabel[proximo].toLowerCase()}`}
                      onClick={async () => {
                        try {
                          await atualizarStatusFaturamento({ faturamentoId: f.id, novoStatus: proximo });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
                        }
                      }}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusButton({ label, onClick }: { label: string; onClick: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(onClick)}
    >
      {isPending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}
