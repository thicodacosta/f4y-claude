"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const UNIDADES = [
  { chave: "recrutamento" as const, label: "Recrutamento & Seleção" },
  { chave: "alocacao" as const, label: "Alocação" },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Card de KPI com toggle entre Recrutamento & Seleção e Alocação — reusado
 * por Vagas (contagem) e Pipeline ponderado (R$), pra não duplicar dois
 * cards fixos lado a lado quando só uma unidade de negócio interessa por
 * vez (regra 44 do pedido: um card, uma métrica, com a unidade selecionável).
 * `icon` recebe o ícone já renderizado (JSX) e `format` é uma string, não
 * uma função — componentes e funções não são serializáveis cruzando a
 * borda Server→Client Component (só JSX e valores planos cruzam). */
export function CategoriaToggleCard({
  labelPrefix,
  icon,
  values,
  format,
  hint,
  tooltip,
}: {
  labelPrefix: string;
  icon: ReactNode;
  values: { alocacao: number; recrutamento: number };
  format: "moeda" | "numero";
  hint?: string;
  tooltip?: string;
}) {
  const [indice, setIndice] = useState(0);
  const unidade = UNIDADES[indice];
  const valor = values[unidade.chave];
  const valorFormatado = format === "moeda" ? currency.format(valor) : String(valor);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {labelPrefix} — {unidade.label}
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
          onClick={() => setIndice((i) => (i + 1) % UNIDADES.length)}
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Trocar unidade de negócio"
        >
          <ArrowLeftRight className="size-3.5" />
        </button>
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums">{valorFormatado}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
