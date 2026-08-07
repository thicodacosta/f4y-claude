import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export type ExecucaoClient = {
  id: string;
  automacaoNome: string;
  entidadeTipo: string;
  entidadeId: string;
  resultado: string;
  erro: string | null;
  executadoEm: string;
};

export function ExecucoesLog({ execucoes }: { execucoes: ExecucaoClient[] }) {
  if (execucoes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Automação</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead>Quando</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {execucoes.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.automacaoNome}</TableCell>
              <TableCell className="text-muted-foreground">
                {e.entidadeTipo} · {e.entidadeId.slice(0, 8)}
              </TableCell>
              <TableCell>
                <Badge variant={e.resultado === "sucesso" ? "default" : "destructive"} title={e.erro ?? undefined}>
                  {e.resultado}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{dataHora.format(new Date(e.executadoEm))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
