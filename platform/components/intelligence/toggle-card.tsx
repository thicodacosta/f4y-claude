"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type ToggleCardOpcao = {
  chave: string;
  label: string;
  valor: number;
  hint?: string;
  /** Valor realizado até o momento no mesmo período da opção (ex.: receita
   * já faturada no mês/ano) — sempre em R$, exibido abaixo do hint. */
  realizado?: number;
};

/** Card de KPI com toggle entre 2+ opções — unidade de negócio (Recrutamento
 * & Seleção / Alocação) ou período (Mês / Ano, Mês / YTD). Reusado por
 * Vagas, Pipeline ponderado, Meta e Receita em /intelligence, pra não
 * duplicar cards fixos lado a lado quando só uma opção interessa por vez.
 * `icon` recebe o ícone já renderizado (JSX) e `format` é uma string, não
 * uma função — componentes e funções não são serializáveis cruzando a
 * borda Server→Client Component (só JSX e valores planos cruzam). */
export function ToggleCard({
  labelPrefix,
  icon,
  opcoes,
  format,
  tooltip,
  ariaLabel = "Trocar opção",
}: {
  labelPrefix: string;
  icon: ReactNode;
  opcoes: ToggleCardOpcao[];
  format: "moeda" | "numero";
  tooltip?: string;
  ariaLabel?: string;
}) {
  const [indice, setIndice] = useState(0);
  const opcao = opcoes[indice];
  const valorFormatado = format === "moeda" ? currency.format(opcao.valor) : String(opcao.valor);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {labelPrefix} — {opcao.label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger className="inline-flex cursor-help items-center" aria-label={`Como calculamos ${labelPrefix}`}>
                <Info className="size-3" />
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIndice((i) => (i + 1) % opcoes.length)}
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={ariaLabel}
        >
          <ArrowLeftRight className="size-3.5" />
        </button>
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums">{valorFormatado}</span>
      {opcao.hint && <span className="text-xs text-muted-foreground">{opcao.hint}</span>}
      {opcao.realizado != null && (
        <span className="font-mono text-xs font-medium tabular-nums text-foreground">
          {currency.format(opcao.realizado)} realizado
        </span>
      )}
    </div>
  );
}
