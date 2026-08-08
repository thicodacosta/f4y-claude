"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { prioridadeVagaLabel } from "@/modules/ats/schemas";
import type { VagaClient } from "@/modules/ats/serialize";

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  aberta: "default",
  pausada: "secondary",
  fechada: "outline",
  perdida: "destructive",
};

export function VagasTable({ vagas }: { vagas: VagaClient[] }) {
  const router = useRouter();

  if (vagas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma vaga ainda.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cargo</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Vertical</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recrutador</TableHead>
            <TableHead>Posições</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vagas.map((v) => (
            <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/vagas/${v.id}`)}>
              <TableCell className="font-medium">
                {v.confidencial && "🔒 "}
                {v.cargo}
              </TableCell>
              <TableCell className="text-muted-foreground">{v.empresaNome}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">
                    {verticalNegocioLabel[v.vertical as keyof typeof verticalNegocioLabel]}
                  </Badge>
                  {v.executiveSearch && <Badge>Executive Search</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {prioridadeVagaLabel[v.prioridade as keyof typeof prioridadeVagaLabel]}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant[v.status] ?? "outline"}>{v.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{v.recrutadorNome ?? "—"}</TableCell>
              <TableCell className="tabular-nums">
                {v.posicoesPreenchidas}/{v.quantidadePosicoes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
