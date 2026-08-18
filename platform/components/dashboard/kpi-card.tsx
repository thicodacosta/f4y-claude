import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Explicação de como o número foi calculado, mostrada ao passar o cursor
   * sobre o ícone de informação — pra métricas cuja fórmula não é óbvia só
   * pelo rótulo (ex: "Pipeline ponderado"). */
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger className="inline-flex cursor-help items-center" aria-label={`Como calculamos ${label}`}>
              <Info className="size-3" />
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
