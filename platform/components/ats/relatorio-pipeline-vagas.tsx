"use client";

import { useMemo, useState } from "react";
import { Briefcase, Wallet, ChevronDown } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BarList } from "@/components/dashboard/bar-list";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMesAno } from "@/lib/format";
import { verticalNegocioLabel } from "@/modules/crm/schemas";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const JANELAS = { "3": "Últimos 3 meses", "6": "Últimos 6 meses", "12": "Últimos 12 meses", "24": "Últimos 24 meses" };

export function RelatorioPipelineVagas({
  funil,
  porVertical,
  fechadasPorPeriodo,
}: {
  funil: { id: string; nome: string; cor: string; total: number; valorTotal: number; isGanho: boolean; isPerdido: boolean }[];
  porVertical: { vertical: string; total: number }[];
  fechadasPorPeriodo: { mes: string; quantidade: number; valorTotal: number }[];
}) {
  const [expandido, setExpandido] = useState(false);
  const [janela, setJanela] = useState("6");
  const [ocultarVazios, setOcultarVazios] = useState(true);

  // fechadasPorPeriodo já vem ordenado do mais recente pro mais antigo.
  const mesAtual = fechadasPorPeriodo[0];
  const vagasAtivas = porVertical.reduce((acc, v) => acc + v.total, 0);
  // "Pipeline" = etapas em aberto — não conta Fechada nem Perdida.
  const totalPipeline = funil.reduce((acc, e) => acc + (e.isGanho || e.isPerdido ? 0 : e.valorTotal), 0);

  const dentroDaJanela = useMemo(() => fechadasPorPeriodo.slice(0, Number(janela)), [fechadasPorPeriodo, janela]);
  const linhas = ocultarVazios ? dentroDaJanela.filter((d) => d.quantidade > 0) : dentroDaJanela;
  const totalQuantidadeJanela = dentroDaJanela.reduce((acc, d) => acc + d.quantidade, 0);
  const totalValorJanela = dentroDaJanela.reduce((acc, d) => acc + d.valorTotal, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold">Pipeline de Vagas — resumo</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpandido((v) => !v)}>
          <ChevronDown className={cn("transition-transform", expandido && "rotate-180")} />
          {expandido ? "Recolher" : "Expandir"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Vagas ativas agora" value={String(vagasAtivas)} icon={Briefcase} />
        <KpiCard label="Total do pipeline" value={currency.format(totalPipeline)} icon={Wallet} />
        <KpiCard
          label={`Fechadas em ${mesAtual ? formatMesAno(mesAtual.mes) : "—"}`}
          value={mesAtual ? String(mesAtual.quantidade) : "0"}
          hint={mesAtual && mesAtual.valorTotal > 0 ? currency.format(mesAtual.valorTotal) : undefined}
          icon={Wallet}
        />
      </div>

      {expandido && (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Funil atual — quantidade por status
              </h3>
              <BarList
                items={funil.map((e) => ({ id: e.id, label: e.nome, value: e.total, color: e.cor }))}
                emptyLabel="Nenhuma vaga cadastrada ainda."
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Funil atual — valor por status
              </h3>
              <BarList
                items={funil.map((e) => ({ id: e.id, label: e.nome, value: e.valorTotal, color: e.cor }))}
                formatValue={(v) => currency.format(v)}
                emptyLabel="Nenhuma vaga com valor cadastrado."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vagas ativas por vertical
            </h3>
            <BarList
              items={porVertical.map((v) => ({
                id: v.vertical,
                label: verticalNegocioLabel[v.vertical as keyof typeof verticalNegocioLabel] ?? v.vertical,
                value: v.total,
              }))}
              emptyLabel="Nenhuma vaga ativa no momento."
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Vagas fechadas por período
              </h3>
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
              <KpiCard
                label={JANELAS[janela as keyof typeof JANELAS]}
                value={String(totalQuantidadeJanela)}
                icon={Briefcase}
              />
              <KpiCard label="Valor de fechamento" value={currency.format(totalValorJanela)} icon={Wallet} />
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
                        <TableCell className="font-medium">{formatMesAno(d.mes)}</TableCell>
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
        </div>
      )}
    </div>
  );
}
