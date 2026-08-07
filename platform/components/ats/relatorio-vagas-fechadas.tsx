import { Briefcase, Wallet } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const MES_LABEL: Record<string, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

function formatPeriodo(mes: string) {
  const [ano, m] = mes.split("-");
  return `${MES_LABEL[m] ?? m}/${ano}`;
}

export function RelatorioVagasFechadas({
  dados,
}: {
  dados: { mes: string; quantidade: number; valorTotal: number }[];
}) {
  const totalQuantidade = dados.reduce((acc, d) => acc + d.quantidade, 0);
  const totalValor = dados.reduce((acc, d) => acc + d.valorTotal, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-heading text-sm font-semibold">Vagas fechadas por período</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label={`Fechadas nos últimos ${dados.length} meses`} value={String(totalQuantidade)} icon={Briefcase} />
        <KpiCard label="Valor de fechamento" value={currency.format(totalValor)} icon={Wallet} />
      </div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Vagas fechadas</TableHead>
              <TableHead>Valor de fechamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((d) => (
              <TableRow key={d.mes}>
                <TableCell className="font-medium">{formatPeriodo(d.mes)}</TableCell>
                <TableCell className="font-mono tabular-nums">{d.quantidade}</TableCell>
                <TableCell className="font-mono tabular-nums text-muted-foreground">
                  {d.valorTotal > 0 ? currency.format(d.valorTotal) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
