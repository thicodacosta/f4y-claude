"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atualizarStatusComissao } from "@/modules/financeiro/actions";
import { statusComissaoLabel, proximoStatusComissao } from "@/modules/financeiro/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  pendente: "secondary",
  aprovada: "default",
  paga: "outline",
};

export function ComissoesTable({
  comissoes,
}: {
  comissoes: {
    id: string;
    usuarioNome: string;
    origem: string;
    valor: number;
    percentual: number;
    status: string;
    competencia: string;
  }[];
}) {
  if (comissoes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma comissão ainda.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Responsável</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>%</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {comissoes.map((c) => {
            const proximo = proximoStatusComissao[c.status as keyof typeof proximoStatusComissao];
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.usuarioNome}</TableCell>
                <TableCell className="text-muted-foreground">{c.origem}</TableCell>
                <TableCell className="text-muted-foreground">{c.competencia}</TableCell>
                <TableCell className="font-mono tabular-nums">{c.percentual}%</TableCell>
                <TableCell className="font-mono tabular-nums">{currency.format(c.valor)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status] ?? "outline"}>
                    {statusComissaoLabel[c.status as keyof typeof statusComissaoLabel]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {proximo && (
                    <StatusButton
                      label={`Marcar ${statusComissaoLabel[proximo].toLowerCase()}`}
                      onClick={async () => {
                        try {
                          await atualizarStatusComissao({ comissaoId: c.id, novoStatus: proximo });
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
    <Button size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(onClick)}>
      {isPending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}
