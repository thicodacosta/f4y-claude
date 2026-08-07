"use client";

import { useMemo, useState } from "react";
import { Briefcase, Wallet } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const JANELAS = { "3": "Últimos 3 meses", "6": "Últimos 6 meses", "12": "Últimos 12 meses", "24": "Últimos 24 meses" };

export function RelatorioVagasFechadas({
  dados,
}: {
  dados: { mes: string; quantidade: number; valorTotal: number }[];
}) {
  const [janela, setJanela] = useState("6");
  const [ocultarVazios, setOcultarVazios] = useState(true);

  // `dados` já vem ordenado do mais recente pro mais antigo.
  const dentroDaJanela = useMemo(() => dados.slice(0, Number(janela)), [dados, janela]);
  const linhas = ocultarVazios ? dentroDaJanela.filter((d) => d.quantidade > 0) : dentroDaJanela;

  const totalQuantidade = dentroDaJanela.reduce((acc, d) => acc + d.quantidade, 0);
  const totalValor = dentroDaJanela.reduce((acc, d) => acc + d.valorTotal, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Vagas fechadas por período</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 rounded border-input"
              checked={ocultarVazios}
              onChange={(e) => setOcultarVazios(e.target.checked)}
            />
            Ocultar meses sem fechamento
          </label>
          <Select items={JANELAS} value={janela} onValueChange={(v) => v && setJanela(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(JANELAS).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label={JANELAS[janela as keyof typeof JANELAS]} value={String(totalQuantidade)} icon={Briefcase} />
        <KpiCard label="Valor de fechamento" value={currency.format(totalValor)} icon={Wallet} />
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma vaga fechada nesse período.</p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Vagas fechadas</TableHead>
                <TableHead>Valor de fechamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((d) => (
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
      )}
    </div>
  );
}
