"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { cn } from "@/lib/utils";
import { categoriaMetaLabel } from "@/modules/metas/schemas";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const JANELA_LABEL: Record<number, string> = {
  7: "7 dias",
  30: "30 dias",
  60: "60 dias",
  90: "90 dias",
  180: "6 meses",
  365: "12 meses",
};

type Forecast = {
  dias: number;
  conservador: number;
  provavel: number;
  agressivo: number;
  componentes: {
    pipelineNaJanela: number;
    pipelineNaJanelaPonderado: number;
    mediaHistoricaMensal: number;
    tendenciaNaJanela: number;
    oportunidadesComPrevisao: number;
    vagasComLimite: number;
  };
  dadosInsuficientes: boolean;
};

type Gap = {
  categoria: string;
  valorAlvo: number;
  realizado: number;
  gap: number;
  forecastTotal: number;
  gapProjetado: number;
  probabilidadeAtingir: number | null;
  diasRestantes: number;
};

export function ForecastView({ janelas, gaps }: { janelas: Forecast[]; gaps: Gap[] }) {
  const [dias, setDias] = useState(janelas[1]?.dias ?? janelas[0]?.dias ?? 30);
  const atual = janelas.find((j) => j.dias === dias) ?? janelas[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
        {janelas.map((j) => (
          <button
            key={j.dias}
            onClick={() => setDias(j.dias)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              j.dias === dias ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {JANELA_LABEL[j.dias] ?? `${j.dias} dias`}
          </button>
        ))}
      </div>

      {!atual || atual.dadosInsuficientes ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Dados insuficientes — sem pipeline com data prevista nem histórico de receita para essa janela.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Conservador" value={currency.format(atual.conservador)} hint="pipeline ponderado com data prevista" />
            <KpiCard label="Provável" value={currency.format(atual.provavel)} hint="+ tendência histórica (3 meses)" />
            <KpiCard label="Agressivo" value={currency.format(atual.agressivo)} hint="se tudo previsto fechar" />
          </div>

          <details className="rounded-lg border border-border p-4">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ChevronDown className="size-4" />
              Como calculamos?
            </summary>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-sm">
              <Linha label="Pipeline com previsão na janela (bruto)" valor={atual.componentes.pipelineNaJanela} />
              <Linha label="Pipeline ponderado por probabilidade da etapa" valor={atual.componentes.pipelineNaJanelaPonderado} />
              <Linha label="Média histórica mensal (últimos 3 meses)" valor={atual.componentes.mediaHistoricaMensal} />
              <Linha label="Tendência prorrateada para a janela" valor={atual.componentes.tendenciaNaJanela} />
              <p className="pt-1 text-xs text-muted-foreground">
                {atual.componentes.oportunidadesComPrevisao} oportunidade(s) e {atual.componentes.vagasComLimite} vaga(s)
                com data prevista de fechamento dentro dessa janela.
              </p>
              <p className="text-xs text-muted-foreground">
                Conservador = pipeline ponderado. Provável = ponderado + tendência. Agressivo = pipeline bruto (sem
                ponderar) + tendência.
              </p>
            </div>
          </details>
        </>
      )}

      {gaps.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-semibold">Gap-to-Goal (mês atual)</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gaps.map((g) => (
              <div key={g.categoria} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {categoriaMetaLabel[g.categoria as keyof typeof categoriaMetaLabel] ?? g.categoria}
                </span>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (g.realizado / g.valorAlvo) * 100 || 0)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {currency.format(g.realizado)} / {currency.format(g.valorAlvo)} realizado
                </span>
                <div className="flex items-center justify-between text-sm">
                  <span>Forecast do mês</span>
                  <span className="font-mono font-medium tabular-nums">{currency.format(g.forecastTotal)}</span>
                </div>
                {g.probabilidadeAtingir != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Projeção de atingir a meta</span>
                    <span className="font-mono font-medium tabular-nums">{g.probabilidadeAtingir}%</span>
                  </div>
                )}
                {g.gapProjetado > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Falta {currency.format(g.gapProjetado)} mesmo somando o forecast dos próximos {g.diasRestantes} dias.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{currency.format(valor)}</span>
    </div>
  );
}
