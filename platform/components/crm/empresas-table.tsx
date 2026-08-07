"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EmpresaRow = {
  id: string;
  nome: string;
  segmento: string | null;
  status: string;
  cidade: string | null;
  estado: string | null;
  _count: { oportunidades: number };
  contatos: { id: string }[];
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  ativo: "default",
  prospect: "secondary",
  inativo: "outline",
};

export function EmpresasTable({ empresas }: { empresas: EmpresaRow[] }) {
  const router = useRouter();

  if (empresas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma empresa ainda.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>Contatos</TableHead>
            <TableHead>Oportunidades</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empresas.map((e) => (
            <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/empresas/${e.id}`)}>
              <TableCell className="font-medium">{e.nome}</TableCell>
              <TableCell className="text-muted-foreground">{e.segmento ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[e.status] ?? "outline"}>{e.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {e.cidade ? `${e.cidade}${e.estado ? "/" + e.estado : ""}` : "—"}
              </TableCell>
              <TableCell className="tabular-nums">{e.contatos.length}</TableCell>
              <TableCell className="tabular-nums">{e._count.oportunidades}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
